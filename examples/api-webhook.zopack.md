---
format: zopack
version: "1.0"
name: api-webhook
description: "Incoming webhook receiver that validates signatures and forwards payloads to Slack"
author: unknown.zo.computer
routes: 2
exported: 2026-05-24
---

# api-webhook

Incoming webhook receiver that validates signatures and forwards payloads to Slack

## Routes

### `/api/webhook` (api, public)

```typescript
export default async function handler(c: any) {
  const secret = process.env.WEBHOOK_SECRET;
  const slackUrl = process.env.SLACK_URL;

  if (c.req.method === "GET") {
    return c.json({ status: "healthy", accepting: true });
  }

  const signature = c.req.header("x-webhook-signature") || "";
  if (!secret || signature !== secret) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const body = await c.req.json();
  const event = {
    type: body.type || "unknown",
    payload: body,
    received_at: new Date().toISOString(),
  };

  const fs = await import("fs");
  const logPath = "/home/workspace/Data/webhook-logs.json";
  let logs: any[] = [];
  try {
    logs = JSON.parse(fs.readFileSync(logPath, "utf-8"));
  } catch {}
  logs.push(event);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

  if (slackUrl) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Webhook received: ${event.type} at ${event.received_at}`,
      }),
    });
  }

  return c.json({ received: true, event_type: event.type });
}
```

### `/api/webhook/status` (api, public)

```typescript
export default async function handler(c: any) {
  const fs = await import("fs");
  const logPath = "/home/workspace/Data/webhook-logs.json";
  let logs: any[] = [];
  try {
    logs = JSON.parse(fs.readFileSync(logPath, "utf-8"));
  } catch {}

  const recent = logs.slice(-10).reverse();
  return c.json({
    total_received: logs.length,
    recent_events: recent,
    last_received: recent[0]?.received_at || null,
  });
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `crypto`

## Setup

**Directories to create:**
- `Data`

**Files to initialize:**
- `Data/webhook-logs.json` with content: `[]`

**Secrets required** (configure in Settings > Advanced):
- `WEBHOOK_SECRET`
- `SLACK_URL`
