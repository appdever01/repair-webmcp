import { RepairIcon } from "../design/RepairIcon";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";
import { AnalysisPanel } from "./AnalysisPanel";
import { RepairGuidance } from "./RepairGuidance";
import { VisualWorkspace } from "./VisualWorkspace";

const progressLabels = {
  uploading: "Uploading",
  understanding: "Understanding the object",
  preparing: "Preparing a clean reference",
  generating: "Building the 3D model",
  finishing: "Finishing the workspace",
  planning: "Preparing cautious guidance",
} as const;

export function RepairWorkspace() {
  const state = useWorkspaceStore((current) => current);
  const progress =
    state.stage in progressLabels
      ? progressLabels[state.stage as keyof typeof progressLabels]
      : null;

  return (
    <div className="workspace-page">
      <div className="workspace-intro">
        <div>
          <p className="eyebrow">Object workspace</p>
          <h1>{state.objectNameCorrection || state.analysis?.objectName}</h1>
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
      {progress && (
        <div className="progress-state" role="status">
          <span className="progress-pulse" aria-hidden="true" />
          <div>
            <strong>{progress}</strong>
            <small>{state.generationMessage ?? "This can take a moment."}</small>
          </div>
        </div>
      )}
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
