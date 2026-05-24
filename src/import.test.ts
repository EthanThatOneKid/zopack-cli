import { describe, expect, test } from "bun:test";
import { parsePackFromContent, parseVariables } from "./import";

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
});
