import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { plugin } from "bun";
import type { BunPlugin } from "bun";
import { parsePackFromContent, type ParsedPack } from "./import";
import { routeToVirtualFile, VIRTUAL_ROUTE_PREFIX } from "./route-utils";

const ROUTE_NAMESPACE = "zopack-route";
const CLI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export interface PackRegistryEntry {
  pack: ParsedPack;
  revision: number;
  workspaceRoot: string | null;
}

const packRegistry = new Map<string, PackRegistryEntry>();
let pluginRegistered = false;

export function registerPack(slug: string, pack: ParsedPack, workspaceRoot: string | null): void {
  const existing = packRegistry.get(slug);
  packRegistry.set(slug, {
    pack,
    revision: existing ? existing.revision + 1 : 1,
    workspaceRoot,
  });
}

export function unregisterPack(slug: string): void {
  packRegistry.delete(slug);
}

export function getPackRevision(slug: string): number {
  return packRegistry.get(slug)?.revision ?? 0;
}

export function getRegisteredSlugs(): string[] {
  return [...packRegistry.keys()];
}

function parseSlugAndVirtualFile(path: string): { slug: string; virtualFile: string } | null {
  const stripped = path.startsWith(VIRTUAL_ROUTE_PREFIX)
    ? path.slice(VIRTUAL_ROUTE_PREFIX.length)
    : path.replace(/^zopack-route:/, "").replace(/^\/+/, "");

  const slashIdx = stripped.indexOf("/");
  if (slashIdx === -1) return null;

  return {
    slug: stripped.slice(0, slashIdx),
    virtualFile: stripped.slice(slashIdx + 1),
  };
}

function findRouteByVirtualPath(path: string) {
  const parsed = parseSlugAndVirtualFile(path);
  if (!parsed) {
    throw new Error(`Invalid zopack virtual path (no slug): ${path}`);
  }

  const entry = packRegistry.get(parsed.slug);
  if (!entry) {
    throw new Error(`No pack registered for slug "${parsed.slug}". Call registerPack() before importing routes.`);
  }

  return {
    route: entry.pack.routes.find(
      (route) => routeToVirtualFile(route.path, route.route_type) === parsed.virtualFile,
    ),
    workspaceRoot: entry.workspaceRoot,
  };
}

function rewriteWorkspacePaths(code: string, workspaceRoot: string | null): string {
  if (!workspaceRoot) return code;
  const normalized = workspaceRoot.replaceAll("\\", "/");
  return code.replace(/\/home\/workspace\//g, `${normalized}/`);
}

function decoratePageSource(source: string): string {
  const reactSource = join(CLI_ROOT, "node_modules", "react").replaceAll("\\", "/");
  return `/** @jsxImportSource ${reactSource} */\n${source}`;
}

export function createZopackPlugin(): BunPlugin {
  return {
    name: "zopack",
    setup(build) {
      build.onLoad({ filter: /\.zopack\.md$/ }, async (args) => {
        const raw = await Bun.file(args.path).text();
        const plan = parsePackFromContent(raw);
        return {
          contents: `export default ${JSON.stringify(plan)};`,
          loader: "js",
        };
      });

      build.onResolve({ filter: /^zopack-route:\/\// }, (args) => ({
        path: args.path.split("?")[0]!,
        namespace: ROUTE_NAMESPACE,
      }));

      build.onLoad({ filter: /.*/, namespace: ROUTE_NAMESPACE }, (args) => {
        const { route, workspaceRoot } = findRouteByVirtualPath(args.path);
        if (!route) {
          throw new Error(`Unknown zopack route module: ${args.path}`);
        }

        const code = rewriteWorkspacePaths(route.code, workspaceRoot);
        if (route.route_type === "page") {
          return {
            contents: decoratePageSource(code),
            loader: "tsx",
          };
        }

        return {
          contents: code,
          loader: "ts",
        };
      });
    },
  };
}

export function registerZopackPlugin(): void {
  if (pluginRegistered) return;
  plugin(createZopackPlugin());
  pluginRegistered = true;
}

export function zopackBuildPlugins(): BunPlugin[] {
  return [createZopackPlugin()];
}
