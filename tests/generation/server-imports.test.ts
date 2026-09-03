import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("serverless module imports", () => {
  it("uses Node ESM-compatible extensions for every relative import", () => {
    const invalidImports = sourceFiles(join(process.cwd(), "api")).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/(?:from|import)\s*["'](\.\.?\/[^"']+)["']/g)]
        .map((match) => match[1])
        .filter((specifier): specifier is string => specifier !== undefined)
        .filter((specifier) => !specifier.endsWith(".js") && !specifier.endsWith(".json"))
        .map((specifier) => `${file}: ${specifier}`);
    });

    expect(invalidImports).toEqual([]);
  });
});

describe("serverless handler exports", () => {
  it("exposes every route through the Vercel fetch web handler export", async () => {
    const routes = await Promise.all([
      import("../../api/object/analyze"),
      import("../../api/object/model"),
      import("../../api/object/plan"),
    ]);
    for (const route of routes) {
      expect(typeof route.default.fetch).toBe("function");
      expect(route.default.fetch).toBe(route.handler);
    }
  });
});
