---
format: zopack
version: "1.0"
name: example-pack
description: "An example Zo pack containing index and hello routes"
author: unknown.zo.computer
routes: 2
exported: 2026-05-06
---

# example-pack

An example Zo pack containing index and hello routes

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function IndexPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
        Welcome to your Zo Space
      </h1>
      <p className="text-gray-400 text-lg">
        This is an example space route served with local SSR via zopack.
      </p>
      <button className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 font-semibold transition-all">
        Interact
      </button>
    </div>
  );
}
```

### `/api/hello` (api, public)

```typescript
export default async function handler(c: any) {
  const name = c.req.query("name") || "World";
  return c.json({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    env_check: process.env.DATABASE_URL ? "Configured" : "Missing"
  });
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `react`

## Setup

**Secrets required** (configure in Settings > Advanced):
- `DATABASE_URL`

