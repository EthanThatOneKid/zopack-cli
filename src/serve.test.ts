import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { importPack } from "./import";
import { createPackManifest } from "./pack-manifest";
import { buildClientBundles } from "./serve";
import { registerPack, unregisterPack, registerZopackPlugin } from "./zopack-plugin";

registerZopackPlugin();

const tempRoots: string[] = [];
const EXAMPLE_PACK = resolve(import.meta.dir, "../examples/example-pack.zopack.md");
const TEST_SLUG = "test";

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
  unregisterPack(TEST_SLUG);
});

describe("client bundles", () => {
  test("builds page routes from a zopack pack", async () => {
    const plan = await importPack({ file: EXAMPLE_PACK });
    registerZopackPlugin();
    registerPack(TEST_SLUG, plan!, null);

    const manifest = createPackManifest(plan!, EXAMPLE_PACK, TEST_SLUG);
    const buildDir = mkdtempSync(join(tmpdir(), "zopack-build-"));
    tempRoots.push(buildDir);

    const bundles = await buildClientBundles(manifest, buildDir);
    const bundle = bundles.get("/");

    expect(bundle).toBeDefined();
    expect(existsSync(bundle!.file)).toBe(true);
    expect(bundle!.file.endsWith(".js")).toBe(true);
  });

  test("builds page routes that import from https URLs", async () => {
    const plan = {
      meta: { format: "zopack" },
      routes: [
        {
          path: "/three-page",
          route_type: "page" as const,
          public: true,
          code: `import * as THREE from "https://esm.sh/three@0.175.0";
export default function ThreePage() {
  return <main>{String(!!THREE.Scene)}</main>;
}`,
        },
      ],
      npm_deps: [],
      shadcn_components: [],
      directories: [],
      files: [],
      secrets: [],
      variables: [],
    };

    registerZopackPlugin();
    registerPack(TEST_SLUG, plan, null);

    const manifest = createPackManifest(plan, "three-pack.zopack.md", TEST_SLUG);
    const buildDir = mkdtempSync(join(tmpdir(), "zopack-build-"));
    tempRoots.push(buildDir);

    const bundles = await buildClientBundles(manifest, buildDir);
    expect(bundles.get("/three-page")).toBeDefined();
  });
});
