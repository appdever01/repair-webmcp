import { RepairIcon } from "../design/RepairIcon";
import { repairGuideSteps } from "../generation/repairGuide";
import { supportsWebGL } from "../scene/quality";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";
import { AnalysisPanel } from "./AnalysisPanel";
import { RepairGuidance } from "./RepairGuidance";
import { RepairGuideVisual, retryCompletedModel, VisualWorkspace } from "./VisualWorkspace";

export function RepairWorkspace() {
  const state = useWorkspaceStore((current) => current);
  const areaCount = state.analysis?.hotspots.length ?? 0;
  const objectName = state.objectNameCorrection || state.analysis?.objectName || "Object";
  const guideSteps = state.plan ? repairGuideSteps(state.plan) : [];
  const guideOpen =
    state.guidePageOpen && guideSteps.length > 0 && !state.plan?.professionalHelp.required;
  const showGuidance =
    state.diagnosticStatus === "succeeded" ||
    state.analysis?.safety.riskLevel === "professional_help_only";

  if (guideOpen) {
    return (
      <div className="workspace-page repair-guide-page">
        <header className="repair-guide-header">
          <button
            type="button"
            className="text-button repair-guide-back"
            onClick={() => {
              workspaceStore.getState().setGuidePageOpen(false);
              workspaceStore.getState().setVisualMode("diagnostic");
            }}
          >
            <RepairIcon name="back" /> Back to findings
          </button>
          <div>
            <h1 className="repair-guide-title">{objectName}</h1>
          </div>
          <button
            type="button"
            className="secondary-button guide-model-toggle"
            aria-pressed={state.visualMode === "model"}
            onClick={() => {
              if (state.visualMode === "model") {
                workspaceStore.getState().setVisualMode("guide");
                return;
              }
              workspaceStore.getState().setVisualMode("model");
              const next = workspaceStore.getState();
              if (next.model && next.modelError) {
                retryCompletedModel();
                return;
              }
              if (
                supportsWebGL() &&
                !next.isBusy &&
                !next.model &&
                ["idle", "failed", "cancelled"].includes(next.generationStatus)
              ) {
                void next.start3DGeneration(humanActionOptions(workspaceStore));
              }
            }}
          >
            <RepairIcon name={state.visualMode === "model" ? "repair" : "cube"} />
            {state.visualMode === "model"
              ? "Back to steps"
              : ["queued", "processing"].includes(state.generationStatus)
                ? "Building 3D…"
                : "View in 3D"}
          </button>
        </header>
        <div className="repair-guide-layout">
          <RepairGuideVisual />
          <RepairGuidance />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="workspace-intro">
        <div className="workspace-summary">
          <h1>{objectName}</h1>
          <div className="workspace-context">
            <span>
              <RepairIcon name="inspect" size={15} /> {areaCount}{" "}
              {areaCount === 1 ? "area" : "areas"}
            </span>
            <span data-risk={state.analysis?.safety.riskLevel}>
              <RepairIcon name="shield" size={15} />
              {state.analysis?.safety.riskLevel.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        <div className="workspace-actions">
          <button
            type="button"
            className="secondary-button workspace-reset-button"
            onClick={() => {
              if (window.confirm("Start a new repair and clear the current photo and guide?")) {
                workspaceStore.getState().reset();
              }
            }}
          >
            <RepairIcon name="reset" /> Start new
          </button>
          <label className="replace-file-button">
            <input
              className="sr-only"
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) workspaceStore.getState().selectImage(file);
                event.currentTarget.value = "";
              }}
            />
            <RepairIcon name="camera" /> Replace photo
          </label>
          {state.isBusy && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                workspaceStore.getState().cancelCurrentTask(humanActionOptions(workspaceStore))
              }
            >
              <RepairIcon name="stop" /> Cancel task
            </button>
          )}
        </div>
      </div>
      <div className="workspace-layout" data-guidance={showGuidance ? "visible" : "hidden"}>
        <div className="dominant-workspace">
          <VisualWorkspace />
          <AnalysisPanel />
        </div>
        {showGuidance && <RepairGuidance />}
      </div>
    </div>
  );
}
