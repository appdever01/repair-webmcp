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
