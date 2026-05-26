import { resolve } from "path";
import { importPack } from "./import";
import { createPackManifest } from "./pack-manifest";
import { materializeSetupWorkspace } from "./setup-workspace";
import { warnMissingNpmDeps } from "./serve";
import { registerPack, registerZopackPlugin } from "./zopack-plugin";

export function slugifyPackName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "_default";
}

export async function loadPackForServe(file: string, handle?: string, slugOverride?: string) {
  registerZopackPlugin();

  const plan = await importPack({ file, handle });
  if (!plan) {
    throw new Error("Failed to load pack.");
  }

  const slug = slugOverride ?? slugifyPackName(plan.meta.name ?? "_default");
  const workspaceRoot = materializeSetupWorkspace(plan);
  registerPack(slug, plan, workspaceRoot);
  warnMissingNpmDeps(plan.npm_deps);

  const packFile = resolve(process.cwd(), file);
  return {
    slug,
    plan,
    packFile,
    manifest: createPackManifest(plan, packFile, slug),
  };
}

export async function reloadPackForServe(file: string, packFile: string, slug: string, handle?: string) {
  const plan = await importPack({ file, handle });
  if (!plan) {
    throw new Error("Failed to reload pack.");
  }

  const workspaceRoot = materializeSetupWorkspace(plan);
  registerPack(slug, plan, workspaceRoot);
  return createPackManifest(plan, packFile, slug);
}
