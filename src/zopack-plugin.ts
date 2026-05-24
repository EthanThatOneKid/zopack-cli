import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { plugin } from "bun";
import type { BunPlugin } from "bun";
import { parsePackFromContent, type ParsedPack, type ParsedRoute } from "./import";

const ROUTE_NAMESPACE = "zopack-route";
const ROUTE_SCHEME = "zopack-route:///";
const CLI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

let activePack: ParsedPack | null = null;
let activePackRevision = 0;
let workspaceRoot: string | null = null;
let pluginRegistered = false;

export function setActivePack(plan: ParsedPack): void {
  activePack = plan;
  activePackRevision += 1;
}

export function getActivePackRevision(): number {
  return activePackRevision;
}

export function setWorkspaceRoot(root: string | null): void {
  workspaceRoot = root;
}

export function routeToVirtualFile(routePath: string, routeType: ParsedRoute["route_type"]): string {
  if (routePath === "/") {
    return routeType === "api" ? "api/index.ts" : "index.tsx";
  }

  const segments = routePath.split("/").filter(Boolean);
  const suffix = routeType === "api" ? ".ts" : ".tsx";
  return `${segments.join("/")}${suffix}`;
}

export function virtualRoutePath(routePath: string, routeType: ParsedRoute["route_type"]): string {
  return `${ROUTE_SCHEME}${routeToVirtualFile(routePath, routeType)}`;
}

function findRouteByVirtualPath(path: string): ParsedRoute | undefined {
  if (!activePack) {
    throw new Error("No active zopack loaded. Call setActivePack() before importing routes.");
  }

  const virtualFile = path.startsWith(ROUTE_SCHEME)
    ? path.slice(ROUTE_SCHEME.length)
    : path.replace(/^zopack-route:/, "").replace(/^\/+/, "");

  return activePack.routes.find(
    (route) => routeToVirtualFile(route.path, route.route_type) === virtualFile,
  );
}

function rewriteWorkspacePaths(code: string): string {
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
        const route = findRouteByVirtualPath(args.path);
        if (!route) {
          return {
            errors: [{ text: `Unknown zopack route module: ${args.path}` }],
          };
        }

        const code = rewriteWorkspacePaths(route.code);
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
