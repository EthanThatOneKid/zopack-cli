import { existsSync, mkdirSync, readFileSync, rmSync, watchFile, unwatchFile, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash } from "crypto";
import { Hono } from "hono";
import type { BunPlugin } from "bun";
import type { Context } from "hono";
import type { RouteManifest, RouteManifestEntry } from "./route-types";
import { matchRoute } from "./route-manifest";
import { getActivePackRevision, zopackBuildPlugins } from "./zopack-plugin";

interface ClientBundle {
  entry: RouteManifestEntry;
  file: string;
  publicPath: string;
}

export interface ServeOptions {
  manifest: RouteManifest;
  port: number;
  packFile?: string;
  reloadPack?: () => Promise<RouteManifest>;
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

export async function serveZoSpace({ manifest, port, packFile, reloadPack }: ServeOptions) {
  const buildDir = join(CLI_ROOT, ".zopack-build", `serve-${process.pid}`);
  let currentManifest = manifest;
  let clientBundles = await buildClientBundles(currentManifest, buildDir);
  let apiImports = await buildApiModules(currentManifest, buildDir);
  let apiApp = createApiApp(currentManifest, apiImports);

  console.log(`Loaded ${currentManifest.entries.length} zo.space routes from ${currentManifest.routesDir}`);
  for (const entry of currentManifest.entries) {
    console.log(`  ${entry.path} (${entry.route_type}) -> ${entry.file}`);
  }
  console.log(`Zo Space local emulator listening on http://localhost:${port}/`);

  const siteLabel = basename(currentManifest.routesDir).replace(/\.zopack\.md$/, "") || "zopack";

  if (packFile && reloadPack) {
    watchFile(packFile, { interval: 500 }, async () => {
      try {
        currentManifest = await reloadPack();
        clientBundles = await buildClientBundles(currentManifest, buildDir);
        apiImports = await buildApiModules(currentManifest, buildDir);
        apiApp = createApiApp(currentManifest, apiImports);
        console.log(`Reloaded pack: ${currentManifest.entries.length} routes from ${packFile}`);
      } catch (err) {
        console.error("Failed to reload pack:", err);
      }
    });
  }

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

      if (matchRoute(currentManifest, url.pathname, "api")) {
        return apiApp.fetch(req);
      }

      const pageMatch = matchRoute(currentManifest, url.pathname, "page");
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

  if (packFile) {
    process.on("exit", () => unwatchFile(packFile));
  }
}

function createApiApp(manifest: RouteManifest, apiImports: Map<string, string>): Hono {
  const app = new Hono();

  for (const entry of manifest.entries.filter((route) => route.route_type === "api")) {
    const importPath = apiImports.get(entry.path);
    if (!importPath) {
      throw new Error(`Missing built API module for ${entry.path}`);
    }
    app.all(entry.path, async (c) => invokeApiRoute(entry, c, importPath));
  }

  return app;
}

async function invokeApiRoute(entry: RouteManifestEntry, c: Context, importPath: string): Promise<Response> {
  try {
    const mod = await import(withRevision(importPath));
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
      plugins: clientBuildPlugins(),
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

export async function buildApiModules(manifest: RouteManifest, buildDir: string): Promise<Map<string, string>> {
  const modules = new Map<string, string>();
  const apiDir = join(buildDir, "api");
  mkdirSync(apiDir, { recursive: true });

  for (const entry of manifest.entries.filter((route) => route.route_type === "api")) {
    const id = bundleId(entry);
    const stub = join(apiDir, `${id}.ts`);
    const outfile = join(apiDir, `${id}.js`);

    writeFileSync(stub, `export { default } from ${JSON.stringify(entry.importPath)};\n`, "utf8");

    const result = await Bun.build({
      entrypoints: [stub],
      outdir: apiDir,
      target: "bun",
      format: "esm",
      naming: `${id}.[ext]`,
      plugins: apiBuildPlugins(),
    });

    if (!result.success) {
      const messages = result.logs.map((log) => log.message).join("\n");
      throw new Error(`Failed to build API module for ${entry.path}:\n${messages}`);
    }

    if (!existsSync(outfile)) {
      throw new Error(`Expected API module was not written: ${outfile}`);
    }

    modules.set(entry.path, pathToFileURL(outfile).href);
  }

  return modules;
}

function apiBuildPlugins(): BunPlugin[] {
  return [...zopackBuildPlugins(), resolveBareImportsFromCli()];
}

function clientBuildPlugins(): BunPlugin[] {
  return [...zopackBuildPlugins(), normalizeRouteJsxRuntime(), resolveBareImportsFromCli()];
}

function normalizeRouteJsxRuntime(): BunPlugin {
  return {
    name: "zopack-normalize-jsx-runtime",
    setup(build) {
      build.onLoad({ filter: /\.([cm]?tsx?|jsx)$/ }, async (args) => {
        const normalizedPath = args.path.replaceAll("\\", "/");
        if (
          normalizedPath.includes("/node_modules/") ||
          args.path.startsWith(CLI_ROOT) ||
          args.namespace === "zopack-route"
        ) {
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
  return `import React from "react";
import { createRoot } from "react-dom/client";
import Page from ${JSON.stringify(entry.importPath)};

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
  return createHash("sha256").update(`${entry.path}:${entry.file}:${getActivePackRevision()}`).digest("hex").slice(0, 16);
}

function withRevision(importPath: string): string {
  return `${importPath}?rev=${getActivePackRevision()}`;
}

export function warnMissingNpmDeps(npmDeps: string[]): void {
  for (const dep of npmDeps) {
    const packageName = dep.startsWith("@") ? dep.split("/").slice(0, 2).join("/") : dep.split("/")[0];
    try {
      Bun.resolveSync(packageName, CLI_ROOT);
    } catch {
      try {
        Bun.resolveSync(packageName, process.cwd());
      } catch {
        console.warn(`Missing npm dependency "${dep}". Install it with: bun add ${dep}`);
      }
    }
  }
}
