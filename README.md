# zopack-cli

Standalone single-file **Bun** CLI tool for local development, previewing, and serving Zo spaces stored using the zopack pattern.

## Features

- **Dynamic imports**: Discovers your local route files on the fly via Bun's native globbing.
- **Support for API routes**: For files matching `/api/*`, invokes matching modules with a Hono-like Context object `c`.
- **SSR for UI routes**: Uses React's `renderToString` on the fly to render page components to fully static HTML string instantly.

## Usage

Ensure you have [Bun](https://bun.sh/) installed locally.

```bash
# Clone the repository
git clone https://github.com/EthanThatOneKid/zopack-cli.git
cd zopack-cli

# Run local Zo Space routes
bun start
```
