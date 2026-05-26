import type { ParsedPack } from "./import";

export interface DependencyWarning {
  category: "filesystem" | "localhost" | "cross-space" | "env";
  detail: string;
  route: string;
}

export interface DependencyWarningResult {
  warnings: DependencyWarning[];
}

const IGNORED_ENV_VARS = new Set([
  "ZO_CLIENT_IDENTITY_TOKEN",
  "PORT",
  "NODE_ENV",
  "HOME",
  "PATH",
  "USER",
  "SHELL",
  "TERM",
]);

export function detectUndeclaredPaths(
  code: string,
  routePath: string,
  declaredDirs: string[],
  declaredFiles: string[],
): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];
  const regex = /["']\/home\/workspace\/([^"']+)["']/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(code)) !== null) {
    const referencedPath = m[1];
    const coveredByDir = declaredDirs.some(
      (dir) => referencedPath === dir || referencedPath.startsWith(`${dir}/`),
    );
    const coveredByFile = declaredFiles.some((f) => referencedPath === f);
    if (!coveredByDir && !coveredByFile) {
      warnings.push({
        category: "filesystem",
        detail: `/home/workspace/${referencedPath}`,
        route: routePath,
      });
    }
  }

  return warnings;
}

export function detectLocalhostServices(code: string, routePath: string): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];
  const seen = new Set<string>();

  const patterns = [
    /["'](https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^"']*?)["']/g,
    /["']((?:postgres|postgresql|redis|mongodb|mysql|amqp|nats):\/\/(?:localhost|127\.0\.0\.1)[^"']*?)["']/g,
    /["'](wss?:\/\/(?:localhost|127\.0\.0\.1):\d+[^"']*?)["']/g,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(code)) !== null) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        warnings.push({ category: "localhost", detail: url, route: routePath });
      }
    }
  }

  return warnings;
}

export function detectCrossSpaceCalls(code: string, routePath: string): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];
  const seen = new Set<string>();
  const regex = /["'](https?:\/\/[\w-]+\.zo\.space\/[^"']*?)["']/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(code)) !== null) {
    const url = m[1];
    if (url.includes("{{HANDLE}}")) continue;
    if (!seen.has(url)) {
      seen.add(url);
      warnings.push({ category: "cross-space", detail: url, route: routePath });
    }
  }

  return warnings;
}

export function detectMissingEnvVars(
  code: string,
  routePath: string,
  declaredSecrets: string[],
): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];
  const seen = new Set<string>();
  const regex = /process\.env\.(\w+)/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(code)) !== null) {
    const varName = m[1];
    if (IGNORED_ENV_VARS.has(varName) || seen.has(varName)) continue;
    seen.add(varName);

    if (process.env[varName] == null) {
      const declared = declaredSecrets.includes(varName);
      const qualifier = declared ? "declared in ## Setup, not set locally" : "undeclared, not set locally";
      warnings.push({
        category: "env",
        detail: `${varName}  (${qualifier})`,
        route: routePath,
      });
    }
  }

  return warnings;
}

export function analyzeUnmetDependencies(plan: ParsedPack): DependencyWarningResult {
  const declaredFiles = plan.files.map((f) => f.path);
  const warnings: DependencyWarning[] = [];

  for (const route of plan.routes) {
    warnings.push(...detectUndeclaredPaths(route.code, route.path, plan.directories, declaredFiles));
    warnings.push(...detectLocalhostServices(route.code, route.path));
    warnings.push(...detectCrossSpaceCalls(route.code, route.path));
    warnings.push(...detectMissingEnvVars(route.code, route.path, plan.secrets));
  }

  return { warnings };
}

export function warnUnmetDependencies(plan: ParsedPack): DependencyWarningResult {
  const result = analyzeUnmetDependencies(plan);
  if (result.warnings.length === 0) return result;

  const grouped = new Map<DependencyWarning["category"], DependencyWarning[]>();
  for (const w of result.warnings) {
    let list = grouped.get(w.category);
    if (!list) {
      list = [];
      grouped.set(w.category, list);
    }
    list.push(w);
  }

  const labels: Record<DependencyWarning["category"], { heading: string; tip: string }> = {
    filesystem: {
      heading: "Filesystem paths not in ## Setup:",
      tip: "Add these to the pack's ## Setup section, or create them in .zopack-workspace/",
    },
    localhost: {
      heading: "Localhost services:",
      tip: "These routes expect Zo Services running locally. Start the services or mock them.",
    },
    "cross-space": {
      heading: "Cross-space API calls:",
      tip: "These routes call other Zo Spaces that may not be reachable from your machine.",
    },
    env: {
      heading: "Missing environment variables:",
      tip: "Set these in your shell or a .env file before running zopack serve.",
    },
  };

  console.warn("\n  [zopack] Unmet dependencies detected:\n");
  for (const [category, items] of grouped) {
    const { heading, tip } = labels[category];
    console.warn(`  ${heading}`);
    for (const item of items) {
      console.warn(`    ${item.detail}  (referenced in ${item.route})`);
    }
    console.warn(`    Tip: ${tip}\n`);
  }

  return result;
}
