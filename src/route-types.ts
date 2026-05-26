export type RouteType = "api" | "page";

export interface RouteManifestEntry {
  path: string;
  route_type: RouteType;
  file: string;
  importPath: string;
  pattern: RegExp;
  paramNames: string[];
}

export interface RouteManifest {
  slug: string;
  routesDir: string;
  entries: RouteManifestEntry[];
}

export interface RouteMatch {
  entry: RouteManifestEntry;
  params: Record<string, string>;
}
