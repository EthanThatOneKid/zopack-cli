---
format: zopack
version: "1.0"
name: dashboard-app
description: "Personal habit tracker with a public dashboard and private settings page"
author: unknown.zo.computer
routes: 4
exported: 2026-05-24
---

# dashboard-app

Personal habit tracker with a public dashboard and private settings page

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function DashboardPage() {
  const [entries, setEntries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold">Habit Tracker</h1>
        <p className="text-slate-400 mt-1">Daily progress at a glance</p>
      </header>
      <main className="max-w-4xl mx-auto">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-500">No entries yet. Add one via the API.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{entry.habit}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${entry.done ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {entry.done ? "Done" : "Missed"}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{entry.date}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

### `/settings` (page, private)

```tsx
import React from "react";

export default function SettingsPage() {
  const [habits, setHabits] = React.useState("");

  const handleSave = async () => {
    const list = habits.split("\n").filter(Boolean);
    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "configure", habits: list }),
    });
    alert("Habits saved!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Habits (one per line)
          </label>
          <textarea
            value={habits}
            onChange={(e) => setHabits(e.target.value)}
            rows={6}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-white placeholder-slate-500"
            placeholder="Exercise\nRead 30 min\nMeditate"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
        >
          Save habits
        </button>
      </div>
    </div>
  );
}
```

### `/api/entries` (api, public)

```typescript
export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/entries.json";

  if (c.req.method === "GET") {
    let entries: any[] = [];
    try {
      entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    } catch {}
    return c.json({ entries, count: entries.length });
  }

  if (c.req.method === "POST") {
    const body = await c.req.json();
    let entries: any[] = [];
    try {
      entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    } catch {}

    const entry = {
      id: Date.now().toString(36),
      habit: body.habit || "Unknown",
      done: body.done ?? false,
      date: new Date().toISOString().split("T")[0],
    };
    entries.push(entry);
    fs.writeFileSync(dataPath, JSON.stringify(entries, null, 2));
    return c.json({ created: entry }, 201);
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

### `/api/entries/:id` (api, public)

```typescript
export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/entries.json";
  const id = c.req.param("id");

  let entries: any[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {}

  if (c.req.method === "GET") {
    const entry = entries.find((e: any) => e.id === id);
    if (!entry) return c.json({ error: "Not found" }, 404);
    return c.json(entry);
  }

  if (c.req.method === "DELETE") {
    const filtered = entries.filter((e: any) => e.id !== id);
    if (filtered.length === entries.length) {
      return c.json({ error: "Not found" }, 404);
    }
    fs.writeFileSync(dataPath, JSON.stringify(filtered, null, 2));
    return c.json({ deleted: id });
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `date-fns`

## Setup

**Directories to create:**
- `Data`

**Files to initialize:**
- `Data/entries.json` with content: `[]`

**Secrets required** (configure in Settings > Advanced):
- `DATABASE_URL`
