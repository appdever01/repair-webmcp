import { diagnose } from "./diagnosis";
import { repairGraph } from "./repairGraph";
import type { RepairStage, RepairStoreState } from "./state";

export function selectDiagnosis(state: RepairStoreState) {
  return diagnose(repairGraph, state.observations);
}

export function selectStage(state: RepairStoreState): RepairStage {
  const diagnosis = selectDiagnosis(state);
  if (diagnosis.safetyStop) return "stopped";
  if (state.verification?.passed) return "restored";
  if (state.approved) {
    const plan = repairGraph.planTemplates.find((item) => item.id === state.stagedPlanId);
    if (plan && state.completedStepIds.length >= plan.steps.length) return "verify";
    if (state.completedStepIds.length > 0) return "repair";
    return "approved";
  }
  if (state.stagedPlanId) return "staged";
  if (state.observations.some((item) => item.definitionId === "obs.voltage.rebound")) {
    return "compare";
  }
  if (state.observations.some((item) => item.definitionId === "obs.voltage.load")) {
    return "diagnose";
  }
  if (state.symptomPresetId) return state.focusedComponentId ? "check" : "inspect";
  return "intake";
}

export function selectSafeChecks(state: RepairStoreState) {
  if (selectDiagnosis(state).safetyStop) return [];
  const observed = new Set(state.observations.map((item) => item.definitionId));
  return repairGraph.checks.filter((check) => {
    const definition = repairGraph.observationDefinitions.find((item) => item.checkId === check.id);
    return (
      definition !== undefined &&
      !observed.has(definition.id) &&
      check.requires.every((requirement) => observed.has(requirement))
    );
  });
}

export function selectAllowedActions(state: RepairStoreState): string[] {
  const stage = selectStage(state);
  const actions = ["get_bench_state"];
  if (stage === "intake") actions.push("set_repair_goal");
  if (stage !== "intake") actions.push("inspect_component", "focus_component");
  if (["check", "diagnose"].includes(stage)) {
    actions.push("list_safe_checks", "record_observation");
  }
  if (
    ["diagnose", "compare", "staged", "approved", "repair", "verify", "restored"].includes(stage)
  ) {
    actions.push("diagnose_faults");
  }
  if (["compare", "staged", "approved", "repair", "verify", "restored"].includes(stage)) {
    actions.push("compare_repair_options");
  }
  if (stage === "compare") actions.push("stage_repair_plan");
  if (["staged", "approved", "repair", "verify"].includes(stage)) {
    actions.push("focus_repair_step", "stage_part_cart");
  }
  if (state.undoStack.length > 0) actions.push("undo_agent_action");
  return actions;
}

export function selectCurrentStep(state: RepairStoreState) {
  const plan = repairGraph.planTemplates.find((item) => item.id === state.stagedPlanId);
  if (!plan) return null;
  return plan.steps.find((step) => !state.completedStepIds.includes(step.id)) ?? null;
}

export function selectTopHypothesis(state: RepairStoreState) {
  return selectDiagnosis(state).ranked[0] ?? null;
}

export function selectOptions(state: RepairStoreState) {
  const budget = state.budget;
  const diagnosis = selectDiagnosis(state);
  const likelyHypothesisId =
    diagnosis.status === "likely" ? (diagnosis.ranked[0]?.id ?? null) : null;
  return repairGraph.repairOptions.map((option) => ({
    ...option,
    withinBudget: budget === null ? null : option.cost <= budget,
    bestFit:
      option.id === "option.replace.battery" &&
      likelyHypothesisId !== null &&
      option.hypothesisIds.includes(likelyHypothesisId) &&
      budget !== null &&
      option.cost <= budget,
  }));
}
