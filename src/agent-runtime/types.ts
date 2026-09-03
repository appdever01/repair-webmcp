import type { ModelContextEntryPoint } from "./modelContext";

export type AgentConnectionState = "unsupported" | "registering" | "ready" | "error";

export type AgentActivityPhase = "requested" | "running" | "succeeded" | "failed" | "cancelled";

export type AgentActivitySource = "webmcp" | "demo";

export type AgentToolClassification = "read-only" | "mutation";

export type GenerationStatus =
  | "idle"
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface WorkspaceHotspot {
  id: string;
  label: string;
}

export interface WorkspaceHumanQuestion {
  id: string;
  prompt: string;
}

export interface WorkspaceReversibleActivity {
  activityId: string;
  title: string;
}

export interface WorkspaceSafetyStop {
  code: string;
  title: string;
}

export interface WorkspaceSnapshot {
  stage: string;
  imageSelected: boolean;
  analysisExists: boolean;
  generationStatus: GenerationStatus;
  hotspots: readonly WorkspaceHotspot[];
  unansweredHumanQuestions: readonly WorkspaceHumanQuestion[];
  planExists: boolean;
  stateVersion: number;
  reversibleActivity: WorkspaceReversibleActivity | null;
  safetyStop: WorkspaceSafetyStop | null;
}

export interface WorkspaceActionContext {
  expectedStateVersion: number;
  signal: AbortSignal;
  correlationId: string;
  source: AgentActivitySource;
}

export type WorkspaceActionErrorCode =
  | "ACTION_NOT_AVAILABLE"
  | "CANCELLED"
  | "HUMAN_ACTION_REQUIRED"
  | "INVALID_INPUT"
  | "NOT_REVERSIBLE"
  | "SAFETY_STOP"
  | "STALE_STATE";

export type WorkspaceActionResult = { ok: true } | { ok: false; code: WorkspaceActionErrorCode };

export type WorkspaceAction = WorkspaceActionResult | Promise<WorkspaceActionResult>;

export interface HumanObservationRequestInput {
  questionId: string;
}

export interface WorkspaceController {
  getSnapshot(): WorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  openImageUploader(context: WorkspaceActionContext): WorkspaceAction;
  analyzeUploadedObject(context: WorkspaceActionContext): WorkspaceAction;
  start3DGeneration(context: WorkspaceActionContext): WorkspaceAction;
  refreshGenerationStatus(context: WorkspaceActionContext): WorkspaceAction;
  focusHotspot(hotspotId: string, context: WorkspaceActionContext): WorkspaceAction;
  requestHumanObservation(
    input: HumanObservationRequestInput,
    context: WorkspaceActionContext,
  ): WorkspaceAction;
  draftRepairPlan(context: WorkspaceActionContext): WorkspaceAction;
  cancelCurrentTask(context: WorkspaceActionContext): WorkspaceAction;
  undoAgentAction(activityId: string, context: WorkspaceActionContext): WorkspaceAction;
}

export type SafeSummaryValue = string | number | boolean | null;

export type SafeActivitySummary = Readonly<Record<string, SafeSummaryValue>>;

export interface AgentVisibleTarget {
  kind:
    | "analysis"
    | "generation"
    | "hotspot"
    | "human-question"
    | "repair-plan"
    | "task"
    | "uploader";
  id: string;
  title: string;
}

export interface ToolManifestItem {
  name: string;
  title: string;
  description: string;
  classification: AgentToolClassification;
  readOnly: boolean;
  untrustedContent: boolean;
}

export interface AgentActivityEvent {
  id: string;
  correlationId: string;
  timestamp: string;
  toolName: string;
  title: string;
  phase: AgentActivityPhase;
  classification: AgentToolClassification;
  source: AgentActivitySource;
  inputSummary: SafeActivitySummary;
  resultSummary?: SafeActivitySummary;
  durationMs?: number;
  affectedTarget?: AgentVisibleTarget;
  stateVersionBefore?: number;
  stateVersionAfter?: number;
}

export interface AgentActivityStoreSnapshot {
  connectionState: AgentConnectionState;
  entryPoint: ModelContextEntryPoint | null;
  registeredToolCount: number;
  toolManifest: readonly ToolManifestItem[];
  lastRegistrationError: string | null;
  events: readonly AgentActivityEvent[];
}

export interface AgentActivityStore {
  getSnapshot(): AgentActivityStoreSnapshot;
  getServerSnapshot(): AgentActivityStoreSnapshot;
  subscribe(listener: () => void): () => void;
  clearEvents(): void;
}
