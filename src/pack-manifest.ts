import type { ParsedPack } from "./import";
import {
  collapseIndexSegment,
  routePattern,
  validateRoutePathSegments,
} from "./route-utils";
import type { RouteManifest, RouteManifestEntry } from "./route-manifest";
import { virtualRoutePath } from "./zopack-plugin";

export function createPackManifest(plan: ParsedPack, packFile: string): RouteManifest {
  const entries = plan.routes.map((route) => packRouteToEntry(route, packFile));
  validateRouteManifest(entries);
  return { routesDir: packFile, entries };
}

function packRouteToEntry(
  route: ParsedPack["routes"][number],
  packFile: string,
): RouteManifestEntry {
  if (route.path === "/") {
    const { pattern, paramNames } = routePattern("/");
    const virtualFile = virtualRoutePath(route.path, route.route_type);
    return {
      path: "/",
      route_type: route.route_type,
      file: virtualFile,
      importPath: virtualFile,
      pattern,
      paramNames,
    };
  }

  const segments = route.path.split("/").filter(Boolean);
  validateRoutePathSegments(`${packFile} route ${route.path}`, segments);

  const routeSegments = collapseIndexSegment(segments);
  const normalizedPath = routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
  const path = normalizedPath === "/api" ? "/api/index" : normalizedPath;
  const { pattern, paramNames } = routePattern(path);
  const virtualFile = virtualRoutePath(route.path, route.route_type);

  return {
    path,
    route_type: route.route_type,
    file: virtualFile,
    importPath: virtualFile,
    pattern,
    paramNames,
  };
}

function validateRouteManifest(entries: RouteManifestEntry[]) {
  const seen = new Map<string, RouteManifestEntry>();
  for (const entry of entries) {
    const key = `${entry.route_type}:${entry.path}`;
    const existing = seen.get(key);
    if (existing) {
      throw new Error(`Ambiguous route "${entry.path}" from ${existing.file} and ${entry.file}`);
    }
    seen.set(key, entry);
  }
}
