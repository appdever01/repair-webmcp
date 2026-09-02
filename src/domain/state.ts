import type { StoreApi } from "zustand/vanilla";
import type { DiagnosisResult } from "./diagnosis";
import type { ActionContext, ActionResult, DomainEvent } from "./events";
import type { Observation, ObservationValue } from "./schemas";

export type RepairStage =
  | "intake"
  | "inspect"
  | "check"
  | "diagnose"
  | "compare"
  | "staged"
  | "approved"
  | "repair"
  | "verify"
  | "restored"
  | "stopped";

export interface StagedPart {
  partId: string;
  quantity: number;
}

export interface VerificationRecord {
  ruleId: string;
  passed: boolean;
}

export interface RepairSessionState {
  symptomPresetId: string | null;
  budget: number | null;
  currency: "USD";
  observations: Observation[];
  stagedPlanId: string | null;
  stagedPart: StagedPart | null;
  approved: boolean;
  completedStepIds: string[];
  verification: VerificationRecord | null;
}

export interface RepairViewState {
  focusedComponentId: string | null;
  focusedStepId: string | null;
  componentIndexOpen: boolean;
  provenanceOpen: boolean;
  announcement: string;
  webmcpAvailable: boolean;
}

export interface UndoEntry {
  activityId: string;
  repair: RepairSessionState;
  focusedComponentId: string | null;
  focusedStepId: string | null;
}

export interface RepairHistoryState {
  stateVersion: number;
  activity: DomainEvent[];
  undoStack: UndoEntry[];
}

export interface RepairActions {
  setRepairGoal: (
    input: { symptomPresetId: string; maximumBudget: number; currency: "USD" },
    context: ActionContext,
  ) => ActionResult;
  focusComponent: (componentId: string, context: ActionContext) => ActionResult;
  recordObservation: (
    input: {
      checkId: string;
      definitionId: string;
      value: ObservationValue;
      source: "reported" | "simulator";
    },
    context: ActionContext,
  ) => ActionResult;
  stageRepairPlan: (optionId: string, context: ActionContext) => ActionResult;
  focusRepairStep: (stepId: string, context: ActionContext) => ActionResult;
  stagePart: (partId: string, quantity: number, context: ActionContext) => ActionResult;
  approvePlan: (context: ActionContext) => ActionResult;
  completePhysicalStep: (stepId: string, context: ActionContext) => ActionResult;
  recordVerification: (passed: boolean, context: ActionContext) => ActionResult;
  undoAgentAction: (activityId: string, context: ActionContext) => ActionResult;
  setComponentIndexOpen: (open: boolean) => void;
  setProvenanceOpen: (open: boolean) => void;
  setWebmcpAvailable: (available: boolean) => void;
  resetView: () => void;
  resetSession: () => void;
}

export interface RepairStoreState
  extends RepairSessionState,
    RepairViewState,
    RepairHistoryState,
    RepairActions {}

export type RepairStore = StoreApi<RepairStoreState>;

export interface RepairSnapshot {
  stage: RepairStage;
  diagnosis: DiagnosisResult;
  safeCheckIds: string[];
  allowedActions: string[];
}
