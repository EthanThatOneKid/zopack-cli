import { describe, expect, test } from "bun:test";
import {
  analyzeUnmetDependencies,
  detectCrossSpaceCalls,
  detectLocalhostServices,
  detectMissingEnvVars,
  detectUndeclaredPaths,
} from "./dependency-warnings";
import type { ParsedPack } from "./import";

function makePack(overrides: Partial<ParsedPack> = {}): ParsedPack {
  return {
    meta: { format: "zopack" },
    routes: [],
    npm_deps: [],
    shadcn_components: [],
    directories: [],
    files: [],
    secrets: [],
    variables: [],
    ...overrides,
  };
}

describe("detectUndeclaredPaths", () => {
  test("flags paths not covered by directories or files", () => {
    const code = `const db = "/home/workspace/data/users.db";`;
    const warnings = detectUndeclaredPaths(code, "/api/users", [], []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toBe("/home/workspace/data/users.db");
    expect(warnings[0].route).toBe("/api/users");
  });

  test("does not flag paths covered by a declared directory", () => {
    const code = `const db = "/home/workspace/data/users.db";`;
    const warnings = detectUndeclaredPaths(code, "/api/users", ["data"], []);
    expect(warnings).toHaveLength(0);
  });

  test("does not flag paths covered by a declared file", () => {
    const code = `const config = "/home/workspace/config.json";`;
    const warnings = detectUndeclaredPaths(code, "/", [], ["config.json"]);
    expect(warnings).toHaveLength(0);
  });

  test("flags path when directory partially matches but is not a parent", () => {
    const code = `const f = "/home/workspace/data-backup/dump.sql";`;
    const warnings = detectUndeclaredPaths(code, "/api/db", ["data"], []);
    expect(warnings).toHaveLength(1);
  });

  test("handles multiple paths in the same route", () => {
    const code = `
      const a = "/home/workspace/alpha/one.json";
      const b = "/home/workspace/beta/two.json";
    `;
    const warnings = detectUndeclaredPaths(code, "/", ["alpha"], []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toBe("/home/workspace/beta/two.json");
  });
});

describe("detectLocalhostServices", () => {
  test("detects http://localhost:PORT", () => {
    const code = `fetch("http://localhost:3000/api/data")`;
    const warnings = detectLocalhostServices(code, "/api/proxy");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toBe("http://localhost:3000/api/data");
  });

  test("detects postgres connection strings", () => {
    const code = `const db = "postgres://localhost:5432/mydb";`;
    const warnings = detectLocalhostServices(code, "/api/db");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toContain("postgres://localhost");
  });

  test("detects redis connection strings", () => {
    const code = `const redis = "redis://localhost:6379";`;
    const warnings = detectLocalhostServices(code, "/api/cache");
    expect(warnings).toHaveLength(1);
  });

  test("detects websocket URLs", () => {
    const code = `new WebSocket("ws://localhost:8080/ws")`;
    const warnings = detectLocalhostServices(code, "/");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toBe("ws://localhost:8080/ws");
  });

  test("detects 127.0.0.1 variants", () => {
    const code = `fetch("http://127.0.0.1:4000/health")`;
    const warnings = detectLocalhostServices(code, "/api/health");
    expect(warnings).toHaveLength(1);
  });

  test("deduplicates identical URLs", () => {
    const code = `
      fetch("http://localhost:3000/a");
      fetch("http://localhost:3000/a");
    `;
    const warnings = detectLocalhostServices(code, "/");
    expect(warnings).toHaveLength(1);
  });

  test("returns nothing when no localhost references", () => {
    const code = `fetch("https://api.example.com/data")`;
    const warnings = detectLocalhostServices(code, "/");
    expect(warnings).toHaveLength(0);
  });
});

describe("detectCrossSpaceCalls", () => {
  test("detects calls to other zo.space handles", () => {
    const code = `fetch("https://alice.zo.space/api/feed")`;
    const warnings = detectCrossSpaceCalls(code, "/api/aggregate");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toBe("https://alice.zo.space/api/feed");
  });

  test("ignores {{HANDLE}} self-references", () => {
    const code = `fetch("https://{{HANDLE}}.zo.space/api/self")`;
    const warnings = detectCrossSpaceCalls(code, "/");
    expect(warnings).toHaveLength(0);
  });

  test("detects multiple different cross-space calls", () => {
    const code = `
      fetch("https://alice.zo.space/api/a");
      fetch("https://bob.zo.space/api/b");
    `;
    const warnings = detectCrossSpaceCalls(code, "/");
    expect(warnings).toHaveLength(2);
  });

  test("deduplicates identical URLs", () => {
    const code = `
      fetch("https://alice.zo.space/api/a");
      fetch("https://alice.zo.space/api/a");
    `;
    const warnings = detectCrossSpaceCalls(code, "/");
    expect(warnings).toHaveLength(1);
  });
});

describe("detectMissingEnvVars", () => {
  test("flags env vars that are not set", () => {
    const code = `const key = process.env.SOME_UNLIKELY_TEST_VAR_XYZ_123;`;
    const warnings = detectMissingEnvVars(code, "/api/pay", []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toContain("SOME_UNLIKELY_TEST_VAR_XYZ_123");
    expect(warnings[0].detail).toContain("undeclared");
  });

  test("marks declared secrets differently from undeclared ones", () => {
    const code = `const key = process.env.SOME_UNLIKELY_TEST_VAR_XYZ_456;`;
    const warnings = detectMissingEnvVars(code, "/api/pay", ["SOME_UNLIKELY_TEST_VAR_XYZ_456"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toContain("declared in ## Setup");
  });

  test("ignores well-known env vars", () => {
    const code = `
      const port = process.env.PORT;
      const env = process.env.NODE_ENV;
      const home = process.env.HOME;
    `;
    const warnings = detectMissingEnvVars(code, "/", []);
    expect(warnings).toHaveLength(0);
  });

  test("does not warn for env vars that are actually set", () => {
    const code = `const p = process.env.PATH;`;
    const warnings = detectMissingEnvVars(code, "/", []);
    expect(warnings).toHaveLength(0);
  });

  test("deduplicates repeated references", () => {
    const code = `
      const a = process.env.SOME_UNLIKELY_TEST_VAR_XYZ_789;
      const b = process.env.SOME_UNLIKELY_TEST_VAR_XYZ_789;
    `;
    const warnings = detectMissingEnvVars(code, "/", []);
    expect(warnings).toHaveLength(1);
  });
});

describe("analyzeUnmetDependencies", () => {
  test("returns empty warnings for a clean pack", () => {
    const plan = makePack({
      routes: [
        { path: "/", route_type: "page", public: true, code: `export default function Home() { return <p>Hi</p>; }` },
      ],
    });
    const result = analyzeUnmetDependencies(plan);
    expect(result.warnings).toHaveLength(0);
  });

  test("aggregates warnings from multiple routes and categories", () => {
    const plan = makePack({
      routes: [
        {
          path: "/api/db",
          route_type: "api",
          public: true,
          code: `
            import pg from "pg";
            const pool = new pg.Pool("postgres://localhost:5432/mydb");
            const secret = process.env.SOME_UNLIKELY_TEST_VAR_AGGREGATE_1;
            export default async function handler(c) { return c.json({}); }
          `,
        },
        {
          path: "/api/feed",
          route_type: "api",
          public: true,
          code: `
            const data = await fetch("https://alice.zo.space/api/posts");
            const file = "/home/workspace/cache/feed.json";
            export default async function handler(c) { return c.json({}); }
          `,
        },
      ],
    });

    const result = analyzeUnmetDependencies(plan);
    const categories = new Set(result.warnings.map((w) => w.category));
    expect(categories.has("localhost")).toBe(true);
    expect(categories.has("env")).toBe(true);
    expect(categories.has("cross-space")).toBe(true);
    expect(categories.has("filesystem")).toBe(true);
  });
});
