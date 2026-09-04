import type {
  HumanObservationRequestInput,
  WorkspaceActionContext,
  WorkspaceController,
  WorkspaceSnapshot,
} from "../agent-runtime";
import type { WorkspaceStore } from "./store";

function snapshot(store: WorkspaceStore): WorkspaceSnapshot {
  const state = store.getState();
  const unansweredHumanQuestions = state.questions
    .filter((question) => !state.answers.some((answer) => answer.questionId === question.id))
    .map(({ id, prompt }) => ({ id, prompt }));
  const safetyStop =
    state.analysis?.safety.riskLevel === "professional_help_only"
      ? {
          code: state.analysis.safety.categories[0] ?? "professional-help",
          title: "Qualified help required",
        }
      : null;
  return {
    stage: state.stage,
    imageSelected: state.image !== null,
    analysisExists: state.analysis !== null,
    generationStatus: state.generationStatus,
    modelExists: state.model !== null && state.modelError === null,
    exploded: state.exploded,
    hotspots: state.analysis?.hotspots.map(({ id, label }) => ({ id, label })) ?? [],
    questionStatus: state.questionStatus,
    unansweredHumanQuestions,
    planExists: state.plan !== null,
    stateVersion: state.stateVersion,
    reversibleActivity: state.reversibleActivity,
    safetyStop,
  };
}

function options(context: WorkspaceActionContext) {
  return {
    expectedStateVersion: context.expectedStateVersion,
    source: context.source,
    signal: context.signal,
    correlationId: context.correlationId,
  } as const;
}

function openImagePicker() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("object-photo");
  if (input instanceof HTMLInputElement && input.type === "file") input.click();
}

export function createWorkspaceController(store: WorkspaceStore): WorkspaceController {
  return {
    getSnapshot: () => snapshot(store),
    subscribe: (listener) => store.subscribe(listener),
    openImageUploader: (context) => {
      const result = store.getState().openImageUploader(options(context));
      if (result.ok) openImagePicker();
      return result;
    },
    analyzeUploadedObject: (context) => store.getState().analyzeUploadedObject(options(context)),
    start3DGeneration: (context) => store.getState().start3DGeneration(options(context)),
    refreshGenerationStatus: (context) =>
      store.getState().refreshGenerationStatus(options(context)),
    focusHotspot: (hotspotId, context) =>
      store.getState().focusHotspot(hotspotId, options(context)),
    setExplodedView: (exploded, context) =>
      store.getState().setExplodedView(exploded, options(context)),
    requestHumanObservation: (input: HumanObservationRequestInput, context) =>
      store.getState().requestHumanObservation(input.questionId, options(context)),
    draftRepairPlan: (context) => store.getState().draftRepairPlan(options(context)),
    cancelCurrentTask: (context) => store.getState().cancelCurrentTask(options(context)),
    undoAgentAction: (activityId, context) =>
      store.getState().undoAgentAction(activityId, options(context)),
  };
}
