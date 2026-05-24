#!/usr/bin/env bun

import { parseArgs } from "util";
import { exportPack } from "./export";
import { importPack } from "./import";
import { serveZoSpace } from "./serve";
import { loadPackForServe, reloadPackForServe } from "./serve-pack";

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
  const { values } = parseArgs({
    args: command === "serve" ? args.slice(1) : args,
    options: {
      file: { type: "string", short: "f" },
      handle: { type: "string" },
      port: { type: "string", short: "p", default: "5173" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`zopack serve -- Run the Zo Space Bun SSR server locally from a .zopack.md pack

Usage:
  bun index.ts serve --file <pack.zopack.md> [options]
  bun index.ts --file <pack.zopack.md> [options] (default)

Options:
  -f, --file     Path to the .zopack.md file (required)
  --handle       Your zo.space handle for {{HANDLE}} replacement
  -p, --port     Port to listen on (default: 5173)
  -h, --help     Show this help`);
    process.exit(0);
  }

  if (!values.file) {
    console.error("Error: --file is required. Use --help for serve.");
    process.exit(1);
  }

  const port = parseInt(values.port || "5173", 10);

  try {
    const { packFile, manifest } = await loadPackForServe(values.file, values.handle);

    await serveZoSpace({
      manifest,
      port,
      packFile,
      reloadPack: () => reloadPackForServe(values.file!, packFile, values.handle),
    });
  } catch (err: any) {
    console.error(`Serve failed: ${err.message}`);
    process.exit(1);
  }

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
