#!/usr/bin/env bun

import { parseArgs } from "util";
import { exportPack } from "./export";
import { importPack } from "./import";
import React from "react";
import { renderToString } from "react-dom/server";
import { existsSync } from "fs";

const args = Bun.argv.slice(2);
const command = args[0];

if (command === "export") {
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      name: { type: "string", short: "n" },
      description: { type: "string", short: "d" },
      author: { type: "string", short: "a" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`zopack export -- Generate a .zopack.md from route data

Usage:
  echo '<routes json>' | bun index.ts export --name <name> [options]

Reads a JSON array of route objects from stdin. Each object:
  { "path": "/api/foo", "route_type": "api", "public": true, "code": "..." }

Options:
  -n, --name         Pack name (required)
  -d, --description  Short description
  -a, --author       Author handle (default: auto-detected from code)
  -o, --output       Output file path (default: Inbox/<name>.zopack.md)
  -h, --help         Show this help`);
    process.exit(0);
  }

  if (!values.name) {
    console.error("Error: --name is required. Use --help for export.");
    process.exit(1);
  }

  const stdin = await Bun.stdin.text();
  let routes: any[];
  try {
    routes = JSON.parse(stdin);
    if (!Array.isArray(routes)) throw new Error("Expected JSON array");
  } catch (e: any) {
    console.error(`Error parsing stdin: ${e.message}`);
    process.exit(1);
  }

  try {
    const result = await exportPack({
      name: values.name,
      description: values.description,
      author: values.author,
      output: values.output,
    }, routes);
    console.log(result);
  } catch (err: any) {
    console.error(`Export failed: ${err.message}`);
    process.exit(1);
  }

} else if (command === "import") {
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      file: { type: "string", short: "f" },
      handle: { type: "string" },
      preview: { type: "boolean", short: "p" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`zopack import -- Parse a .zopack.md file and output a deployment plan

Usage:
  bun index.ts import --file <path> [options]

Options:
  -f, --file     Path to the .zopack.md file (required)
  --handle       Your zo.space handle for variable replacement
  -p, --preview  Preview the plan without outputting full code
  -h, --help     Show this help`);
    process.exit(0);
  }

  if (!values.file) {
    console.error("Error: --file is required. Use --help for import.");
    process.exit(1);
  }

  try {
    const plan = await importPack({
      file: values.file,
      handle: values.handle,
      preview: values.preview,
    });
    if (plan && !values.preview) {
      console.log(JSON.stringify(plan, null, 2));
    }
  } catch (err: any) {
    console.error("Import failed:", err.message);
    process.exit(1);
  }

} else if (command === "serve" || !command) {
  // SSR server mode
  const { values } = parseArgs({
    args: command === "serve" ? args.slice(1) : args,
    options: {
      port: { type: "string", short: "p", default: "5173" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`zopack serve -- Run the Zo Space Bun SSR server locally

Usage:
  bun index.ts serve [options]
  bun index.ts [options] (default)

Options:
  -p, --port   Port to listen on (default: 5173)
  -h, --help   Show this help`);
    process.exit(0);
  }

  const port = parseInt(values.port || "5173", 10);
  console.log(`Zo Space Bun SSR server listening on http://localhost:${port}/`);

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      const routesDir = existsSync("./routes") ? "routes" : "examples/routes";
      const globInstance = new Bun.Glob(`./${routesDir}/**/*.{ts,tsx}`);
      const routeFiles = Array.from(globInstance.scanSync());

      let matchedModule: any = null;
      for (const file of routeFiles) {
        const normalized = file.replaceAll("\\", "/");
        
        // API Route Match
        if (url.pathname.startsWith("/api/")) {
          const name = normalized.split(`/${routesDir}/api/`)[1]?.replace(/\.tsx?$/, "");
          if (name && url.pathname === `/api/${name}`) {
            matchedModule = await import(`./${normalized}`);
            break;
          }
        } else {
          // UI Page Match
          if (url.pathname === "/" && (normalized.endsWith(`${routesDir}/index.ts`) || normalized.endsWith(`${routesDir}/index.tsx`))) {
            matchedModule = await import(`./${normalized}`);
            break;
          }
          const name = normalized.split(`/${routesDir}/`)[1]?.replace(/\.tsx?$/, "");
          if (name && url.pathname === `/${name}`) {
            matchedModule = await import(`./${normalized}`);
            break;
          }
        }
      }

      if (!matchedModule || !matchedModule.default) {
        return new Response("404 Not Found", { status: 404 });
      }

      // Handle API Endpoint
      if (url.pathname.startsWith("/api/")) {
        const c = {
          req: {
            query: (key: string) => url.searchParams.get(key) || undefined,
            json: async () => req.body ? await req.json() : {},
          },
          json: (data: any) => new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" }
          })
        };
        try {
          return await matchedModule.default(c);
        } catch (err) {
          console.error(err);
          return new Response(String(err), { status: 500 });
        }
      }

      // Handle UI Endpoint via SSR
      try {
        const body = renderToString(React.createElement(matchedModule.default));

        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>etok.zo.space - Bun SSR</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-[#0a100a] text-white">
    <div id="root">${body}</div>
  </body>
</html>`;

        return new Response(html, {
          headers: { "content-type": "text/html" },
        });
      } catch (err) {
        console.error(err);
        return new Response(String(err), { status: 500 });
      }
    }
  });

} else {
  console.log(`zopack -- Unified CLI for Zo routes packaging and local SSR preview

Usage:
  bun index.ts [command] [options]

Commands:
  export   Generate a .zopack.md from route data
  import   Parse a .zopack.md file and output a deployment plan
  serve    Run the Zo Space Bun SSR server locally (default)

Run 'bun index.ts [command] --help' for more details.`);
  process.exit(1);
}
