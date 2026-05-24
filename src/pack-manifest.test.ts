import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { importPack } from "./import";
import { createPackManifest } from "./pack-manifest";
import { matchRoute } from "./route-manifest";
import { buildApiModules, buildClientBundles } from "./serve";
import { registerZopackPlugin, setActivePack, setWorkspaceRoot } from "./zopack-plugin";

registerZopackPlugin();

const EXAMPLE_PACK = resolve(import.meta.dir, "../examples/example-pack.zopack.md");
const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
  setActivePack({
    meta: {},
    routes: [],
    npm_deps: [],
    shadcn_components: [],
    directories: [],
    files: [],
    secrets: [],
    variables: [],
  });
  setWorkspaceRoot(null);
});

describe("pack manifest", () => {
  test("maps pack routes to zo.space paths", async () => {
    const plan = await importPack({ file: EXAMPLE_PACK });
    expect(plan).toBeDefined();

    const manifest = createPackManifest(plan!, EXAMPLE_PACK);
    expect(manifest.entries.map((entry) => [entry.path, entry.route_type])).toEqual([
      ["/", "page"],
      ["/api/hello", "api"],
    ]);
    expect(manifest.entries.every((entry) => entry.importPath.startsWith("zopack-route:///"))).toBe(true);
  });

  test("matches Hono-style dynamic params from pack routes", async () => {
    const plan = {
      meta: { format: "zopack" },
      routes: [
        {
          path: "/api/users/:id",
          route_type: "api" as const,
          public: true,
          code: "export default async function handler(c) { return c.json({ id: c.req.param('id') }); }",
        },
      ],
      npm_deps: [],
      shadcn_components: [],
      directories: [],
      files: [],
      secrets: [],
      variables: [],
    };

    const manifest = createPackManifest(plan, "test-pack.zopack.md");
    const routeMatch = matchRoute(manifest, "/api/users/ethan", "api");

    expect(routeMatch?.entry.path).toBe("/api/users/:id");
    expect(routeMatch?.params).toEqual({ id: "ethan" });
  });

  test("rejects Next-style bracket params in pack routes", async () => {
    const plan = {
      meta: { format: "zopack" },
      routes: [
        {
          path: "/api/users/[id]",
          route_type: "api" as const,
          public: true,
          code: "export default async function handler(c) { return c.json({}); }",
        },
      ],
      npm_deps: [],
      shadcn_components: [],
      directories: [],
      files: [],
      secrets: [],
      variables: [],
    };

    expect(() => createPackManifest(plan, "test-pack.zopack.md")).toThrow('zo.space dynamic routes use ":param"');
  });

  test("rejects ambiguous pack routes", () => {
    const plan = {
      meta: { format: "zopack" },
      routes: [
        { path: "/about", route_type: "page" as const, public: true, code: "export default function A() {}" },
        { path: "/about", route_type: "page" as const, public: true, code: "export default function B() {}" },
      ],
      npm_deps: [],
      shadcn_components: [],
      directories: [],
      files: [],
      secrets: [],
      variables: [],
    };

    expect(() => createPackManifest(plan, "test-pack.zopack.md")).toThrow("Ambiguous route");
  });
});

describe("pack plugin integration", () => {
  test("loads example pack as virtual route modules", async () => {
    const plan = await importPack({ file: EXAMPLE_PACK });
    setActivePack(plan!);
    setWorkspaceRoot(null);

    const manifest = createPackManifest(plan!, EXAMPLE_PACK);
    const buildDir = mkdtempSync(join(tmpdir(), "zopack-plugin-"));
    tempRoots.push(buildDir);

    const apiImports = await buildApiModules(manifest, buildDir);
    const apiMod = await import(apiImports.get("/api/hello")!);
    expect(typeof apiMod.default).toBe("function");

    const bundles = await buildClientBundles(manifest, buildDir);
    expect(bundles.get("/")).toBeDefined();
  });
});
