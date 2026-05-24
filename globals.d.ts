declare module "*.zopack.md" {
  import type { ParsedPack } from "./src/import";
  const pack: ParsedPack;
  export default pack;
}
