import type { RepairPlan, RepairPlanStep } from "./contracts";

export const MAX_REPAIR_GUIDE_STEPS = 5;

export interface RepairGuideStep {
  kind: "check" | "repair";
  step: RepairPlanStep;
}

export function repairGuideSteps(plan: RepairPlan): RepairGuideStep[] {
  return [
    ...plan.safeNextChecks.map((step) => ({ kind: "check" as const, step })),
    ...plan.proposedRepairPlan.map((step) => ({ kind: "repair" as const, step })),
  ].slice(0, MAX_REPAIR_GUIDE_STEPS);
}
