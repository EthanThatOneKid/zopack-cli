---
format: zopack
version: "1.0"
name: discord-bot-dashboard
description: "Monitoring dashboard for a Discord bot with status checks and command listing"
author: unknown.zo.computer
routes: 3
exported: 2026-05-24
---

# discord-bot-dashboard

Monitoring dashboard for a Discord bot with status checks and command listing

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function BotDashboard() {
  const [status, setStatus] = React.useState<any>(null);
  const [commands, setCommands] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus);
    fetch("/api/commands").then((r) => r.json()).then((d) => setCommands(d.commands || []));
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">
            B
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bot Dashboard</h1>
            <p className="text-slate-400 text-sm">Real-time monitoring</p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
            <p className={`text-lg font-semibold mt-1 ${status?.online ? "text-green-400" : "text-red-400"}`}>
              {status ? (status.online ? "Online" : "Offline") : "Loading..."}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Servers</p>
            <p className="text-lg font-semibold mt-1">{status?.guild_count ?? "—"}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Uptime</p>
            <p className="text-lg font-semibold mt-1">{status?.uptime ?? "—"}</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Registered commands</h2>
          {commands.length === 0 ? (
            <p className="text-slate-500">No commands registered yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {commands.map((cmd) => (
                <div key={cmd.name} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-mono text-sm">/{cmd.name}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">{cmd.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Recent activity</h2>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <p className="text-slate-400 text-sm">
              Last event: {status?.last_event || "No events logged"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

### `/api/status` (api, public)

```typescript
export default async function handler(c: any) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  const fs = await import("fs");
  const logDir = "/home/workspace/Data/logs";
  let lastEvent: string | null = null;
  try {
    const files = fs.readdirSync(logDir).sort().reverse();
    if (files.length > 0) {
      const content = fs.readFileSync(`${logDir}/${files[0]}`, "utf-8");
      const parsed = JSON.parse(content);
      lastEvent = `${parsed.type} at ${parsed.timestamp}`;
    }
  } catch {}

  let online = false;
  let guildCount = 0;
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });
    online = res.ok;
    if (online) {
      const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bot ${token}` },
      });
      if (guildsRes.ok) {
        const guilds = await guildsRes.json();
        guildCount = guilds.length;
      }
    }
  } catch {}

  const startTime = Date.now() - process.uptime() * 1000;
  const uptimeMs = Date.now() - startTime;
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);

  return c.json({
    online,
    guild_count: guildCount,
    guild_id: guildId,
    uptime: `${hours}h ${minutes}m`,
    last_event: lastEvent,
    checked_at: new Date().toISOString(),
  });
}
```

### `/api/commands` (api, public)

```typescript
export default async function handler(c: any) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  let commands: any[] = [];
  try {
    const url = guildId
      ? `https://discord.com/api/v10/applications/@me/guilds/${guildId}/commands`
      : `https://discord.com/api/v10/applications/@me/commands`;

    const res = await fetch(url, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (res.ok) {
      const raw = await res.json();
      commands = raw.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description || "No description",
        type: cmd.type === 1 ? "slash" : "other",
      }));
    }
  } catch {}

  return c.json({ commands, count: commands.length });
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `discord.js`

## Setup

**Directories to create:**
- `Data/logs`

**Secrets required** (configure in Settings > Advanced):
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
