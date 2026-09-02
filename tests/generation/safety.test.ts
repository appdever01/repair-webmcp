import { professionalHelpPlan, requiresProfessionalHelp } from "../../api/_lib/safety";
import { objectAnalysis } from "./fixtures";

describe("repair-plan safety handling", () => {
  it.each([
    "mains_electricity",
    "damaged_battery",
    "gas_system",
    "medical_device",
    "weapon",
    "structural_system",
    "vehicle_safety_system",
    "unknown_chemical",
  ] as const)("routes %s to professional help", (category) => {
    const analysis = objectAnalysis({
      safety: {
        riskLevel: "professional_help_only",
        categories: [category],
        rationale: "The image may show a high-risk system.",
      },
    });
    const plan = professionalHelpPlan(analysis);

    expect(requiresProfessionalHelp(analysis)).toBe(true);
    expect(plan.riskLevel).toBe("professional_only");
    expect(plan.professionalHelp.required).toBe(true);
    expect(plan.safeNextChecks).toEqual([]);
    expect(plan.proposedRepairPlan).toEqual([]);
  });

  it("does not force an ordinary external issue into the high-risk path", () => {
    expect(requiresProfessionalHelp(objectAnalysis())).toBe(false);
  });
});
