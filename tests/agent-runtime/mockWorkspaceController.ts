import type {
  WorkspaceActionContext,
  WorkspaceActionResult,
  WorkspaceController,
  WorkspaceSnapshot,
} from "../../src/agent-runtime";

export type ControllerActionName =
  | "analyzeUploadedObject"
  | "cancelCurrentTask"
  | "draftRepairPlan"
  | "focusHotspot"
  | "openImageUploader"
  | "refreshGenerationStatus"
  | "requestHumanObservation"
  | "start3DGeneration"
  | "undoAgentAction";

export interface ControllerCall {
  name: ControllerActionName;
  value?: string;
  context: WorkspaceActionContext;
}

export const initialWorkspaceSnapshot: WorkspaceSnapshot = {
  stage: "intake",
  imageSelected: false,
  analysisExists: false,
  generationStatus: "idle",
  hotspots: [],
  unansweredHumanQuestions: [],
  planExists: false,
  stateVersion: 0,
  reversibleActivity: null,
  safetyStop: null,
};

type Behavior = (
  context: WorkspaceActionContext,
  value?: string,
) => WorkspaceActionResult | Promise<WorkspaceActionResult>;

export class MockWorkspaceController implements WorkspaceController {
  readonly calls: ControllerCall[] = [];
  readonly behaviors = new Map<ControllerActionName, Behavior>();
  private listeners = new Set<() => void>();
  private snapshot: WorkspaceSnapshot;

  constructor(snapshot: WorkspaceSnapshot = initialWorkspaceSnapshot) {
    this.snapshot = snapshot;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSnapshot(patch: Partial<WorkspaceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  openImageUploader(context: WorkspaceActionContext) {
    return this.perform("openImageUploader", context, {
      stage: "awaiting-image",
      reversibleActivity: { activityId: "activity.open-uploader", title: "Opened uploader" },
    });
  }

  analyzeUploadedObject(context: WorkspaceActionContext) {
    return this.perform("analyzeUploadedObject", context, {
      stage: "analyzed",
      analysisExists: true,
      hotspots: [{ id: "hotspot.hinge", label: "Loose hinge" }],
      reversibleActivity: { activityId: "activity.analyze", title: "Started image analysis" },
    });
  }

  start3DGeneration(context: WorkspaceActionContext) {
    return this.perform("start3DGeneration", context, {
      stage: "generating",
      generationStatus: "queued",
      reversibleActivity: { activityId: "activity.generation", title: "Started 3D generation" },
    });
  }

  refreshGenerationStatus(context: WorkspaceActionContext) {
    return this.perform("refreshGenerationStatus", context, {
      generationStatus: "processing",
    });
  }

  focusHotspot(hotspotId: string, context: WorkspaceActionContext) {
    return this.perform(
      "focusHotspot",
      context,
      {
        reversibleActivity: { activityId: "activity.focus", title: "Focused hotspot" },
      },
      hotspotId,
    );
  }

  requestHumanObservation(input: { questionId: string }, context: WorkspaceActionContext) {
    return this.perform(
      "requestHumanObservation",
      context,
      {
        reversibleActivity: { activityId: "activity.question", title: "Requested an observation" },
      },
      input.questionId,
    );
  }

  draftRepairPlan(context: WorkspaceActionContext) {
    return this.perform("draftRepairPlan", context, {
      stage: "plan-review",
      planExists: true,
      reversibleActivity: { activityId: "activity.plan", title: "Drafted repair plan" },
    });
  }

  cancelCurrentTask(context: WorkspaceActionContext) {
    return this.perform("cancelCurrentTask", context, {
      stage: "cancelled",
      generationStatus: "cancelled",
      reversibleActivity: { activityId: "activity.cancel", title: "Cancelled current task" },
    });
  }

  undoAgentAction(activityId: string, context: WorkspaceActionContext) {
    return this.perform("undoAgentAction", context, { reversibleActivity: null }, activityId);
  }

  private async perform(
    name: ControllerActionName,
    context: WorkspaceActionContext,
    patch: Partial<WorkspaceSnapshot>,
    value?: string,
  ): Promise<WorkspaceActionResult> {
    this.calls.push({ name, context, ...(value === undefined ? {} : { value }) });
    if (context.signal.aborted) return { ok: false, code: "CANCELLED" };
    if (context.expectedStateVersion !== this.snapshot.stateVersion) {
      return { ok: false, code: "STALE_STATE" };
    }
    const behavior = this.behaviors.get(name);
    if (behavior) return behavior(context, value);
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      stateVersion: this.snapshot.stateVersion + 1,
    };
    for (const listener of this.listeners) listener();
    return { ok: true };
  }
}
