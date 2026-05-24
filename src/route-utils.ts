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
