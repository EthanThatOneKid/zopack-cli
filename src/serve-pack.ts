import { resolve } from "path";
import { importPack } from "./import";
import { createPackManifest } from "./pack-manifest";
import { materializeSetupWorkspace } from "./setup-workspace";
import { warnMissingNpmDeps } from "./serve";
import { registerZopackPlugin, setActivePack, setWorkspaceRoot } from "./zopack-plugin";

export async function loadPackForServe(file: string, handle?: string) {
  registerZopackPlugin();

  const plan = await importPack({ file, handle });
  if (!plan) {
    throw new Error("Failed to load pack.");
  }

  setActivePack(plan);
  setWorkspaceRoot(materializeSetupWorkspace(plan));
  warnMissingNpmDeps(plan.npm_deps);

  const packFile = resolve(process.cwd(), file);
  return {
    plan,
    packFile,
    manifest: createPackManifest(plan, packFile),
  };
}

export async function reloadPackForServe(file: string, packFile: string, handle?: string) {
  const plan = await importPack({ file, handle });
  if (!plan) {
    throw new Error("Failed to reload pack.");
  }

  setActivePack(plan);
  materializeSetupWorkspace(plan);
  return createPackManifest(plan, packFile);
}
