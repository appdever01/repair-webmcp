import { repairGraph } from "../domain/repairGraph";
import {
  selectAllowedActions,
  selectDiagnosis,
  selectOptions,
  selectSafeChecks,
  selectStage,
} from "../domain/selectors";
import type { RepairStore } from "../domain/state";
import { type ToolName, toolInputSchemas } from "./toolDefinitions";
import {
  actionToolResult,
  boundedResult,
  cancelledResult,
  invalidResult,
  unavailableResult,
} from "./toolResults";

type ToolInput = Record<string, unknown>;

async function mutation<T extends ToolInput>(
  store: RepairStore,
  signal: AbortSignal,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  input: ToolInput,
  apply: (data: T) => unknown,
) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalidResult(store);
  await Promise.resolve();
  if (signal.aborted) return cancelledResult(store);
  return apply(parsed.data);
}

export function createToolHandler(name: ToolName, store: RepairStore): WebMCP.ToolExecuteCallback {
  return async (rawInput, { signal }) => {
    const input = rawInput ?? {};
    const state = store.getState();
    if (signal.aborted) return cancelledResult(store);
    try {
      switch (name) {
        case "get_bench_state": {
          const parsed = toolInputSchemas.get_bench_state.safeParse(input);
          if (!parsed.success) return invalidResult(store);
          const diagnosis = selectDiagnosis(state);
          return boundedResult({
            ok: true,
            stateVersion: state.stateVersion,
            device: repairGraph.device.name,
            stage: selectStage(state),
            goal: state.symptomPresetId
              ? {
                  symptomPresetId: state.symptomPresetId,
                  maximumBudget: state.budget,
                  currency: state.currency,
                }
              : null,
            observations:
              parsed.data.detail === "full"
                ? state.observations.map((item) => ({
                    checkId: item.checkId,
                    value: item.value,
                    unit: item.unit,
                    source: item.source,
                  }))
                : state.observations.length,
            likelyCause: diagnosis.status === "likely" ? diagnosis.ranked[0]?.label : null,
            stagedPlanId: state.stagedPlanId,
            approvedByHuman: state.approved,
            completedSteps: state.completedStepIds.length,
            safetyStop: diagnosis.safetyStop?.title ?? null,
            allowedNext: selectAllowedActions(state),
          });
        }
        case "inspect_component": {
          const parsed = toolInputSchemas.inspect_component.safeParse(input);
          if (!parsed.success) return invalidResult(store);
          if (selectStage(state) === "intake") return unavailableResult(store);
          const component = repairGraph.components.find(
            (item) => item.id === parsed.data.componentId,
          );
          if (!component) return invalidResult(store, "The component ID is not recognized.");
          const diagnosis = selectDiagnosis(state);
          const hypothesis = diagnosis.ranked.find((item) =>
            repairGraph.hypotheses
              .find((candidate) => candidate.id === item.id)
              ?.componentIds.includes(component.id),
          );
          return boundedResult({
            ok: true,
            stateVersion: state.stateVersion,
            component: {
              id: component.id,
              name: component.name,
              role: component.role,
              description: component.description,
            },
            diagnosticState:
              hypothesis?.rank === 1 && diagnosis.status === "likely"
                ? "fault likely"
                : hypothesis
                  ? "candidate"
                  : "not implicated",
            evidence: hypothesis
              ? [...hypothesis.evidenceFor, ...hypothesis.evidenceAgainst].slice(0, 3)
              : [],
            relatedChecks: repairGraph.checks
              .filter((check) => check.componentId === component.id)
              .map((check) => check.id),
            allowedNext: selectAllowedActions(state),
          });
        }
        case "focus_component":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.focus_component, input, (data) => {
              const component = repairGraph.components.find((item) => item.id === data.componentId);
              const result = store.getState().focusComponent(data.componentId, {
                actor: "agent",
                origin: "webmcp",
                expectedStateVersion: data.expectedStateVersion,
              });
              return actionToolResult(
                result,
                store,
                `Focused ${component?.name ?? data.componentId}.`,
                {
                  kind: "component",
                  id: data.componentId,
                  label: component?.name ?? data.componentId,
                },
              );
            }),
          );
        case "set_repair_goal":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.set_repair_goal, input, (data) =>
              actionToolResult(
                store.getState().setRepairGoal(
                  {
                    symptomPresetId: data.symptomPresetId,
                    maximumBudget: data.maximumBudget,
                    currency: data.currency,
                  },
                  {
                    actor: "agent",
                    origin: "webmcp",
                    expectedStateVersion: data.expectedStateVersion,
                  },
                ),
                store,
                `Recorded the short-runtime goal with a $${data.maximumBudget} limit.`,
              ),
            ),
          );
        case "list_safe_checks": {
          const parsed = toolInputSchemas.list_safe_checks.safeParse(input);
          if (!parsed.success) return invalidResult(store);
          if (!["check", "diagnose"].includes(selectStage(state))) {
            return unavailableResult(store);
          }
          const checks = selectSafeChecks(state).filter(
            (check) => !parsed.data.componentId || check.componentId === parsed.data.componentId,
          );
          return boundedResult({
            ok: true,
            stateVersion: state.stateVersion,
            checks: checks.map((check) => ({
              id: check.id,
              name: check.name,
              componentId: check.componentId,
              instruction: check.instruction,
              stop:
                check.safetyRuleIds
                  .map((id) => repairGraph.safetyRules.find((rule) => rule.id === id))
                  .find((rule) => rule?.severity === "stop")?.instruction ?? null,
            })),
            allowedNext: checks.length ? ["record_observation"] : selectAllowedActions(state),
          });
        }
        case "record_observation":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.record_observation, input, (data) => {
              const definition = repairGraph.observationDefinitions.find(
                (item) => item.checkId === data.checkId,
              );
              if (!definition)
                return invalidResult(store, "The check has no observation definition.");
              if (
                typeof data.value === "number" &&
                data.unit !== undefined &&
                data.unit !== definition.unit
              ) {
                return invalidResult(store, "The numeric reading must use volts.");
              }
              return actionToolResult(
                store.getState().recordObservation(
                  {
                    checkId: data.checkId,
                    definitionId: definition.id,
                    value: data.value,
                    source: data.source,
                  },
                  {
                    actor: "agent",
                    origin: "webmcp",
                    expectedStateVersion: data.expectedStateVersion,
                  },
                ),
                store,
                `Recorded ${definition.label}: ${String(data.value)}${definition.unit ? ` ${definition.unit}` : ""}.`,
                {
                  kind: "component",
                  id:
                    repairGraph.checks.find((item) => item.id === data.checkId)?.componentId ??
                    "battery.pack",
                  label: definition.label,
                },
              );
            }),
          );
        case "diagnose_faults": {
          if (!toolInputSchemas.diagnose_faults.safeParse(input).success)
            return invalidResult(store);
          if (
            !["diagnose", "compare", "staged", "approved", "repair", "verify", "restored"].includes(
              selectStage(state),
            )
          ) {
            return unavailableResult(store);
          }
          const diagnosis = selectDiagnosis(state);
          return boundedResult({
            ok: true,
            stateVersion: state.stateVersion,
            status: diagnosis.status,
            ranked: diagnosis.ranked.map((item) => ({
              id: item.id,
              label: item.label,
              score: item.score,
              evidenceFor: item.evidenceFor,
              evidenceAgainst: item.evidenceAgainst,
              explanationCodes: item.explanationCodes,
            })),
            missingChecks: diagnosis.missingChecks,
            safetyStop: diagnosis.safetyStop,
            allowedNext: selectAllowedActions(state),
          });
        }
        case "compare_repair_options": {
          if (!toolInputSchemas.compare_repair_options.safeParse(input).success)
            return invalidResult(store);
          if (
            !["compare", "staged", "approved", "repair", "verify", "restored"].includes(
              selectStage(state),
            )
          ) {
            return unavailableResult(store);
          }
          return boundedResult({
            ok: true,
            stateVersion: state.stateVersion,
            budget: state.budget,
            options: selectOptions(state).map((option) => ({
              id: option.id,
              kind: option.kind,
              title: option.title,
              cost: option.cost,
              minutes: option.minutes,
              risk: option.risk,
              wasteGrams: option.wasteGrams,
              result: option.result,
              withinBudget: option.withinBudget,
              fit: option.bestFit ? `Best fit for your $${state.budget} limit` : null,
            })),
            allowedNext: selectAllowedActions(state),
          });
        }
        case "stage_repair_plan":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.stage_repair_plan, input, (data) =>
              actionToolResult(
                store.getState().stageRepairPlan(data.optionId, {
                  actor: "agent",
                  origin: "webmcp",
                  expectedStateVersion: data.expectedStateVersion,
                }),
                store,
                "Battery replacement plan staged for human review. It is not approved.",
                { kind: "component", id: "battery.pack", label: "Battery module" },
              ),
            ),
          );
        case "focus_repair_step":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.focus_repair_step, input, (data) => {
              const step = repairGraph.planTemplates
                .flatMap((plan) => plan.steps)
                .find((item) => item.id === data.stepId);
              return actionToolResult(
                store.getState().focusRepairStep(data.stepId, {
                  actor: "agent",
                  origin: "webmcp",
                  expectedStateVersion: data.expectedStateVersion,
                }),
                store,
                `Focused ${step?.title ?? data.stepId}. The person must complete it.`,
                { kind: "step", id: data.stepId, label: step?.title ?? data.stepId },
              );
            }),
          );
        case "stage_part_cart":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.stage_part_cart, input, (data) =>
              actionToolResult(
                store.getState().stagePart(data.partId, data.quantity, {
                  actor: "agent",
                  origin: "webmcp",
                  expectedStateVersion: data.expectedStateVersion,
                }),
                store,
                "Compatible demonstration part staged locally. No purchase was made.",
              ),
            ),
          );
        case "undo_agent_action":
          return boundedResult(
            await mutation(store, signal, toolInputSchemas.undo_agent_action, input, (data) =>
              actionToolResult(
                store.getState().undoAgentAction(data.activityId, {
                  actor: "agent",
                  origin: "webmcp",
                  expectedStateVersion: data.expectedStateVersion,
                }),
                store,
                "Latest eligible agent action undone.",
              ),
            ),
          );
      }
    } catch {
      return boundedResult({
        ok: false,
        code: "INTERNAL_ERROR",
        stateVersion: store.getState().stateVersion,
        message: "The repair tool could not complete this request.",
        allowedNext: ["get_bench_state"],
      });
    }
  };
}
