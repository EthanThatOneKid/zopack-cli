# Zopack CLI

A standalone Bun CLI for **packaging**, **importing**, and **locally emulating** Zo Computer spaces — `zopack export`, `zopack import`, and `zopack serve`.

## Workflow

```
zo.space (export) → .zopack.md → GitHub → Clone locally → zopack serve
```

1. **export** — Package your live zo.space routes into a `.zopack.md` file
2. **push to GitHub** — Share or backup the pack
3. **clone locally** — `git clone` the repo onto your machine
4. **import** — Parse the `.zopack.md` and write routes to `routes/`
5. **serve** — Run a production-faithful local emulator

## Install

```bash
bun install
```

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
bun src/index.ts import --file my-space.zopack.md --preview

# Output full JSON plan (for Zo agent consumption)
bun src/index.ts import --file my-space.zopack.md --handle etok
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
