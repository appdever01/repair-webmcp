import {
  assertSessionBindings,
  createJobToken,
  createPlanToken,
  createSessionToken,
  inspectSessionToken,
  verifyJobToken,
  verifyPlanToken,
  verifySessionToken,
} from "../../api/_lib/token";
import { objectAnalysis, repairPlan } from "./fixtures";

const SECRET = "a-production-length-secret-that-is-at-least-32-bytes";

describe("generation signed tokens", () => {
  it("binds a session to the image and logical analysis", () => {
    const analysis = objectAnalysis();
    const token = createSessionToken("image-hash-value-123456789", analysis, SECRET, 60, 100);
    const session = verifySessionToken(token, SECRET, 120);

    expect(() =>
      assertSessionBindings(session, "image-hash-value-123456789", analysis),
    ).not.toThrow();
    expect(() => assertSessionBindings(session, "different-image-hash-123456", analysis)).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("inspects a signed session without rejecting expiry", () => {
    const token = createSessionToken(
      "image-hash-value-123456789",
      objectAnalysis(),
      SECRET,
      10,
      100,
    );
    expect(inspectSessionToken(token, SECRET)).toMatchObject({
      imageHash: "image-hash-value-123456789",
      kind: "session",
    });
    expect(inspectSessionToken(`${token.slice(0, -1)}x`, SECRET)).toBeNull();
  });

  it("rejects expiry and tampering", () => {
    const token = createSessionToken(
      "image-hash-value-123456789",
      objectAnalysis(),
      SECRET,
      10,
      100,
    );
    expect(() => verifySessionToken(token, SECRET, 110)).toThrow(
      expect.objectContaining({ code: "SESSION_EXPIRED" }),
    );
    expect(() => verifySessionToken(`${token.slice(0, -1)}x`, SECRET, 105)).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("makes opaque job IDs session-specific", () => {
    const first = verifySessionToken(
      createSessionToken("image-hash-value-123456789", objectAnalysis(), SECRET, 60, 100),
      SECRET,
      101,
    );
    const second = verifySessionToken(
      createSessionToken("image-hash-value-123456789", objectAnalysis(), SECRET, 60, 100),
      SECRET,
      101,
    );
    const job = createJobToken("meshy", "provider-job", first, SECRET, 102);

    expect(verifyJobToken(job, first, SECRET, 103).providerJobId).toBe("provider-job");
    expect(job).not.toContain("provider-job");
    expect(() => verifyJobToken(job, second, SECRET, 103)).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("binds generated visuals to the exact repair plan and session", () => {
    const first = verifySessionToken(
      createSessionToken("image-hash-value-123456789", objectAnalysis(), SECRET, 60, 100),
      SECRET,
      101,
    );
    const second = verifySessionToken(
      createSessionToken("image-hash-value-123456789", objectAnalysis(), SECRET, 60, 100),
      SECRET,
      101,
    );
    const plan = repairPlan();
    const token = createPlanToken(plan, first, SECRET, 102);

    expect(() => verifyPlanToken(token, plan, first, SECRET, 103)).not.toThrow();
    expect(() =>
      verifyPlanToken(
        token,
        { ...plan, toolsAndMaterials: ["Different tool"] },
        first,
        SECRET,
        103,
      ),
    ).toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    expect(() => verifyPlanToken(token, plan, second, SECRET, 103)).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });
});
