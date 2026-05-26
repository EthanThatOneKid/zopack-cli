import type { ParsedPack } from "./import";
import type { RouteManifest, RouteManifestEntry } from "./route-types";
import {
  normalizedRoutePath,
  routePattern,
  validateRouteManifest,
  validateRoutePathSegments,
  virtualRoutePath,
} from "./route-utils";

export function createPackManifest(plan: ParsedPack, packFile: string, slug: string): RouteManifest {
  const entries = plan.routes.map((route) => packRouteToEntry(route, packFile, slug));
  validateRouteManifest(entries);
  return { slug, routesDir: packFile, entries };
}

function packRouteToEntry(
  route: ParsedPack["routes"][number],
  packFile: string,
  slug: string,
): RouteManifestEntry {
  if (route.path === "/") {
    const { pattern, paramNames } = routePattern("/");
    const virtualFile = virtualRoutePath(slug, route.path, route.route_type);
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

  const path = normalizedRoutePath(segments);
  const { pattern, paramNames } = routePattern(path);
  const virtualFile = virtualRoutePath(slug, route.path, route.route_type);

  return {
    path,
    route_type: route.route_type,
    file: virtualFile,
    importPath: virtualFile,
    pattern,
    paramNames,
  };
}
