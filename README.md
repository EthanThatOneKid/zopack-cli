# Zopack CLI

A standalone Bun CLI for **packaging**, **importing**, and **locally emulating** Zo Computer spaces — `zopack export`, `zopack import`, and `zopack serve`.

## Workflow

```
Zo (create space + repo) → GitHub repo → Clone locally → import → serve → edit locally → push → Zo pull + update
```

1. **create in Zo** — create the space and the GitHub repo from Zo, using natural language if you want
2. **clone locally** — move to a physical machine and clone the repo with `git clone`
3. **import** — parse the pack locally with `zopack import`, then materialize the matching `routes/` files
4. **serve** — run the imported routes locally with `zopack serve`
5. **edit locally** — make surgical source changes in `routes/`
6. **push** — commit and push the local changes back to GitHub
7. **pull in Zo** — tell Zo to pull the GitHub changes and update the live Zo space to match

## Install

```bash
bun install
```

## Local Development Tutorial

This tutorial is the intended workflow for working on Zo spaces without treating Zo.computer as a lock-in point. The idea is to let Zo do the setup, then do the actual day-to-day source editing on a physical machine, with GitHub as the bridge.

### 1. Create the space and repo in Zo

Start by telling Zo what you want in plain language. For example:

```text
Create a Zo space for my project and create a GitHub repo for it so we can keep the source in sync.
```

Zo should create the space and the repo, then establish the initial project shape you want to work with.

### 2. Clone the repo on a local machine

Move to your physical machine and clone the repo that Zo created:

```bash
git clone git@github.com:<owner>/<repo>.git
cd <repo>
```

If you prefer HTTPS, use that instead. The point is to get the repo onto a machine where you can work even if Zo is temporarily unavailable, offline, or slow.

### 3. Restore the Zo space source locally

Run `zopack import` from a checkout of this CLI repo, or point at this repo explicitly from your project clone:

```bash
bun /home/workspace/code/github.com/EthanThatOneKid/zopack-cli/src/index.ts import --file <pack-name>.zopack.md --handle <your-handle> --preview
```

That command prints a JSON plan. It does not write files by itself, so use the plan to create the matching `routes/` files in your project repo.

Route paths map to filenames like this:

- `/` -> `routes/index.tsx`
- `/about` -> `routes/about.tsx`
- `/zo-space-10print` -> `routes/zo-space-10print.tsx`
- `/api/hello` -> `routes/api/hello.ts`

At this point, the repo should contain the route files you need to work on locally.

### 4. Run the imported routes locally

Start the local emulator:

```bash
bun src/index.ts serve
```

This gives you a local Zo-like environment where you can edit and verify the route source files without depending on the cloud being available.

### 5. Make a visual or behavior change locally

Edit the route files directly in `routes/`. Keep the changes surgical and source-driven. This is the part where you work like a normal local codebase instead of relying on natural language for every change.

Example flow:

```bash
# edit routes/index.tsx
bun src/index.ts serve
```

If you see React hook errors in a demo page, simplify the component to a plain render first. This repo's local emulator is happiest when the route is straightforward and hook-free.

Verify the result locally, then commit it.

```bash
git add .
git commit -m "Update Zo space locally"
git push
```

### 6. Go back to Zo and sync the live space

Tell Zo to pull the updated GitHub state and apply it back to the live space. In plain language, something like:

```text
Pull the latest GitHub changes and update the Zo space to match the local edits.
```

The goal is to keep GitHub and Zo in sync so the local repo remains the durable working copy and Zo remains the live deployment target.

### 7. Repeat as needed

Once this loop is established, you can keep moving back and forth:

1. Zo for creating or updating the live space
2. Local machine for editing, serving, and testing
3. GitHub for sync, history, and recovery

That gives you a practical Zo space workflow that still works when Zo is unavailable for a while, when the network is flaky, or when you want to work directly against source files instead of driving everything through natural language.

## Commands

### `zopack export`

```bash
echo '<routes json>' | bun src/index.ts export --name my-space
```

Reads a JSON array of route objects:
```json
[{ "path": "/api/hello", "route_type": "api", "public": true, "code": "..." }]
```

### `zopack import`

```bash
# Preview the plan
bun /home/workspace/code/github.com/EthanThatOneKid/zopack-cli/src/index.ts import --file my-space.zopack.md --preview

# Output full JSON plan for local or automated use
bun /home/workspace/code/github.com/EthanThatOneKid/zopack-cli/src/index.ts import --file my-space.zopack.md --handle etok
```

### `zopack serve` — Local zo.space emulator

```bash
bun src/index.ts serve              # default port 5173
bun src/index.ts serve --port 8080  # custom port
```

Serves the local `routes/` directory with production-faithful behavior:

| File | Route |
|------|-------|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/blog/index.tsx` | `/blog` |
| `routes/api/hello.ts` | `/api/hello` |
| `routes/api/users/:id.ts` | `/api/users/:id` |

**Route restrictions:**
- `:param` dynamic segments only — `[param]` (Next.js style) is rejected
- Duplicate route paths are rejected at startup
- API routes use real Hono (matches zo.space production exactly)
- Page routes are bundled with React Router for client-side routing

## Development

```bash
bun test   # run route manifest tests
bun start  # start serve (alias: bun src/index.ts serve)
```

## Project structure

```
src/
  index.ts              # CLI entrypoint (export, import, serve commands)
  export.ts             # export command logic
  import.ts             # import command logic
  route-manifest.ts     # route discovery + :param validation + duplicate detection
  route-manifest.test.ts
  serve.ts              # production-faithful local server (Hono + React Router)
examples/
  routes/               # example routes (index.tsx + api/hello.ts)
```
