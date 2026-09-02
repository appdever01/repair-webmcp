import { Component, lazy, type ReactNode, Suspense, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import { supportsWebGL } from "../scene/quality";
import type { SceneCommand } from "../scene/RepairScene";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";

const RepairScene = lazy(() =>
  import("../scene/RepairScene").then((module) => ({ default: module.RepairScene })),
);

class ModelBoundary extends Component<
  { children: ReactNode; modelKey: string; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  componentDidUpdate(previous: { modelKey: string }) {
    if (previous.modelKey !== this.props.modelKey && this.state.failed)
      this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function HotspotLayer() {
  const analysis = useWorkspaceStore((state) => state.analysis);
  const focused = useWorkspaceStore((state) => state.focusedHotspotId);
  return (
    <fieldset className="visual-hotspots">
      <legend className="sr-only">Object hotspots</legend>
      {analysis?.hotspots.map((hotspot, index) => (
        <button
          key={hotspot.id}
          type="button"
          style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
          data-focused={focused === hotspot.id}
          aria-label={`Focus hotspot ${index + 1}: ${hotspot.label}`}
          aria-pressed={focused === hotspot.id}
          onClick={() =>
            workspaceStore.getState().focusHotspot(hotspot.id, humanActionOptions(workspaceStore))
          }
        >
          {index + 1}
        </button>
      ))}
    </fieldset>
  );
}

export function VisualWorkspace() {
  const state = useWorkspaceStore((current) => current);
  const [webgl] = useState(supportsWebGL);
  const [command, setCommand] = useState<SceneCommand>({ id: 0, type: "reset" });
  const [explodedModelUrl, setExplodedModelUrl] = useState<string | null>(null);
  const modelAvailable = Boolean(state.model && webgl && !state.modelError);
  const showModel = state.visualMode === "model" && modelAvailable;
  const exploded = state.model?.glbUrl === explodedModelUrl;
  const nextCommand = (type: SceneCommand["type"]) =>
    setCommand((current) => ({ id: current.id + 1, type }));

  return (
    <section className="visual-workspace" aria-labelledby="visual-title">
      <div className="visual-toolbar">
        <div>
          <p className="eyebrow">Interactive view</p>
          <h2 id="visual-title">Inspect the same areas in every view.</h2>
        </div>
        <fieldset className="view-tabs">
          <legend className="sr-only">Choose object view</legend>
          <button
            type="button"
            aria-pressed={!showModel}
            onClick={() => workspaceStore.getState().setVisualMode("photo")}
          >
            <RepairIcon name="camera" /> Photo
          </button>
          <button
            type="button"
            aria-pressed={showModel}
            disabled={!modelAvailable}
            onClick={() => workspaceStore.getState().setVisualMode("model")}
          >
            <RepairIcon name="cube" /> 3D model
          </button>
        </fieldset>
      </div>
      <div className="visual-stage" data-mode={showModel ? "model" : "photo"}>
        {showModel && state.model ? (
          <ModelBoundary
            modelKey={state.model.glbUrl}
            onFailure={() =>
              workspaceStore.getState().setModelError("The 3D model could not be loaded.")
            }
          >
            <Suspense
              fallback={
                <div className="model-loading" role="status">
                  Loading the interactive model
                </div>
              }
            >
              <RepairScene modelUrl={state.model.glbUrl} command={command} exploded={exploded} />
            </Suspense>
          </ModelBoundary>
        ) : state.image ? (
          <img
            src={state.image.previewUrl}
            alt={`Uploaded view of ${state.objectNameCorrection || "the object"}`}
          />
        ) : null}
        {!showModel && <HotspotLayer />}
      </div>
      {state.modelError && (
        <p className="model-fallback-note" role="status">
          <RepairIcon name="info" /> The 3D view could not load, possibly because the remote model
          blocked access. Continue with the interactive photo.
        </p>
      )}
      {state.generationError && !state.model && (
        <p className="model-fallback-note" role="status">
          <RepairIcon name="info" /> {state.generationError.message} Continue with the interactive
          photo and the next human check.
        </p>
      )}
      {showModel && (
        <fieldset className="model-controls">
          <legend className="sr-only">3D view controls</legend>
          <span>Drag to orbit · scroll to zoom</span>
          <div>
            <button
              type="button"
              className="explode-control"
              aria-label={exploded ? "Assemble model parts" : "Explode model parts"}
              aria-pressed={exploded}
              onClick={() =>
                setExplodedModelUrl((current) =>
                  current === state.model?.glbUrl ? null : (state.model?.glbUrl ?? null),
                )
              }
            >
              <RepairIcon name={exploded ? "reuse" : "isolate"} />
              {exploded ? "Assemble" : "Explode"}
            </button>
            <button
              type="button"
              aria-label="Rotate model left"
              onClick={() => nextCommand("rotate-left")}
            >
              <RepairIcon name="back" />
            </button>
            <button
              type="button"
              aria-label="Rotate model right"
              onClick={() => nextCommand("rotate-right")}
            >
              <RepairIcon name="forward" />
            </button>
            <button type="button" aria-label="Zoom model in" onClick={() => nextCommand("zoom-in")}>
              <RepairIcon name="zoomIn" />
            </button>
            <button
              type="button"
              aria-label="Zoom model out"
              onClick={() => nextCommand("zoom-out")}
            >
              <RepairIcon name="zoomOut" />
            </button>
            <button
              type="button"
              aria-label="Reset model view"
              onClick={() => nextCommand("reset")}
            >
              <RepairIcon name="reset" />
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
