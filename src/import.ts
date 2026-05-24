#!/usr/bin/env bun

import { resolvePackPath } from "./pack-path";

export interface ParsedRoute {
  path: string;
  route_type: "api" | "page";
  public: boolean;
  code: string;
}

export interface ParsedPack {
  meta: Record<string, string>;
  routes: ParsedRoute[];
  npm_deps: string[];
  shadcn_components: string[];
  directories: string[];
  files: Array<{ path: string; content: string }>;
  secrets: string[];
  variables: Array<{ placeholder: string; description: string }>;
}

export interface ImportOptions {
  file: string;
  handle?: string;
  preview?: boolean;
}

function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  content = normalizeMarkdown(content);
  const meta: Record<string, string> = {};
  if (!content.startsWith("---")) return { meta, body: content };

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return { meta, body: content };

  const frontmatter = content.slice(3, endIdx).trim();
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }

  const body = content.slice(endIdx + 3).trim();
  return { meta, body };
}

export function parseRoutes(body: string): ParsedRoute[] {
  const routes: ParsedRoute[] = [];

  // Match ### `path` (type, visibility)
  const routeHeaderRegex = /^###\s+`([^`]+)`\s+\((\w+),\s*(\w+)\)/gm;
  const headers: Array<{ path: string; type: string; visibility: string; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = routeHeaderRegex.exec(body)) !== null) {
    headers.push({
      path: match[1],
      type: match[2],
      visibility: match[3],
      index: match.index,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const sectionStart = header.index;
    const sectionEnd = i < headers.length - 1 ? headers[i + 1].index : body.length;
    const section = body.slice(sectionStart, sectionEnd);

    // Extract the fenced code block
    const codeMatch = section.match(/```(?:typescript|tsx|ts)\r?\n([\s\S]*?)```/);
    if (!codeMatch) continue;

    routes.push({
      path: header.path,
      route_type: header.type as "api" | "page",
      public: header.visibility === "public",
      code: codeMatch[1].trimEnd(),
    });
  }

  return routes;
}

export function parseDependencies(body: string): { npm: string[]; shadcn: string[] } {
  const npm: string[] = [];
  const shadcn: string[] = [];

  const depsSection = body.match(/## Dependencies\n\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!depsSection) return { npm, shadcn };

  const text = depsSection[1];

  // npm packages
  const npmMatch = text.match(/\*\*npm packages\*\*[^\n]*\n((?:- `[^`]+`\n?)*)/);
  if (npmMatch) {
    const lines = npmMatch[1].trim().split("\n");
    for (const line of lines) {
      const m = line.match(/- `([^`]+)`/);
      if (m) npm.push(m[1]);
    }
  }

  // shadcn/components
  const compMatch = text.match(/\*\*Components\*\*[^\n]*\n((?:- `[^`]+`\n?)*)/);
  if (compMatch) {
    const lines = compMatch[1].trim().split("\n");
    for (const line of lines) {
      const m = line.match(/- `([^`]+)`/);
      if (m) shadcn.push(m[1]);
    }
  }

  return { npm, shadcn };
}

export function parseSetup(body: string): { directories: string[]; files: Array<{ path: string; content: string }>; secrets: string[] } {
  const directories: string[] = [];
  const files: Array<{ path: string; content: string }> = [];
  const secrets: string[] = [];

  const setupSection = body.match(/## Setup\n\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!setupSection) return { directories, files, secrets };

  const text = setupSection[1];

  // Directories
  const dirMatch = text.match(/\*\*Directories to create:\*\*\n((?:- `[^`]+`\n?)*)/);
  if (dirMatch) {
    for (const line of dirMatch[1].trim().split("\n")) {
      const m = line.match(/- `([^`]+)`/);
      if (m) directories.push(m[1]);
    }
  }

  // Files
  const fileMatch = text.match(/\*\*Files to initialize:\*\*\n((?:- `[^`]+`[^\n]*\n?)*)/);
  if (fileMatch) {
    for (const line of fileMatch[1].trim().split("\n")) {
      const m = line.match(/- `([^`]+)` with content: `([^`]*)`/);
      if (m) files.push({ path: m[1], content: m[2] });
    }
  }

  // Secrets
  const secretMatch = text.match(/\*\*Secrets required\*\*[^\n]*\n((?:- `[^`]+`\n?)*)/);
  if (secretMatch) {
    for (const line of secretMatch[1].trim().split("\n")) {
      const m = line.match(/- `([^`]+)`/);
      if (m) secrets.push(m[1]);
    }
  }

  return { directories, files, secrets };
}

export function parseVariables(body: string): Array<{ placeholder: string; description: string }> {
  const variables: Array<{ placeholder: string; description: string }> = [];
  const section = body.match(/## Variables\n\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!section) return variables;

  for (const line of section[1].trim().split("\n")) {
    const match = line.match(/\|\s*`(\{\{[^`]+\}\})`\s*\|\s*([^|]+?)\s*\|/);
    if (match) {
      variables.push({ placeholder: match[1], description: match[2].trim() });
    }
  }

  return variables;
}

export function replaceVariables(code: string, handle?: string): string {
  if (handle) {
    code = code.replace(/\{\{HANDLE\}\}/g, handle);
  }
  return code;
}

export function parsePackFromContent(raw: string, handle?: string): ParsedPack {
  const { meta, body } = parseFrontmatter(raw);

  if (meta.format !== "zopack") {
    throw new Error("This file does not appear to be a .zopack.md (missing format: zopack in frontmatter)");
  }

  const routes = parseRoutes(body);
  const { npm, shadcn } = parseDependencies(body);
  const { directories, files, secrets } = parseSetup(body);
  const variables = parseVariables(body);
  const processedRoutes = routes.map((route) => ({
    ...route,
    code: replaceVariables(route.code, handle),
  }));

  return {
    meta,
    routes: processedRoutes,
    npm_deps: npm,
    shadcn_components: shadcn,
    directories,
    files,
    secrets,
    variables,
  };
}

function collectUnreplacedVariables(routes: ParsedRoute[]): Set<string> {
  const unreplaced = new Set<string>();
  for (const route of routes) {
    const matches = route.code.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      for (const match of matches) unreplaced.add(match);
    }
  }
  return unreplaced;
}

export async function importPack(options: ImportOptions): Promise<ParsedPack | void> {
  const raw = await Bun.file(resolvePackPath(options.file)).text();
  const plan = parsePackFromContent(raw, options.handle);
  const unreplaced = collectUnreplacedVariables(plan.routes);

  if (options.preview) {
    console.log(`Pack: ${plan.meta.name || "unknown"}`);
    console.log(`Author: ${plan.meta.author || "unknown"}`);
    console.log(`Description: ${plan.meta.description || "none"}`);
    console.log(`\nRoutes (${plan.routes.length}):`);
    for (const r of plan.routes) {
      console.log(`  ${r.path} (${r.route_type}, ${r.public ? "public" : "private"}) -- ${r.code.split("\n").length} lines`);
    }
    if (plan.npm_deps.length > 0) console.log(`\nnpm deps: ${plan.npm_deps.join(", ")}`);
    if (plan.shadcn_components.length > 0) console.log(`\nComponents: ${plan.shadcn_components.join(", ")}`);
    if (plan.directories.length > 0) console.log(`\nDirectories: ${plan.directories.join(", ")}`);
    if (plan.files.length > 0) console.log(`\nFiles: ${plan.files.map((f) => f.path).join(", ")}`);
    if (plan.secrets.length > 0) console.log(`\nSecrets needed: ${plan.secrets.join(", ")}`);
    if (plan.variables.length > 0) {
      console.log(`\nVariables:`);
      for (const variable of plan.variables) {
        console.log(`  ${variable.placeholder} — ${variable.description}`);
      }
    }
    if (unreplaced.size > 0) console.log(`\nUnreplaced variables: ${[...unreplaced].join(", ")}`);
    if (!options.handle && unreplaced.has("{{HANDLE}}")) {
      console.log(`\nTip: Pass --handle <your-handle> to replace {{HANDLE}} automatically`);
    }
    return plan;
  }

  if (unreplaced.size > 0 && !options.handle) {
    console.error(`Warning: Unreplaced variables found: ${[...unreplaced].join(", ")}`);
    if (unreplaced.has("{{HANDLE}}")) {
      console.error(`Pass --handle <your-handle> to replace {{HANDLE}}`);
    }
  }
  return plan;
}