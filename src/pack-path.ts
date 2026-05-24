import { existsSync } from "fs";

export function resolveWorkspaceDir(): string {
  return existsSync("/home/workspace") ? "/home/workspace" : process.cwd();
}

export function resolvePackPath(file: string): string {
  if (file.startsWith("/") || file.includes(":")) {
    return file;
  }
  return `${resolveWorkspaceDir()}/${file}`;
}
