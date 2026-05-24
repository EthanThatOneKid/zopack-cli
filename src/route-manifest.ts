import type { RouteManifest, RouteManifestEntry, RouteType } from "./route-types";

export type { RouteManifest, RouteManifestEntry, RouteMatch, RouteType } from "./route-types";

export function matchRoute(manifest: RouteManifest, pathname: string, routeType?: RouteType) {
  for (const entry of manifest.entries) {
    if (routeType && entry.route_type !== routeType) continue;
    const match = entry.pattern.exec(pathname);
    if (!match) continue;

    const params: Record<string, string> = {};
    for (let i = 0; i < entry.paramNames.length; i += 1) {
      params[entry.paramNames[i]] = decodeURIComponent(match[i + 1] ?? "");
    }
    return { entry, params };
  }
  return null;
}
