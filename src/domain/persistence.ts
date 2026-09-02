import { z } from "zod";
import { domainEventSchema } from "./events";
import { observationSchema } from "./schemas";
import type { RepairHistoryState, RepairSessionState, UndoEntry } from "./state";

export const STORAGE_KEY = "repair:session:v1";

const repairSessionSchema = z.strictObject({
  symptomPresetId: z.string().nullable(),
  budget: z.number().nonnegative().nullable(),
  currency: z.literal("USD"),
  observations: z.array(observationSchema),
  stagedPlanId: z.string().nullable(),
  stagedPart: z
    .strictObject({ partId: z.string(), quantity: z.number().int().min(1).max(4) })
    .nullable(),
  approved: z.boolean(),
  completedStepIds: z.array(z.string()),
  verification: z.strictObject({ ruleId: z.string(), passed: z.boolean() }).nullable(),
});

const undoEntrySchema = z.strictObject({
  activityId: z.string(),
  repair: repairSessionSchema,
  focusedComponentId: z.string().nullable(),
  focusedStepId: z.string().nullable(),
});

const persistedSchema = z.strictObject({
  persistenceVersion: z.literal(1),
  repair: repairSessionSchema,
  history: z.strictObject({
    stateVersion: z.number().int().nonnegative(),
    activity: z.array(domainEventSchema).max(100),
    undoStack: z.array(undoEntrySchema).max(30),
  }),
});

export interface PersistedRepairState {
  repair: RepairSessionState;
  history: RepairHistoryState;
}

export function loadPersistedState(storage: Storage | undefined): PersistedRepairState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = persistedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { repair: parsed.data.repair, history: parsed.data.history };
  } catch {
    return null;
  }
}

export function savePersistedState(
  storage: Storage | undefined,
  repair: RepairSessionState,
  history: RepairHistoryState,
) {
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        persistenceVersion: 1,
        repair,
        history: {
          ...history,
          activity: history.activity.slice(-100),
          undoStack: history.undoStack.slice(-30),
        },
      }),
    );
  } catch {
    return;
  }
}

export function clearPersistedState(storage: Storage | undefined) {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function repairSnapshot(state: RepairSessionState): RepairSessionState {
  return {
    symptomPresetId: state.symptomPresetId,
    budget: state.budget,
    currency: state.currency,
    observations: state.observations.map((item) => ({ ...item })),
    stagedPlanId: state.stagedPlanId,
    stagedPart: state.stagedPart ? { ...state.stagedPart } : null,
    approved: state.approved,
    completedStepIds: [...state.completedStepIds],
    verification: state.verification ? { ...state.verification } : null,
  };
}

export function cloneUndoStack(stack: UndoEntry[]) {
  return stack.map((entry) => ({ ...entry, repair: repairSnapshot(entry.repair) }));
}
