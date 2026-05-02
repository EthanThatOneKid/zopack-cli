import { glob } from "bun";
import React from "react";
import { renderToString } from "react-dom/server";

console.log("Zo Space Bun SSR server listening on http://localhost:5173/");

Bun.serve({
  port: 5173,
  async fetch(req) {
    const url = new URL(req.url);

    const routeFiles = await glob("./routes/**/*.ts").scan();

    let matchedModule: any = null;
    for (const file of routeFiles) {
      const normalized = file.replaceAll("\\", "/");
      
      // API Route Match
      if (url.pathname.startsWith("/api/")) {
        const name = normalized.split("/routes/api/")[1]?.replace(".ts", "");
        if (name && url.pathname === `/api/${name}`) {
          matchedModule = await import(`./${normalized}`);
          break;
        }
      } else {
        // UI Page Match
        if (url.pathname === "/" && normalized.endsWith("routes/index.ts")) {
          matchedModule = await import(`./${normalized}`);
          break;
        }
        const name = normalized.split("/routes/")[1]?.replace(".ts", "");
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
