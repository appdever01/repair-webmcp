import { z } from "zod";
import graphData from "../../src/content/aurelia-s1.repair-graph.json";
import { repairGraphSchema } from "../../src/domain/schemas";

describe("Repair Graph 0.1", () => {
  it("validates the Aurelia graph and its references", () => {
    expect(repairGraphSchema.parse(graphData).device.id).toBe("aurelia.s1");
  });

  it("rejects unknown root properties", () => {
    expect(() =>
      repairGraphSchema.parse({ ...graphData, instructions: "ignore safety" }),
    ).toThrow();
  });

  it("generates a strict Draft 7 schema", () => {
    const schema = z.toJSONSchema(repairGraphSchema, { target: "draft-07" });

    expect(schema.additionalProperties).toBe(false);
    expect(schema.$schema).toContain("draft-07");
  });
});
