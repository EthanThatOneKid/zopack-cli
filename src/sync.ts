#!/usr/bin/env bun
/**
 * zopack sync -- Pull live etok.zo.space routes into local routes/
 * Usage: bun src/sync.ts [--handle etok]
 */

import { parseArgs } from "util";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const MANIFEST_URL = "https://api.zo.computer/zo/ask";
const ZO_API_KEY = process.env.ZO_API_KEY;

if (!ZO_API_KEY) {
  console.error("Error: ZO_API_KEY environment variable is required");
  process.exit(1);
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    handle: { type: "string", short: "h", default: "etok" },
    force: { type: "boolean", short: "f", default: false },
    dry: { type: "boolean", short: "d", default: false },
  },
});

const handle = values.handle;

async function queryRoutes(): Promise<any[]> {
  const resp = await fetch(MANIFEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ZO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: `List ALL routes on ${handle}.zo.space. For each route return: path, route_type ("api" or "page"), and public (true/false). Format as a JSON array. Example: [{"path":"/","route_type":"page","public":true}]`,
      model_name: "vercel:minimax/minimax-m2.7",
    }),
  });
  const data = await resp.json();
  const output: string = data.output ?? "";

  // Try to extract JSON array from the text response
  const jsonMatch = output.match(/\[\s*\{[\s\S]+\]/);
  if (!jsonMatch) throw new Error("Could not parse route manifest from response:\n" + output.slice(0, 500));
  return JSON.parse(jsonMatch[0]);
}

async function fetchRouteCode(path: string): Promise<string | null> {
  const resp = await fetch(MANIFEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ZO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: `Call get_space_route for path ${JSON.stringify(path)} on ${handle}.zo.space. Return the full code field only, nothing else.`,
      model_name: "vercel:minimax/minimax-m2.7",
    }),
  });
  const data = await resp.json();
  const output: string = data.output ?? "";

  // Extract code from markdown code block
  const codeMatch = output.match(/```(?:tsx?|typescript)?\n([\s\S]+?)```/) ?? output.match(/```([\s\S]+?)```/);
  if (!codeMatch) return null;
  return codeMatch[1].trim();
}

function routeToFilePath(routePath: string, routeType: string): string {
  // Map zo.space route path to local file path in routes/
  // `/`           -> routes/index.tsx or routes/index.ts
  // `/birthday`   -> routes/birthday.tsx or routes/birthday.ts
  // `/api/foo`    -> routes/api/foo.ts
  // `/api/foo/:id` -> routes/api/foo/:id.ts
  // `/space/3ds-demo` -> routes/space/3ds-demo.tsx

  const segments = routePath.split("/").filter(Boolean);
  const ext = routeType === "api" ? "ts" : "tsx";

  if (segments.length === 0) {
    return `index.${ext}`;
  }

  // Normalize trailing slash route (e.g. /foo/ -> foo/index)
  const last = segments.at(-1)!;
  const normalised = last.endsWith("/")
    ? [...segments.slice(0, -1), last.slice(0, -1), "index"]
    : segments;

  return normalised.join("/") + `.${ext}`;
}

async function main() {
  console.log(`Fetching route manifest from ${handle}.zo.space...`);
  const routes = await queryRoutes();
  console.log(`Found ${routes.length} routes`);

  const routesDir = join(process.cwd(), "routes");
  if (values.force) {
    rmSync(routesDir, { recursive: true, force: true });
  }

  let written = 0;
  let skipped = 0;

  for (const route of routes) {
    const { path, route_type, public: isPublic } = route;
    if (!isPublic) {
      console.log(`  [SKIP] ${path} (private)`);
      skipped++;
      continue;
    }

    if (values.dry) {
      console.log(`  [DRY] ${path} (${route_type})`);
      continue;
    }

    const filePath = routeToFilePath(path, route_type);
    const fullPath = join(routesDir, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });

    // Fetch code from live space
    const code = await fetchRouteCode(path);
    if (!code) {
      console.log(`  [SKIP] ${path} (no code returned)`);
      skipped++;
      continue;
    }

    writeFileSync(fullPath, code, "utf8");
    console.log(`  [OK] ${path} -> ${filePath}`);
    written++;
  }

  console.log(`\nSync complete: ${written} written, ${skipped} skipped`);
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});

function dirname(p: string): string {
  const parts = p.split("/");
  parts.pop();
  return parts.join("/") || ".";
}