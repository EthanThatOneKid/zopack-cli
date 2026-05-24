import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parsePackFromContent, parseRoutes, parseVariables } from "./import";

const EXAMPLE_PACK = resolve(import.meta.dir, "../examples/example-pack.zopack.md");

describe("zopack parser", () => {
  test("parses Variables section from spec format", () => {
    const body = `
## Variables

| Placeholder | Description |
|---|---|
| \`{{HANDLE}}\` | Your zo.space handle |
`;

    expect(parseVariables(body)).toEqual([
      { placeholder: "{{HANDLE}}", description: "Your zo.space handle" },
    ]);
  });

  test("parsePackFromContent rejects non-zopack files", () => {
    expect(() => parsePackFromContent("---\nformat: other\n---\n")).toThrow("missing format: zopack");
  });

  test("parses example-pack routes with CRLF line endings", () => {
    const raw = readFileSync(EXAMPLE_PACK, "utf-8");
    const plan = parsePackFromContent(raw);

    expect(plan.routes.map((route) => [route.path, route.route_type])).toEqual([
      ["/", "page"],
      ["/api/hello", "api"],
    ]);
  });

  test("parseRoutes handles CRLF fenced code blocks", () => {
    const body = "### `/` (page, public)\r\n\r\n```tsx\r\ncode\r\n```\r\n";
    expect(parseRoutes(body)).toEqual([
      { path: "/", route_type: "page", public: true, code: "code" },
    ]);
  });
});
