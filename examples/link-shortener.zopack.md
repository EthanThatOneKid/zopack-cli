---
format: zopack
version: "1.0"
name: link-shortener
description: "Personal URL shortener with a creation form and redirect API"
author: unknown.zo.computer
routes: 3
exported: 2026-05-24
---

# link-shortener

Personal URL shortener with a creation form and redirect API

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function ShortenerPage() {
  const [url, setUrl] = React.useState("");
  const [links, setLinks] = React.useState<any[]>([]);
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/links").then((r) => r.json()).then((d) => setLinks(d.links || []));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.short_id) {
      setResult(`${window.location.origin}/api/links/${data.short_id}`);
      setUrl("");
      setLinks((prev) => [data, ...prev]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Link Shortener</h1>
          <p className="text-slate-400 mt-1">Paste a URL, get a short link</p>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/url"
            required
            className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-white placeholder-slate-500"
          />
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
          >
            Shorten
          </button>
        </form>

        {result && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 text-sm font-medium">Short link created:</p>
            <a href={result} className="text-green-300 underline break-all">{result}</a>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Recent links</h2>
          {links.length === 0 ? (
            <p className="text-slate-500">No links yet</p>
          ) : (
            <ul className="space-y-2">
              {links.slice(0, 20).map((link) => (
                <li key={link.short_id} className="flex justify-between items-center p-3 rounded-lg bg-slate-800">
                  <span className="text-blue-400 font-mono text-sm">{link.short_id}</span>
                  <span className="text-slate-400 text-sm truncate max-w-xs">{link.url}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

### `/api/links` (api, public)

```typescript
import { nanoid } from "nanoid";

export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/links.json";

  let links: any[] = [];
  try {
    links = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {}

  if (c.req.method === "GET") {
    return c.json({ links, count: links.length });
  }

  if (c.req.method === "POST") {
    const body = await c.req.json();
    if (!body.url) {
      return c.json({ error: "url is required" }, 400);
    }

    const entry = {
      short_id: nanoid(8),
      url: body.url,
      created_at: new Date().toISOString(),
      clicks: 0,
    };
    links.unshift(entry);
    fs.writeFileSync(dataPath, JSON.stringify(links, null, 2));
    return c.json(entry, 201);
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

### `/api/links/:id` (api, public)

```typescript
export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/links.json";
  const id = c.req.param("id");

  let links: any[] = [];
  try {
    links = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {}

  const link = links.find((l: any) => l.short_id === id);

  if (c.req.method === "GET") {
    if (!link) return c.json({ error: "Not found" }, 404);
    link.clicks = (link.clicks || 0) + 1;
    fs.writeFileSync(dataPath, JSON.stringify(links, null, 2));
    return c.redirect(link.url, 302);
  }

  if (c.req.method === "DELETE") {
    if (!link) return c.json({ error: "Not found" }, 404);
    const filtered = links.filter((l: any) => l.short_id !== id);
    fs.writeFileSync(dataPath, JSON.stringify(filtered, null, 2));
    return c.json({ deleted: id });
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `nanoid`

## Setup

**Directories to create:**
- `Data`

**Files to initialize:**
- `Data/links.json` with content: `[]`
