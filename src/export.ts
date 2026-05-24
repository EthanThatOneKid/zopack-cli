#!/usr/bin/env bun

import { resolveWorkspaceDir } from "./pack-path";

export interface RouteInfo {
  path: string;
  route_type: "api" | "page";
  public: boolean;
  code: string;
}

export interface ExportOptions {
  name: string;
  description?: string;
  author?: string;
  output?: string;
}

export async function exportPack(options: ExportOptions, routes: RouteInfo[]): Promise<string> {
  const SPACE_BUILD = "/__substrate/space";
  const workspaceDir = resolveWorkspaceDir();

  if (routes.length === 0) {
    throw new Error("No routes provided.");
  }

  function detectHandle(code: string): string | null {
    const match = code.match(/https:\/\/(\w+)\.zo\.space/);
    return match ? match[1] : null;
  }

  function templatizeCode(code: string, handle: string): string {
    return code.replace(new RegExp(`https://${handle}\\.zo\\.space`, "g"), "https://{{HANDLE}}.zo.space");
  }

  function detectNpmImports(code: string): Set<string> {
    const deps = new Set<string>();
    const importRegex = /from\s+["']([^"'.@/][^"']*)["']/g;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(code)) !== null) {
      const pkg = m[1].startsWith("@") ? m[1].split("/").slice(0, 2).join("/") : m[1].split("/")[0];
      deps.add(pkg);
    }
    const scopedRegex = /from\s+["'](@[^"'/]+\/[^"'/]+)/g;
    while ((m = scopedRegex.exec(code)) !== null) {
      deps.add(m[1]);
    }
    return deps;
  }

  function detectComponentImports(code: string): string[] {
    const paths: string[] = [];
    const regex = /from\s+["']@\/components\/(animate-ui\/[^"']+|ui\/[^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(code)) !== null) {
      paths.push(m[1]);
    }
    return paths;
  }

  function detectFilesystemPaths(code: string): { directories: string[]; files: Record<string, string> } {
    const dirs = new Set<string>();
    const files: Record<string, string> = {};
    const pathRegex = /["']\/home\/workspace\/([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = pathRegex.exec(code)) !== null) {
      const p = m[1];
      if (p.endsWith(".json")) {
        files[p] = "[]";
        const dir = p.split("/").slice(0, -1).join("/");
        if (dir) dirs.add(dir);
      } else if (!p.includes(".")) {
        dirs.add(p);
      }
    }
    return { directories: [...dirs], files };
  }

  function detectSecrets(code: string): string[] {
    const secrets = new Set<string>();
    const regex = /process\.env\.(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(code)) !== null) {
      const name = m[1];
      if (!["ZO_CLIENT_IDENTITY_TOKEN", "PORT", "NODE_ENV"].includes(name)) {
        secrets.add(name);
      }
    }
    return [...secrets];
  }

  function guessRegistryUrl(componentPath: string): string | null {
    if (componentPath.startsWith("animate-ui/")) {
      const rest = componentPath.replace("animate-ui/", "").replace(/\.\w+$/, "");
      const slug = rest.replace(/\//g, "-");
      return `https://animate-ui.com/r/${slug}.json`;
    }
    if (componentPath.startsWith("ui/")) {
      const name = componentPath.replace("ui/", "").replace(/\.\w+$/, "");
      return `shadcn:${name}`;
    }
    return null;
  }

  // Detect handle from all code
  let detectedHandle: string | null = null;
  for (const r of routes) {
    detectedHandle = detectHandle(r.code);
    if (detectedHandle) break;
  }
  const author = options.author || detectedHandle || "unknown";

  // Aggregate deps
  const allNpmDeps = new Set<string>();
  const allComponents = new Set<string>();
  const allDirs = new Set<string>();
  const allFiles: Record<string, string> = {};
  const allSecrets = new Set<string>();

  for (const r of routes) {
    for (const dep of detectNpmImports(r.code)) allNpmDeps.add(dep);
    for (const comp of detectComponentImports(r.code)) allComponents.add(comp);
    const fs = detectFilesystemPaths(r.code);
    for (const d of fs.directories) allDirs.add(d);
    Object.assign(allFiles, fs.files);
    for (const s of detectSecrets(r.code)) allSecrets.add(s);
  }

  // Filter against base zo.space deps
  let baseDeps = new Set<string>();
  try {
    const raw = await Bun.file(`${SPACE_BUILD}/package.json`).text();
    const pkg = JSON.parse(raw);
    baseDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
    ]);
  } catch {}

  // Also filter out node built-ins and @/ alias imports
  const builtins = new Set([
    "fs", "fs/promises", "path", "crypto", "util", "url", "os",
    "http", "https", "stream", "buffer", "events", "child_process",
    "net", "tls", "dns", "assert", "querystring", "string_decoder",
  ]);

  const extraNpmDeps = [...allNpmDeps].filter(
    (d) => !baseDeps.has(d) && !builtins.has(d) && !d.startsWith("@/") && !d.startsWith("node:")
  );

  // Map components to registry URLs
  const componentUrls: string[] = [];
  for (const comp of allComponents) {
    const url = guessRegistryUrl(comp);
    if (url) componentUrls.push(url);
  }

  // Templatize code
  const processedRoutes = routes.map((r) => ({
    ...r,
    code: detectedHandle ? templatizeCode(r.code, detectedHandle) : r.code,
  }));

  // Build the markdown
  let md = "";

  md += `---\n`;
  md += `format: zopack\n`;
  md += `version: "1.0"\n`;
  md += `name: ${options.name}\n`;
  if (options.description) md += `description: "${options.description}"\n`;
  md += `author: ${author}.zo.computer\n`;
  md += `routes: ${processedRoutes.length}\n`;
  md += `exported: ${new Date().toISOString().split("T")[0]}\n`;
  md += `---\n\n`;

  md += `# ${options.name}\n\n`;
  if (options.description) md += `${options.description}\n\n`;

  md += `## Routes\n\n`;
  for (const r of processedRoutes) {
    const visibility = r.public ? "public" : "private";
    const lang = r.route_type === "page" ? "tsx" : "typescript";
    md += `### \`${r.path}\` (${r.route_type}, ${visibility})\n\n`;
    md += `\`\`\`${lang}\n`;
    md += r.code.trim();
    md += `\n\`\`\`\n\n`;
  }

  if (extraNpmDeps.length > 0 || componentUrls.length > 0) {
    md += `## Dependencies\n\n`;
    if (extraNpmDeps.length > 0) {
      md += `**npm packages** (not in default zo.space):\n`;
      for (const dep of extraNpmDeps) md += `- \`${dep}\`\n`;
      md += `\n`;
    }
    if (componentUrls.length > 0) {
      md += `**Components** (install via shadcn CLI):\n`;
      for (const url of componentUrls) md += `- \`${url}\`\n`;
      md += `\n`;
    }
  }

  const dirs = [...allDirs];
  const fileEntries = Object.entries(allFiles);
  const secrets = [...allSecrets];
  if (dirs.length > 0 || fileEntries.length > 0 || secrets.length > 0) {
    md += `## Setup\n\n`;
    if (dirs.length > 0) {
      md += `**Directories to create:**\n`;
      for (const d of dirs) md += `- \`${d}\`\n`;
      md += `\n`;
    }
    if (fileEntries.length > 0) {
      md += `**Files to initialize:**\n`;
      for (const [path, content] of fileEntries) {
        md += `- \`${path}\` with content: \`${content}\`\n`;
      }
      md += `\n`;
    }
    if (secrets.length > 0) {
      md += `**Secrets required** (configure in Settings > Advanced):\n`;
      for (const s of secrets) md += `- \`${s}\`\n`;
      md += `\n`;
    }
  }

  if (detectedHandle) {
    md += `## Variables\n\n`;
    md += `| Placeholder | Description |\n`;
    md += `|---|---|\n`;
    md += `| \`{{HANDLE}}\` | Your zo.space handle (replaces \`${detectedHandle}\`) |\n`;
    md += `\n`;
  }

  const outputPath = options.output
    ? (options.output.startsWith("/") || options.output.includes(":") ? options.output : `${workspaceDir}/${options.output}`)
    : `${workspaceDir}/Inbox/${options.name}.zopack.md`;

  // Ensure directories in outputPath exist
  const pathParts = outputPath.replaceAll("\\", "/").split("/");
  if (pathParts.length > 1) {
    const dirToCreate = pathParts.slice(0, -1).join("/");
    if (dirToCreate) {
      const { mkdirSync } = await import("fs");
      mkdirSync(dirToCreate, { recursive: true });
    }
  }

  await Bun.write(outputPath, md);

  console.error(`Exported ${processedRoutes.length} routes to ${outputPath}`);
  console.error(`  npm deps: ${extraNpmDeps.length > 0 ? extraNpmDeps.join(", ") : "none (all in base)"}`);
  console.error(`  components: ${componentUrls.length}`);
  console.error(`  secrets: ${secrets.length > 0 ? secrets.join(", ") : "none"}`);
  console.error(`  handle templatized: ${detectedHandle || "none found"}`);

  return outputPath;
}