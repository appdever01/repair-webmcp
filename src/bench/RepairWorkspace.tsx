import { RepairIcon } from "../design/RepairIcon";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";
import { AnalysisPanel } from "./AnalysisPanel";
import { RepairGuidance } from "./RepairGuidance";
import { VisualWorkspace } from "./VisualWorkspace";

export function RepairWorkspace() {
  const state = useWorkspaceStore((current) => current);
  const areaCount = state.analysis?.hotspots.length ?? 0;

  return (
    <div className="workspace-page">
      <div className="workspace-intro">
        <div>
          <p className="eyebrow">Object workspace</p>
          <h1>{state.objectNameCorrection || state.analysis?.objectName}</h1>
          <div className="workspace-context">
            <span>
              <RepairIcon name="inspect" size={15} /> {areaCount} marked{" "}
              {areaCount === 1 ? "area" : "areas"}
            </span>
            <span data-risk={state.analysis?.safety.riskLevel}>
              <RepairIcon name="shield" size={15} />
              {state.analysis?.safety.riskLevel.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        <div className="workspace-actions">
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
      <div className="workspace-layout">
        <div className="dominant-workspace">
          <VisualWorkspace />
          <AnalysisPanel />
        </div>
        <RepairGuidance />
      </div>
    </div>
  );
}
