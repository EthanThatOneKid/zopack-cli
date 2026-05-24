# Zopack CLI

A standalone Bun CLI for **packaging**, **importing**, and **locally emulating** Zo Computer spaces — `zopack export`, `zopack import`, and `zopack serve`.

## Workflow

```
Zo export → .zopack.md → zopack serve --file pack.zopack.md → edit pack → push → Zo pull + update
```

1. **create in Zo** — create the space and the GitHub repo from Zo, using natural language if you want
2. **clone locally** — move to a physical machine and clone the repo with `git clone`
3. **preview** — review the pack with `zopack import --file <pack>.zopack.md --preview`
4. **serve** — run routes directly from the pack with `zopack serve --file <pack>.zopack.md`
5. **edit locally** — edit route code inside the `.zopack.md` file (or re-export from Zo)
6. **push** — commit and push the local changes back to GitHub
7. **pull in Zo** — tell Zo to pull the GitHub changes and update the live Zo space to match

Route code lives inside the pack. Bun plugins load routes as virtual in-memory modules — no `routes/` directory is required.

## Install

### Local development (this repo)

```bash
bun install
bun src/index.ts serve --file examples/example-pack.zopack.md
```

### Global install (use from any Zo space repo)

```bash
cd /path/to/zopack-cli
bun install
bun link
```

Verify:

```bash
zopack --help
zopack serve --file my-space.zopack.md
```

`bun link` registers this package and links the `zopack` binary into Bun's global bin directory. Run `bun pm bin -g` to find it. On Windows, add that directory to your user `PATH` and open a new terminal if `zopack` is not found.

## Local development tutorial

This tutorial is the intended workflow for working on Zo spaces without treating Zo.computer as a lock-in point. The idea is to let Zo do the setup, then do the actual day-to-day source editing on a physical machine, with GitHub as the bridge.

### Create space and repository in Zo

Start by telling Zo what you want in plain language. For example:

```text
Create a Zo space for my project and create a GitHub repo for it so we can keep the source in sync.
```

Zo should create the space and the repo, then establish the initial project shape you want to work with.

### Clone repository on local machine

Move to your physical machine and clone the repo that Zo created:

```bash
git clone git@github.com:<owner>/<repo>.git
cd <repo>
```

If you prefer HTTPS, use that instead. The point is to get the repo onto a machine where you can work even if Zo is temporarily unavailable, offline, or slow.

### Preview and serve the pack locally

Review the pack before serving (especially for packs from untrusted sources):

```bash
zopack import --file <pack-name>.zopack.md --handle <your-handle> --preview
```

Start the local emulator directly from the pack:

```bash
zopack serve --file <pack-name>.zopack.md --handle <your-handle>
```

The server watches the pack file and reloads routes when you save changes.

### Make visual or behavior changes locally

Edit route code inside the `.zopack.md` file (inside the fenced code blocks under `## Routes`), or re-export from Zo and replace the pack.

Example flow:

```bash
# edit my-space.zopack.md
zopack serve --file my-space.zopack.md
```

If you see React hook errors in a demo page, simplify the component to a plain render first. This repo's local emulator is happiest when the route is straightforward and hook-free.

Verify the result locally, then commit it.

```bash
git add .
git commit -m "Update Zo space locally"
git push
```

### Go back to Zo and sync live space

Tell Zo to pull the updated GitHub state and apply it back to the live space. In plain language, something like:

```text
Pull the latest GitHub changes and update the Zo space to match the local edits.
```

The goal is to keep GitHub and Zo in sync so the local repo remains the durable working copy and Zo remains the live deployment target.

### Repeat as needed

Once this loop is established, you can keep moving back and forth:

1. Zo for creating or updating the live space
2. Local machine for editing, serving, and testing
3. GitHub for sync, history, and recovery

That gives you a practical Zo space workflow that still works when Zo is unavailable for a while, when the network is flaky, or when you want to work directly against the pack instead of driving everything through natural language.

## Commands

### `zopack export`

```bash
echo '<routes json>' | zopack export --name my-space
```

Reads a JSON array of route objects:
```json
[{ "path": "/api/hello", "route_type": "api", "public": true, "code": "..." }]
```

### `zopack import`

```bash
# Preview the plan
zopack import --file my-space.zopack.md --preview

# Output full JSON plan for Zo agent deployment
zopack import --file my-space.zopack.md --handle etok
```

`zopack import` outputs a JSON deployment plan for Zo agents. It does not start a server.

### `zopack serve` local emulator

```bash
zopack serve --file my-space.zopack.md              # default port 5173
zopack serve --file my-space.zopack.md --port 8080  # custom port
zopack serve --file my-space.zopack.md --handle etok
```

Serves routes from a `.zopack.md` pack via Bun plugins. Setup directories and files from the pack's `## Setup` section are materialized into `.zopack-workspace/` (data scaffolding only — route code stays virtual).

| Route in pack | Virtual module |
|------|-------|
| `/` (page) | `zopack-route:///index.tsx` |
| `/about` (page) | `zopack-route:///about.tsx` |
| `/api/hello` (api) | `zopack-route:///api/hello.ts` |
| `/api/users/:id` (api) | `zopack-route:///api/users/:id.ts` |

**Route restrictions:**
- `:param` dynamic segments only — `[param]` (Next.js style) is rejected
- Duplicate route paths are rejected at startup
- API routes use real Hono (matches zo.space production exactly)
- Page routes are bundled for client-side rendering

## Development

```bash
bun test   # run pack manifest and serve tests
bun examples/emulate.ts   # export → import → build round trip
bun src/index.ts serve --file examples/example-pack.zopack.md
```

## Project structure

```
src/
  index.ts              # CLI entrypoint (export, import, serve commands)
  export.ts             # export command logic
  import.ts             # import command logic
  zopack-plugin.ts      # Bun plugin for .zopack.md and virtual route modules
  pack-manifest.ts      # route manifest from ParsedPack
  pack-path.ts          # workspace and pack path resolution
  route-types.ts        # route manifest types
  route-manifest.ts     # route matching
  route-utils.ts        # shared route validation helpers
  serve-pack.ts         # pack loading for local serve
  setup-workspace.ts    # materialize pack Setup section locally
  serve.ts              # production-faithful local server (Hono + React)
examples/
  example-pack.zopack.md
  routes.json           # sample route JSON for export demos
globals.d.ts            # TypeScript declarations for *.zopack.md imports
```
