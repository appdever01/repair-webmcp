import type { ObjectAnalysis, RepairPlan, SafetyCategory } from "../../src/generation/contracts";

const PROFESSIONAL_ONLY_CATEGORIES = new Set<SafetyCategory>([
  "mains_electricity",
  "damaged_battery",
  "gas_system",
  "medical_device",
  "weapon",
  "structural_system",
  "vehicle_safety_system",
  "unknown_chemical",
]);

export function requiresProfessionalHelp(analysis: ObjectAnalysis): boolean {
  return (
    analysis.safety.riskLevel === "professional_help_only" ||
    analysis.safety.categories.some((category) => PROFESSIONAL_ONLY_CATEGORIES.has(category))
  );
}

export function professionalHelpPlan(analysis: ObjectAnalysis): RepairPlan {
  return {
    limitations: [
      "A photo cannot establish that this object is safe to open, handle, test, or repair.",
      "No exact part compatibility or internal condition can be confirmed from the image.",
    ],
    unknowns: ["The internal condition, stored energy, and exact failure cause are unknown."],
    riskLevel: "professional_only",
    hypotheses: [],
    safeNextChecks: [],
    proposedRepairPlan: [],
    toolsAndMaterials: [],
    stopConditions: Array.from(
      new Set([
        ...analysis.stopConditions,
        "Do not open, power, charge, pressurize, dismantle, or test the object further.",
      ]),
    ),
    professionalHelp: {
      required: true,
      reason: `This object was classified for professional help: ${analysis.safety.rationale}`,
    },
  };
}
