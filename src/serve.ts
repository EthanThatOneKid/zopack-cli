import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
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

export async function serveZoSpace({ manifest, port }: ServeOptions) {
  const buildDir = join(CLI_ROOT, ".zopack-build", `serve-${process.pid}`);
  const clientBundles = await buildClientBundles(manifest, buildDir);
  const apiApp = createApiApp(manifest);

  console.log(`Loaded ${manifest.entries.length} zo.space routes from ${manifest.routesDir}`);
  for (const entry of manifest.entries) {
    console.log(`  ${entry.path} (${entry.route_type}) -> ${entry.file}`);
  }
  console.log(`Zo Space local emulator listening on http://localhost:${port}/`);

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname.startsWith("/_zopack/client/")) {
        return serveClientBundle(clientBundles, url.pathname);
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

      return new Response(renderPageHtml(bundle), {
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

async function buildClientBundles(manifest: RouteManifest, buildDir: string): Promise<Map<string, ClientBundle>> {
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
      build.onLoad({ filter: /\.[cm]?[jt]sx$/ }, async (args) => {
        if (args.path.includes("/node_modules/") || args.path.startsWith(CLI_ROOT)) {
          return undefined;
        }

        const source = await Bun.file(args.path).text();
        const reactSource = join(CLI_ROOT, "node_modules", "react").replaceAll("\\", "/");
        return {
          contents: `/** @jsxImportSource ${reactSource} */\n${source}`,
          loader: args.path.endsWith(".jsx") ? "jsx" : "tsx",
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
        try {
          return { path: Bun.resolveSync(args.path, dirname(args.importer)) };
        } catch {
          return { path: Bun.resolveSync(args.path, CLI_ROOT) };
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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Page from ${JSON.stringify(entry.file)};

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  React.createElement(
    MemoryRouter,
    { initialEntries: [window.location.pathname + window.location.search + window.location.hash] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: ${JSON.stringify(entry.path)},
        element: React.createElement(Page),
      }),
    ),
  ),
);
`;
}

function renderPageHtml(bundle: ClientBundle): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>etok.zo.space - local</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${bundle.publicPath}"></script>
  </body>
</html>`;
}

function bundleId(entry: RouteManifestEntry): string {
  return createHash("sha256").update(`${entry.path}:${entry.file}`).digest("hex").slice(0, 16);
}

function withMtime(importPath: string, file: string): string {
  const mtimeMs = statSync(file).mtimeMs;
  return `${importPath}?mtime=${mtimeMs}`;
}
