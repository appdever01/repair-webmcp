import { createStore } from "zustand/vanilla";
import { diagnose } from "./diagnosis";
import type { ActionContext, ActionError, ActionResult, DomainEvent, EventType } from "./events";
import {
  clearPersistedState,
  loadPersistedState,
  repairSnapshot,
  savePersistedState,
} from "./persistence";
import { getComponent, getPart, getPlan, repairGraph } from "./repairGraph";
import { type ObservationValue, observationSchema } from "./schemas";
import { selectStage } from "./selectors";
import type { RepairSessionState, RepairStoreState, UndoEntry } from "./state";

interface StoreDependencies {
  storage?: Storage | null;
  now?: () => string;
  id?: () => string;
}

interface Change {
  field: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

interface CommitInput {
  type: EventType;
  context: ActionContext;
  changes: Change[];
  patch: Partial<RepairStoreState>;
  reversible?: boolean;
  announcement: string;
}

const emptyRepair: RepairSessionState = {
  symptomPresetId: null,
  budget: null,
  currency: "USD",
  observations: [],
  stagedPlanId: null,
  stagedPart: null,
  approved: false,
  completedStepIds: [],
  verification: null,
};

function stateVersionError(stateVersion: number): ActionError {
  return {
    ok: false,
    code: "STALE_STATE",
    stateVersion,
    message: "The repair changed. Read the bench state and try again.",
  };
}

function actionError(
  stateVersion: number,
  code: ActionError["code"],
  message: string,
): ActionError {
  return { ok: false, code, stateVersion, message };
}

function isValidObservationValue(
  definition: (typeof repairGraph.observationDefinitions)[number],
  value: ObservationValue,
) {
  if (definition.kind === "number") {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (definition.minimum === undefined || value >= definition.minimum) &&
      (definition.maximum === undefined || value <= definition.maximum)
    );
  }
  if (definition.kind === "boolean") return typeof value === "boolean";
  return typeof value === "string" && definition.options?.includes(value) === true;
}

function compatiblePart(partId: string, planId: string) {
  const part = getPart(partId);
  const plan = getPlan(planId);
  if (!part || !plan?.partIds.includes(partId)) return false;
  const compatibility = part.compatibility;
  return (
    compatibility.deviceId === repairGraph.device.id &&
    compatibility.voltage === repairGraph.device.power.nominalVoltage &&
    compatibility.chemistry === repairGraph.device.power.chemistry &&
    compatibility.connector === "JST-PH-2 keyed" &&
    compatibility.polarity === "red-positive" &&
    compatibility.sizeMm.every((dimension, index) => dimension === [52, 32, 9][index])
  );
}

function getBrowserStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createRepairStore(dependencies: StoreDependencies = {}) {
  const storage =
    dependencies.storage === null ? undefined : (dependencies.storage ?? getBrowserStorage());
  const now = dependencies.now ?? (() => new Date().toISOString());
  let fallbackId = 0;
  const id =
    dependencies.id ??
    (() => {
      fallbackId += 1;
      return globalThis.crypto?.randomUUID?.() ?? `repair-event-${fallbackId}`;
    });
  const persisted = loadPersistedState(storage);

  return createStore<RepairStoreState>((set, get) => {
    const persist = () => {
      const state = get();
      savePersistedState(storage, repairSnapshot(state), {
        stateVersion: state.stateVersion,
        activity: state.activity,
        undoStack: state.undoStack,
      });
    };

    const commit = (input: CommitInput): ActionResult => {
      const state = get();
      if (
        input.context.expectedStateVersion !== undefined &&
        input.context.expectedStateVersion !== state.stateVersion
      ) {
        return stateVersionError(state.stateVersion);
      }
      const nextVersion = state.stateVersion + 1;
      const event: DomainEvent = {
        id: id(),
        type: input.type,
        actor: input.context.actor,
        origin: input.context.origin,
        timestamp: now(),
        previousVersion: state.stateVersion,
        resultingVersion: nextVersion,
        changes: input.changes,
        reversible: input.reversible ?? false,
      };
      const undoEntry: UndoEntry = {
        activityId: event.id,
        repair: repairSnapshot(state),
        focusedComponentId: state.focusedComponentId,
        focusedStepId: state.focusedStepId,
      };
      set({
        ...input.patch,
        stateVersion: nextVersion,
        activity: [...state.activity, event],
        undoStack:
          input.context.actor === "agent" && event.reversible
            ? [...state.undoStack, undoEntry]
            : state.undoStack,
        announcement: input.announcement,
      });
      persist();
      return { ok: true, stateVersion: nextVersion, event };
    };

    const checkVersion = (context: ActionContext) => {
      const state = get();
      return context.expectedStateVersion === undefined ||
        context.expectedStateVersion === state.stateVersion
        ? null
        : stateVersionError(state.stateVersion);
    };

    return {
      ...(persisted?.repair ?? emptyRepair),
      focusedComponentId: null,
      focusedStepId: null,
      componentIndexOpen: false,
      provenanceOpen: false,
      announcement: "Repair bench ready.",
      webmcpAvailable: false,
      stateVersion: persisted?.history.stateVersion ?? 0,
      activity: persisted?.history.activity ?? [],
      undoStack: persisted?.history.undoStack ?? [],
      setRepairGoal(input, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        if (selectStage(state) !== "intake") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "A repair goal is already active.",
          );
        }
        if (!repairGraph.symptomPresets.some((item) => item.id === input.symptomPresetId)) {
          return actionError(
            state.stateVersion,
            "UNKNOWN_ID",
            "The symptom preset is not recognized.",
          );
        }
        if (
          !Number.isFinite(input.maximumBudget) ||
          input.maximumBudget < 0 ||
          input.maximumBudget > 1000
        ) {
          return actionError(
            state.stateVersion,
            "INVALID_INPUT",
            "Budget must be between 0 and 1,000 USD.",
          );
        }
        return commit({
          type: "symptom_recorded",
          context,
          changes: [
            { field: "symptomPresetId", from: null, to: input.symptomPresetId },
            { field: "budget", from: null, to: input.maximumBudget },
          ],
          patch: {
            symptomPresetId: input.symptomPresetId,
            budget: input.maximumBudget,
            currency: input.currency,
          },
          reversible: true,
          announcement: "Repair goal recorded. Inspect the power system next.",
        });
      },
      focusComponent(componentId, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        const component = getComponent(componentId);
        if (!component?.selectable) {
          return actionError(state.stateVersion, "UNKNOWN_ID", "The component is not available.");
        }
        if (selectStage(state) === "intake") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Record a repair goal first.",
          );
        }
        return commit({
          type: "component_focused",
          context,
          changes: [
            { field: "focusedComponentId", from: state.focusedComponentId, to: componentId },
          ],
          patch: { focusedComponentId: componentId, focusedStepId: null },
          reversible: true,
          announcement: `${component.name} focused.`,
        });
      },
      recordObservation(input, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        if (!["check", "diagnose"].includes(selectStage(state))) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Observations are not available now.",
          );
        }
        const definition = repairGraph.observationDefinitions.find(
          (item) => item.id === input.definitionId && item.checkId === input.checkId,
        );
        const check = repairGraph.checks.find((item) => item.id === input.checkId);
        if (!definition || !check) {
          return actionError(
            state.stateVersion,
            "UNKNOWN_ID",
            "The check or observation is not recognized.",
          );
        }
        const observed = new Set(state.observations.map((item) => item.definitionId));
        if (!check.requires.every((requirement) => observed.has(requirement))) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Complete the earlier safe check first.",
          );
        }
        if (!isValidObservationValue(definition, input.value)) {
          return actionError(
            state.stateVersion,
            "INVALID_INPUT",
            "The observation value or unit is invalid.",
          );
        }
        const observation = observationSchema.parse({
          id: `observation.${id()}`,
          definitionId: definition.id,
          checkId: check.id,
          value: input.value,
          unit: definition.unit,
          source: input.source,
          recordedBy: context.actor === "agent" ? "agent" : "human",
        });
        const prior = state.observations.find((item) => item.definitionId === definition.id);
        const observations = [
          ...state.observations.filter((item) => item.definitionId !== definition.id),
          observation,
        ];
        return commit({
          type: "observation_recorded",
          context,
          changes: [
            {
              field: definition.id,
              from: prior ? String(prior.value) : null,
              to: String(input.value),
            },
          ],
          patch: { observations, focusedComponentId: check.componentId },
          reversible: true,
          announcement: `${definition.label} recorded as ${String(input.value)}${definition.unit ? ` ${definition.unit}` : ""}.`,
        });
      },
      stageRepairPlan(optionId, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        if (selectStage(state) !== "compare") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Compare outcomes before staging a plan.",
          );
        }
        const option = repairGraph.repairOptions.find((item) => item.id === optionId);
        const plan = repairGraph.planTemplates.find((item) => item.optionId === optionId);
        if (!option || !plan) {
          return actionError(
            state.stateVersion,
            "UNKNOWN_ID",
            "That repair plan is not available.",
          );
        }
        if (state.budget !== null && option.cost > state.budget) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "That plan exceeds the stored budget.",
          );
        }
        const diagnosis = diagnose(repairGraph, state.observations);
        const likelyHypothesisId = diagnosis.status === "likely" ? diagnosis.ranked[0]?.id : null;
        if (!likelyHypothesisId || !option.hypothesisIds.includes(likelyHypothesisId)) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "The current evidence does not support that repair plan.",
          );
        }
        return commit({
          type: "plan_staged",
          context,
          changes: [{ field: "stagedPlanId", from: null, to: plan.id }],
          patch: { stagedPlanId: plan.id, focusedComponentId: "battery.pack" },
          reversible: true,
          announcement: "Battery replacement plan staged for human review.",
        });
      },
      focusRepairStep(stepId, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        const plan = state.stagedPlanId ? getPlan(state.stagedPlanId) : null;
        const step = plan?.steps.find((item) => item.id === stepId);
        if (!step)
          return actionError(
            state.stateVersion,
            "UNKNOWN_ID",
            "That repair step is not available.",
          );
        const componentId = step.componentIds[0] ?? null;
        return commit({
          type: "repair_step_focused",
          context,
          changes: [{ field: "focusedStepId", from: state.focusedStepId, to: step.id }],
          patch: { focusedStepId: step.id, focusedComponentId: componentId },
          reversible: true,
          announcement: `Step ${step.order} focused: ${step.title}.`,
        });
      },
      stagePart(partId, quantity, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        if (!state.stagedPlanId) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Stage a repair plan first.",
          );
        }
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
          return actionError(state.stateVersion, "INVALID_INPUT", "Quantity must be from 1 to 4.");
        }
        if (!getPart(partId))
          return actionError(state.stateVersion, "UNKNOWN_ID", "The part is not recognized.");
        if (!compatiblePart(partId, state.stagedPlanId)) {
          return actionError(
            state.stateVersion,
            "INCOMPATIBLE_PART",
            "The part does not match the plan.",
          );
        }
        return commit({
          type: "part_staged",
          context,
          changes: [{ field: "stagedPartId", from: state.stagedPart?.partId ?? null, to: partId }],
          patch: { stagedPart: { partId, quantity } },
          reversible: true,
          announcement: "Compatible demonstration battery staged. No purchase was made.",
        });
      },
      approvePlan(context) {
        const state = get();
        if (context.actor !== "human" || context.origin !== "ui") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Only the person can approve a plan.",
          );
        }
        if (!state.stagedPlanId || !state.stagedPart) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Stage the plan and compatible part before approval.",
          );
        }
        return commit({
          type: "plan_approved",
          context,
          changes: [{ field: "approved", from: false, to: true }],
          patch: { approved: true },
          announcement: "Plan approved by the person. Physical steps remain human-only.",
        });
      },
      completePhysicalStep(stepId, context) {
        const state = get();
        if (context.actor !== "human" || context.origin !== "ui") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Only the person can complete a physical step.",
          );
        }
        const plan = state.stagedPlanId ? getPlan(state.stagedPlanId) : null;
        if (!state.approved || !plan) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Approve the plan before physical work.",
          );
        }
        const nextStep = plan.steps.find((step) => !state.completedStepIds.includes(step.id));
        if (!nextStep || nextStep.id !== stepId) {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Complete the current step first.",
          );
        }
        return commit({
          type: "physical_step_completed",
          context,
          changes: [{ field: "completedStep", from: null, to: stepId }],
          patch: {
            completedStepIds: [...state.completedStepIds, stepId],
            focusedStepId: plan.steps.find((step) => step.order === nextStep.order + 1)?.id ?? null,
          },
          announcement: `Step ${nextStep.order} completed by the person.`,
        });
      },
      recordVerification(passed, context) {
        const state = get();
        if (context.actor !== "human" || context.origin !== "ui") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Only the person can verify the result.",
          );
        }
        if (selectStage(state) !== "verify") {
          return actionError(
            state.stateVersion,
            "ACTION_NOT_AVAILABLE",
            "Complete every physical step first.",
          );
        }
        const verification = repairGraph.verificationRules.find(
          (item) => item.planTemplateId === state.stagedPlanId,
        );
        if (!verification) {
          return actionError(state.stateVersion, "UNKNOWN_ID", "The verification rule is missing.");
        }
        return commit({
          type: "verification_recorded",
          context,
          changes: [{ field: "verificationPassed", from: null, to: passed }],
          patch: { verification: { ruleId: verification.id, passed } },
          announcement: passed
            ? "Runtime verified. The Aurelia S1 is restored."
            : "Runtime check failed. Review the repair before continuing.",
        });
      },
      undoAgentAction(activityId, context) {
        const state = get();
        const stale = checkVersion(context);
        if (stale) return stale;
        const entry = state.undoStack.at(-1);
        if (!entry || entry.activityId !== activityId) {
          return actionError(
            state.stateVersion,
            "NOT_REVERSIBLE",
            "Only the latest eligible agent action can be undone.",
          );
        }
        const previousVersion = state.stateVersion;
        const resultingVersion = previousVersion + 1;
        const event: DomainEvent = {
          id: id(),
          type: "agent_action_undone",
          actor: context.actor,
          origin: context.origin,
          timestamp: now(),
          previousVersion,
          resultingVersion,
          changes: [{ field: "undoneActivityId", from: activityId, to: null }],
          reversible: false,
        };
        set({
          ...entry.repair,
          focusedComponentId: entry.focusedComponentId,
          focusedStepId: entry.focusedStepId,
          stateVersion: resultingVersion,
          activity: [...state.activity, event],
          undoStack: state.undoStack.slice(0, -1),
          announcement: "Latest agent action undone.",
        });
        persist();
        return { ok: true, stateVersion: resultingVersion, event };
      },
      setComponentIndexOpen(open) {
        set({ componentIndexOpen: open });
      },
      setProvenanceOpen(open) {
        set({ provenanceOpen: open });
      },
      setWebmcpAvailable(available) {
        set({ webmcpAvailable: available });
      },
      resetView() {
        set({
          focusedComponentId: null,
          focusedStepId: null,
          announcement: "Workbench view reset.",
        });
      },
      resetSession() {
        const state = get();
        const resultingVersion = state.stateVersion + 1;
        const event: DomainEvent = {
          id: id(),
          type: "session_reset",
          actor: "human",
          origin: "ui",
          timestamp: now(),
          previousVersion: state.stateVersion,
          resultingVersion,
          changes: [
            { field: "symptomPresetId", from: state.symptomPresetId, to: null },
            { field: "activityCount", from: state.activity.length, to: 1 },
          ],
          reversible: false,
        };
        clearPersistedState(storage);
        set({
          ...emptyRepair,
          focusedComponentId: null,
          focusedStepId: null,
          componentIndexOpen: false,
          provenanceOpen: false,
          stateVersion: resultingVersion,
          activity: [event],
          undoStack: [],
          announcement: "Demo reset. Repair bench ready.",
        });
      },
    };
  });
}

export function getRepairSnapshot(state: RepairStoreState) {
  const diagnosis = diagnose(repairGraph, state.observations);
  return {
    stage: selectStage(state),
    diagnosis,
  };
}
