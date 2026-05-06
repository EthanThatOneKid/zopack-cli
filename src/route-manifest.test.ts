import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRouteManifest, matchRoute } from "./route-manifest";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("route manifest", () => {
  test("maps local route files to zo.space paths", () => {
    const root = makeRoutes({
      "index.tsx": "export default function Home() {}",
      "about.tsx": "export default function About() {}",
      "blog/index.tsx": "export default function Blog() {}",
      "blog/post.tsx": "export default function Post() {}",
      "api/hello.ts": "export default function Hello() {}",
    });

    const manifest = createRouteManifest(root);
    expect(manifest.entries.map((entry) => [entry.path, entry.route_type])).toEqual([
      ["/about", "page"],
      ["/api/hello", "api"],
      ["/blog", "page"],
      ["/blog/post", "page"],
      ["/", "page"],
    ]);
  });

  test("matches Hono-style dynamic params", () => {
    const root = makeRoutes({
      "api/users/:id.ts": "export default function User() {}",
    });

    const manifest = createRouteManifest(root);
    const routeMatch = matchRoute(manifest, "/api/users/ethan", "api");

    expect(routeMatch?.entry.path).toBe("/api/users/:id");
    expect(routeMatch?.params).toEqual({ id: "ethan" });
  });

  test("rejects Next-style bracket params", () => {
    const root = makeRoutes({
      "api/users/[id].ts": "export default function User() {}",
    });

    expect(() => createRouteManifest(root)).toThrow("zo.space dynamic routes use \":param\"");
  });

  test("rejects ambiguous routes", () => {
    const root = makeRoutes({
      "blog.tsx": "export default function BlogOne() {}",
      "blog/index.tsx": "export default function BlogTwo() {}",
    });

    expect(() => createRouteManifest(root)).toThrow("Ambiguous route");
  });
});

function makeRoutes(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zopack-routes-"));
  tempRoots.push(root);
  const routesDir = join(root, "routes");

  for (const [file, content] of Object.entries(files)) {
    const fullPath = join(routesDir, file);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }

  return root;
}

