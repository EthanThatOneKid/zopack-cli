# Zopack CLI

A standalone, powerful **Bun-powered CLI** for packaging, importing, previewing, and server-side rendering (SSR) **Zo Computer** routes.

## 🚀 Features

- **Unified CLI Tool**: One entry point for packaging (`export`), previewing/deploying (`import`), and local hosting (`serve`).
- **Real-Time SSR (Server-Side Rendering)**: Instantly compiles and renders React/TSX page components on-the-fly to static HTML.
- **Hono-Like API Routing**: Invokes `.ts` API modules on-the-fly, passing a streamlined Hono-like Context `c`.
- **Intelligent Package Detection**: Automatic dependency checking (filtering against base `zo.space` packages), Shadcn/AnimateUI component detection, filesystem directory structure extraction, and environment variable secret harvesting.

## 📂 Project structure

```text
zopack-cli/
├── src/                        # 🛠️ Core Source Scripts
│   ├── index.ts                # 🚀 Unified CLI Entrypoint
│   ├── export.ts               # Core zopack packaging logic
│   └── import.ts               # Core zopack extraction & plan logic
│
├── examples/                   # 📂 Examples Directory
│   ├── routes/                 # Example UI and API Routes
│   │   ├── index.tsx           # UI Route (React SSR)
│   │   └── api/
│   │       └── hello.ts        # API Route (Hono-like endpoint)
│   ├── routes.json             # Example routes JSON descriptor
│   └── example-pack.zopack.md  # Generated example pack file
│
├── package.json                # Project manifest
└── SKILL.md                    # Zo Agent Skill document
```

## 📦 Usage

### 1. Installation
Ensure you have [Bun](https://bun.sh/) installed locally, then set up the workspace:
```bash
# Clone the repository
git clone https://github.com/EthanThatOneKid/zopack-cli.git
cd zopack-cli

# Install dependencies
bun install
```

### 2. Export / package routes (`export`)
Pack your space routes into a single `.zopack.md` file:
```bash
# Pipes a routes JSON descriptor into the CLI to generate a package
cat examples/routes.json | bun src/index.ts export --name "example-pack" --description "An example pack" --output "examples/example-pack.zopack.md"
```

### 3. Import / preview pack (`import`)
Preview a `.zopack.md` deployment plan before deploying:
```bash
bun src/index.ts import --file "examples/example-pack.zopack.md" --preview
```

Generate the full JSON deployment plan for the Zo space system to consume:
```bash
bun src/index.ts import --file "examples/example-pack.zopack.md"
```

### 4. Serve / local SSR preview (`serve`)
Run the Zo Space Bun SSR server locally. By default, it will check for `./routes` and fallback automatically to `./examples/routes` for a plug-and-play development experience:
```bash
# Starts the server on default port 5173
bun start

# Or start on a custom port
bun src/index.ts serve --port 8080
```

`serve` builds a strict route manifest before binding the local server. Route files are mapped to zo.space paths, validated, and rejected early if they would drift from production behavior:

- `routes/index.tsx` -> `/`
- `routes/about.tsx` -> `/about`
- `routes/blog/index.tsx` -> `/blog`
- `routes/api/hello.ts` -> `/api/hello`
- `routes/api/users/:id.ts` -> `/api/users/:id`

Next.js-style bracket params such as `[id].ts` are intentionally rejected. zo.space uses Hono-style `:id` route params.

## 🛠️ Local development guide

Developing Zo Spaces locally is incredibly easy and fast thanks to Bun's native on-the-fly execution and automatic reloading.

### 1. Adding a new UI route (React SSR)
Simply create a React component file inside `examples/routes/` with a default export. For example, create `examples/routes/dashboard.tsx`:
```tsx
import React from "react";

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Local Dashboard</h1>
      <p>This is a new page rendered live via local SSR!</p>
    </div>
  );
}
```
* Access it instantly at `http://localhost:5173/dashboard`. Any edits are picked up instantly on every reload!

### 2. Adding a new API route
Create a `.ts` file inside `examples/routes/api/` with a default handler function accepting a Hono-like Context `c`. For example, create `examples/routes/api/users.ts`:
```typescript
export default function handler(c: any) {
  return c.json({
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" }
    ]
  });
}
```
* Access it instantly at `http://localhost:5173/api/users`.

### 3. Emulating Zo agent packaging & deployment
We provide an interactive script that emulates the complete Zo Agent export/import flow locally:
```bash
bun examples/emulate.ts
```
This script queries your local routes, packages them using `exportPack` into a `.zopack.md` file, performs a security static analysis, and simulates deploying them back onto the filesystem substrate!

## 🎯 Verification

Test your local running SSR server:
- **UI Route (SSR)**: Open `http://localhost:5173/` in your browser.
- **API Route**: Open or fetch `http://localhost:5173/api/hello?name=Ethan`.
  ```json
  {"message":"Hello, Ethan!","timestamp":"2026-05-06T17:22:14.041Z","env_check":"Missing"}
  ```

## 📄 Acknowledgements

The core import/export packaging logic and specification are based on the original:
- [Original Zo Community zopack skill](https://github.com/zocomputer/skills/blob/main/Community/zopack/SKILL.md)
