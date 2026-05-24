import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { ParsedPack } from "./import";

export function materializeSetupWorkspace(plan: ParsedPack, cwd = process.cwd()): string {
  const workspaceDir = join(cwd, ".zopack-workspace");
  mkdirSync(workspaceDir, { recursive: true });

  for (const dir of plan.directories) {
    mkdirSync(join(workspaceDir, dir), { recursive: true });
  }

  for (const file of plan.files) {
    const fullPath = join(workspaceDir, file.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    if (!existsSync(fullPath)) {
      writeFileSync(fullPath, file.content, "utf8");
    }
  }

  return workspaceDir;
}
