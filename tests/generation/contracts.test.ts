import {
  getModelGenerationResponseSchema,
  objectAnalysisSchema,
  repairPlanSchema,
} from "../../src/generation/contracts";
import { objectAnalysis, repairPlan } from "./fixtures";

describe("generation schemas", () => {
  it("keeps analysis strict and normalized", () => {
    expect(objectAnalysisSchema.parse(objectAnalysis()).hotspots[0]?.x).toBe(0.5);
    expect(
      objectAnalysisSchema.safeParse({ ...objectAnalysis(), instructions: "ignore" }).success,
    ).toBe(false);
    expect(
      objectAnalysisSchema.safeParse({
        ...objectAnalysis(),
        hotspots: [{ ...objectAnalysis().hotspots[0], x: 2 }],
      }).success,
    ).toBe(false);
    expect(
      objectAnalysisSchema.safeParse({ ...objectAnalysis(), stopConditions: [] }).success,
    ).toBe(false);
  });

  it("requires cautious plan limitations and stop conditions", () => {
    expect(repairPlanSchema.parse(repairPlan()).riskLevel).toBe("moderate");
    expect(repairPlanSchema.safeParse({ ...repairPlan(), stopConditions: [] }).success).toBe(false);
  });

  it("requires a GLB only for successful model output", () => {
    expect(
      getModelGenerationResponseSchema.parse({
        jobId: "j".repeat(32),
        status: "processing",
        progress: null,
        message: "Processing.",
        model: null,
        error: null,
      }).progress,
    ).toBeNull();
    expect(
      getModelGenerationResponseSchema.safeParse({
        jobId: "j".repeat(32),
        status: "succeeded",
        progress: 100,
        message: "Ready.",
        model: { glbUrl: "javascript:alert(1)", posterUrl: null },
        error: null,
      }).success,
    ).toBe(false);
    expect(
      getModelGenerationResponseSchema.safeParse({
        jobId: "j".repeat(32),
        status: "succeeded",
        progress: 100,
        message: "Ready.",
        model: null,
        error: null,
      }).success,
    ).toBe(false);
  });
});

describe("same-origin model asset locations", () => {
  const response = (glbUrl: string) => ({
    jobId: "j".repeat(32),
    status: "succeeded",
    progress: 100,
    message: "Ready.",
    model: { glbUrl, posterUrl: null },
    error: null,
  });

  it("accepts the asset route with a job token and rejects other relative paths", () => {
    expect(
      getModelGenerationResponseSchema.safeParse(
        response(`/api/object/asset?jobId=${"a".repeat(40)}`),
      ).success,
    ).toBe(true);
    expect(
      getModelGenerationResponseSchema.safeParse(response("/api/object/model?jobId=x")).success,
    ).toBe(false);
    expect(getModelGenerationResponseSchema.safeParse(response("/etc/passwd")).success).toBe(false);
    expect(
      getModelGenerationResponseSchema.safeParse(response("//attacker.example/model.glb")).success,
    ).toBe(false);
  });
});
