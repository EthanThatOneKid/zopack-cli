import { existsSync } from "fs";
import { pathToFileURL } from "url";

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
  validateSegments(file, segments);

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

function collapseIndexSegment(segments: string[]): string[] {
  if (segments.length === 1 && segments[0] === "index") return [];
  if (segments.at(-1) === "index") return segments.slice(0, -1);
  return segments;
}

function validateSegments(file: string, segments: string[]) {
  if (segments.length === 0) {
    throw new Error(`Invalid route file: ${file}`);
  }

  for (const segment of segments) {
    if (/^\[.+\]$/.test(segment)) {
      throw new Error(
        `Unsupported route segment "${segment}" in ${file}. zo.space dynamic routes use ":param", not "[param]".`,
      );
    }

    if (segment.includes("[") || segment.includes("]")) {
      throw new Error(`Unsupported bracket characters in route file: ${file}`);
    }

    if (segment.startsWith(":") && !/^:[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
      throw new Error(`Invalid dynamic route segment "${segment}" in ${file}`);
    }
  }
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

function routePattern(path: string): { pattern: RegExp; paramNames: string[] } {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathToFileImport(path: string): string {
  return pathToFileURL(path).href;
}
