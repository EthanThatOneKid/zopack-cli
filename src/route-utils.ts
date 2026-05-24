import type { RouteManifestEntry, RouteType } from "./route-types";

export const VIRTUAL_ROUTE_SCHEME = "zopack-route:///";

export function collapseIndexSegment(segments: string[]): string[] {
  if (segments.length === 1 && segments[0] === "index") return [];
  if (segments.at(-1) === "index") return segments.slice(0, -1);
  return segments;
}

export function validateRoutePathSegments(label: string, segments: string[]) {
  if (segments.length === 0) {
    throw new Error(`Invalid route: ${label}`);
  }

  for (const segment of segments) {
    if (/^\[.+\]$/.test(segment)) {
      throw new Error(
        `Unsupported route segment "${segment}" in ${label}. zo.space dynamic routes use ":param", not "[param]".`,
      );
    }

    if (segment.includes("[") || segment.includes("]")) {
      throw new Error(`Unsupported bracket characters in route: ${label}`);
    }

    if (segment.startsWith(":") && !/^:[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
      throw new Error(`Invalid dynamic route segment "${segment}" in ${label}`);
    }
  }
}

export function normalizedRoutePath(segments: string[]): string {
  const routeSegments = collapseIndexSegment(segments);
  const path = routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
  return path === "/api" ? "/api/index" : path;
}

export function routePattern(path: string): { pattern: RegExp; paramNames: string[] } {
  if (path === "/") return { pattern: /^\/$/, paramNames: [] };

  const paramNames: string[] = [];
  const parts = path
    .split("/")
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(":")) {
        paramNames.push(part.slice(1));
        return "([^/]+)";
      }
      return escapeRegExp(part);
    });

  return {
    pattern: new RegExp(`^/${parts.join("/")}$`),
    paramNames,
  };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function routeToVirtualFile(routePath: string, routeType: RouteType): string {
  if (routePath === "/") {
    return routeType === "api" ? "api/index.ts" : "index.tsx";
  }

  const segments = routePath.split("/").filter(Boolean);
  const suffix = routeType === "api" ? ".ts" : ".tsx";
  return `${segments.join("/")}${suffix}`;
}

export function virtualRoutePath(routePath: string, routeType: RouteType): string {
  return `${VIRTUAL_ROUTE_SCHEME}${routeToVirtualFile(routePath, routeType)}`;
}

export function validateRouteManifest(entries: RouteManifestEntry[]) {
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
