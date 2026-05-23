import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRouteManifest } from "./route-manifest";
import { buildClientBundles } from "./serve";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe("client bundles", () => {
  test("builds page routes written as .ts with JSX", async () => {
    const root = makeRoutes({
      "index.ts": `export default function Home() {
  return <main>ok</main>;
}`,
    });

    const manifest = createRouteManifest(root);
    const buildDir = mkdtempSync(join(tmpdir(), "zopack-build-"));
    tempRoots.push(buildDir);

    const bundles = await buildClientBundles(manifest, buildDir);
    const bundle = bundles.get("/");

    expect(bundle).toBeDefined();
    expect(existsSync(bundle!.file)).toBe(true);
    expect(bundle!.file.endsWith(".js")).toBe(true);
  });

  test("builds page routes that import from https URLs", async () => {
    const root = makeRoutes({
      "three-page.tsx": `import * as THREE from "https://esm.sh/three@0.175.0";
export default function ThreePage() {
  return <main>{String(!!THREE.Scene)}</main>;
}`,
    });

    const manifest = createRouteManifest(root);
    const buildDir = mkdtempSync(join(tmpdir(), "zopack-build-"));
    tempRoots.push(buildDir);

    const bundles = await buildClientBundles(manifest, buildDir);
    expect(bundles.get("/three-page")).toBeDefined();
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
