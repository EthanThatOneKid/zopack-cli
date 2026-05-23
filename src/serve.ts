import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { Hono } from "hono";
import type { BunPlugin } from "bun";
import type { Context } from "hono";
import type { RouteManifest, RouteManifestEntry } from "./route-manifest";
import { matchRoute } from "./route-manifest";

interface ClientBundle {
  entry: RouteManifestEntry;
  file: string;
  publicPath: string;
}

interface ServeOptions {
  manifest: RouteManifest;
  port: number;
}

const JS_CONTENT_TYPE = "text/javascript; charset=UTF-8";
const CLI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "console", "constants",
  "crypto", "dgram", "dns", "domain", "events", "fs", "http", "https",
  "module", "net", "os", "path", "perf_hooks", "process", "punycode",
  "querystring", "readline", "repl", "stream", "string_decoder", "sys",
  "timers", "tls", "trace_events", "tty", "url", "util", "v8", "vm", "zlib",
]);

/** Always bundle from zopack-cli so a space repo's node_modules cannot duplicate React. */
const CLI_PEER_DEPS = new Set(["react", "react-dom", "react-dom/client", "react-router", "react-router-dom"]);

export async function serveZoSpace({ manifest, port }: ServeOptions) {
  const buildDir = join(CLI_ROOT, ".zopack-build", `serve-${process.pid}`);
  const clientBundles = await buildClientBundles(manifest, buildDir);
  const apiApp = createApiApp(manifest);

  console.log(`Loaded ${manifest.entries.length} zo.space routes from ${manifest.routesDir}`);
  for (const entry of manifest.entries) {
    console.log(`  ${entry.path} (${entry.route_type}) -> ${entry.file}`);
  }
  console.log(`Zo Space local emulator listening on http://localhost:${port}/`);

  const siteLabel = basename(dirname(manifest.routesDir));

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/_zopack/client/")) {
        return serveClientBundle(clientBundles, url.pathname);
      }

      if (url.pathname === "/favicon.ico") {
        return serveFavicon();
      }

      if (matchRoute(manifest, url.pathname, "api")) {
        return apiApp.fetch(req);
      }

      const pageMatch = matchRoute(manifest, url.pathname, "page");
      if (!pageMatch) {
        return new Response("404 Not Found", { status: 404 });
      }

      const bundle = clientBundles.get(pageMatch.entry.path);
      if (!bundle) {
        return new Response(`Missing client bundle for ${pageMatch.entry.path}`, { status: 500 });
      }

      return new Response(renderPageHtml(bundle, siteLabel), {
        headers: { "content-type": "text/html; charset=UTF-8" },
      });
    },
  });
}

function createApiApp(manifest: RouteManifest): Hono {
  const app = new Hono();

  for (const entry of manifest.entries.filter((route) => route.route_type === "api")) {
    app.all(entry.path, async (c) => invokeApiRoute(entry, c));
  }

  return app;
}

async function invokeApiRoute(entry: RouteManifestEntry, c: Context): Promise<Response> {
  try {
    const mod = await import(withMtime(entry.importPath, entry.file));
    if (typeof mod.default !== "function") {
      return c.text(`Route ${entry.path} is missing a default export`, 500);
    }
    const response = await mod.default(c);
    if (response instanceof Response) return response;
    return c.text(`Route ${entry.path} did not return a Response`, 500);
  } catch (err) {
    console.error(err);
    return c.text(String(err), 500);
  }
}

export async function buildClientBundles(manifest: RouteManifest, buildDir: string): Promise<Map<string, ClientBundle>> {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });

  const bundles = new Map<string, ClientBundle>();
  const pages = manifest.entries.filter((entry) => entry.route_type === "page");

  for (const entry of pages) {
    const id = bundleId(entry);
    const entrypoint = join(buildDir, `${id}.tsx`);
    const outfile = join(buildDir, `${id}.js`);

    writeFileSync(entrypoint, clientEntrypoint(entry), "utf8");

    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: buildDir,
      target: "browser",
      format: "esm",
      splitting: false,
      sourcemap: "inline",
      naming: `${id}.[ext]`,
      plugins: [normalizeRouteJsxRuntime(), resolveBareImportsFromCli()],
    });

    if (!result.success) {
      const messages = result.logs.map((log) => log.message).join("\n");
      throw new Error(`Failed to build client bundle for ${entry.path}:\n${messages}`);
    }

    if (!existsSync(outfile)) {
      throw new Error(`Expected client bundle was not written: ${outfile}`);
    }

    bundles.set(entry.path, {
      entry,
      file: outfile,
      publicPath: `/_zopack/client/${id}.js`,
    });
  }

  return bundles;
}

function normalizeRouteJsxRuntime(): BunPlugin {
  return {
    name: "zopack-normalize-jsx-runtime",
    setup(build) {
      build.onLoad({ filter: /\.([cm]?tsx?|jsx)$/ }, async (args) => {
        const normalizedPath = args.path.replaceAll("\\", "/");
        if (normalizedPath.includes("/node_modules/") || args.path.startsWith(CLI_ROOT)) {
          return undefined;
        }

        const source = await Bun.file(args.path).text();
        const reactSource = join(CLI_ROOT, "node_modules", "react").replaceAll("\\", "/");
        return {
          contents: `/** @jsxImportSource ${reactSource} */\n${source}`,
          loader: normalizedPath.endsWith(".jsx") ? "jsx" : "tsx",
        };
      });
    },
  };
}

function resolveBareImportsFromCli(): BunPlugin {
  return {
    name: "zopack-zo-space-dependencies",
    setup(build) {
      build.onResolve({ filter: /^(?![./]|[A-Za-z]:|file:).+/ }, (args) => {
        if (/^https?:\/\//.test(args.path) || args.path.startsWith("node:")) {
          return undefined;
        }
        if (NODE_BUILTINS.has(args.path)) {
          return { path: args.path, external: true };
        }
        const resolveFrom = CLI_PEER_DEPS.has(args.path) ? CLI_ROOT : dirname(args.importer);
        try {
          return { path: resolve(Bun.resolveSync(args.path, resolveFrom)) };
        } catch {
          if (resolveFrom !== CLI_ROOT) {
            return { path: resolve(Bun.resolveSync(args.path, CLI_ROOT)) };
          }
          return undefined;
        }
      });
    },
  };
}

function serveClientBundle(bundles: Map<string, ClientBundle>, pathname: string): Response {
  const bundle = Array.from(bundles.values()).find((candidate) => candidate.publicPath === pathname);
  if (!bundle) {
    return new Response("404 Not Found", { status: 404 });
  }
  return new Response(readFileSync(bundle.file), {
    headers: { "content-type": JS_CONTENT_TYPE },
  });
}

function clientEntrypoint(entry: RouteManifestEntry): string {
  // Each bundle serves a single page; the server already picked the route.
  return `import React from "react";
import { createRoot } from "react-dom/client";
import Page from ${JSON.stringify(entry.file)};

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(React.createElement(Page));
`;
}

function renderPageHtml(bundle: ClientBundle, siteLabel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${siteLabel} — local</title>
    <link rel="icon" href="/favicon.ico" type="image/svg+xml" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${bundle.publicPath}"></script>
  </body>
</html>`;
}

function serveFavicon(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0a100a"/><circle cx="16" cy="16" r="6" fill="#10b981"/></svg>`;
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml; charset=UTF-8" },
  });
}

function bundleId(entry: RouteManifestEntry): string {
  return createHash("sha256").update(`${entry.path}:${entry.file}`).digest("hex").slice(0, 16);
}

function withMtime(importPath: string, file: string): string {
  const mtimeMs = statSync(file).mtimeMs;
  return `${importPath}?mtime=${mtimeMs}`;
}
