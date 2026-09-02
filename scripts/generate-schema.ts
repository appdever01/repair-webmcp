import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { repairGraphSchema } from "../src/domain/schemas.ts";

const schema = z.toJSONSchema(repairGraphSchema, { target: "draft-07" });
const output = resolve("docs/repair-graph.schema.json");

await mkdir(resolve("docs"), { recursive: true });
await writeFile(output, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
console.log(output);
