import { existsSync } from "fs";
import { pathToFileURL } from "url";
import {
  collapseIndexSegment,
  routePattern,
  validateRoutePathSegments,
} from "./route-utils";

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
  routesDir: string;
  entries: RouteManifestEntry[];
}

export interface RouteMatch {
  entry: RouteManifestEntry;
  params: Record<string, string>;
}

const ROUTE_FILE_REGEX = /\.(ts|tsx)$/;

export function resolveRoutesDir(cwd = process.cwd()): string {
  const routesDir = `${cwd}/routes`;
  if (existsSync(routesDir)) return routesDir;
  return `${cwd}/examples/routes`;
}

export function createRouteManifest(cwd = process.cwd()): RouteManifest {
  const routesDir = resolveRoutesDir(cwd);
  if (!existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`);
  }

  const glob = new Bun.Glob("**/*.{ts,tsx}");
  const files = Array.from(glob.scanSync({ cwd: routesDir }))
    .map((file) => file.replaceAll("\\", "/"))
    .sort();

  const entries = files.map((file) => routeFileToEntry(routesDir, file));
  validateRouteManifest(entries);

  return { routesDir, entries };
}

export function matchRoute(manifest: RouteManifest, pathname: string, routeType?: RouteType): RouteMatch | null {
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

function routeFileToEntry(routesDir: string, file: string): RouteManifestEntry {
  const withoutExt = file.replace(ROUTE_FILE_REGEX, "");
  const segments = withoutExt.split("/").filter(Boolean);
  validateRoutePathSegments(file, segments);

  const isApi = segments[0] === "api";
  const route_type: RouteType = isApi ? "api" : "page";
  const routeSegments = collapseIndexSegment(segments);
  const path = `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
  const normalizedPath = path === "/api" ? "/api/index" : path;
  const { pattern, paramNames } = routePattern(normalizedPath);
  const absoluteFile = `${routesDir}/${file}`;

  return {
    path: normalizedPath,
    route_type,
    file: absoluteFile,
    importPath: pathToFileImport(absoluteFile),
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

function pathToFileImport(path: string): string {
  return pathToFileURL(path).href;
}
