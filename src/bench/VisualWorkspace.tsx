import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import { modelRequestHeaders } from "../scene/modelRequest";
import { supportsWebGL } from "../scene/quality";
import type { SceneCommand } from "../scene/RepairScene";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";

const loadScene = () => import("../scene/RepairScene");
const RepairScene = lazy(() => loadScene().then((module) => ({ default: module.RepairScene })));

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
  const focusedIndex = analysis?.hotspots.findIndex((hotspot) => hotspot.id === focused) ?? -1;
  const focusedHotspot = focusedIndex >= 0 ? analysis?.hotspots[focusedIndex] : null;

  return (
    <>
      <fieldset className="visual-hotspots">
        <legend className="sr-only">Areas that may need attention</legend>
        {analysis?.hotspots.map((hotspot, index) => (
          <button
            key={hotspot.id}
            type="button"
            style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
            data-focused={focused === hotspot.id}
            aria-label={`Inspect area ${index + 1}: ${hotspot.label}`}
            aria-pressed={focused === hotspot.id}
            onClick={() =>
              workspaceStore.getState().focusHotspot(hotspot.id, humanActionOptions(workspaceStore))
            }
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </fieldset>
      {focusedHotspot && (
        <div className="hotspot-focus-card" aria-live="polite">
          <b>{focusedIndex + 1}</b>
          <span>
            <small>Selected area</small>
            <strong>{focusedHotspot.label}</strong>
            <p>{focusedHotspot.description}</p>
          </span>
        </div>
      )}
    </>
  );
}

function PhotoView({ source, objectName }: { source: string; objectName: string }) {
  return (
    <div className="photo-frame">
      <img src={source} alt={`Uploaded view of ${objectName}`} />
      <HotspotLayer />
    </div>
  );
}

function DiagnosticView({ source, objectName }: { source: string; objectName: string }) {
  const state = useWorkspaceStore((current) => current);
  const diagnosticSource = state.diagnosticImage
    ? `data:${state.diagnosticImage.mediaType};base64,${state.diagnosticImage.base64}`
    : null;
  const requestDiagnostic = () =>
    void workspaceStore.getState().generateDiagnosticView(humanActionOptions(workspaceStore));

  return (
    <div className="diagnostic-compare">
      <figure className="diagnostic-frame">
        <img src={source} alt={`Original view of ${objectName}`} />
        <figcaption>Original photo</figcaption>
      </figure>
      <figure className="diagnostic-frame diagnostic-map-frame">
        {diagnosticSource ? (
          <>
            <img src={diagnosticSource} alt={`OpenAI diagnostic damage map of ${objectName}`} />
            <HotspotLayer />
            <figcaption>AI damage map · verify with photo</figcaption>
          </>
        ) : state.diagnosticStatus === "generating" ? (
          <div className="diagnostic-loading" role="status">
            <span className="diagnostic-scan" aria-hidden="true" />
            <RepairIcon name="inspect" size={30} />
            <strong>Drawing the damage map</strong>
            <p>OpenAI is preserving the object and turning visible problem areas into linework.</p>
            <div className="indeterminate-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : (
          <div className="diagnostic-loading" role={state.diagnosticError ? "alert" : "status"}>
            <RepairIcon name={state.diagnosticError ? "warning" : "inspect"} size={30} />
            <strong>
              {state.diagnosticError ? "Damage map unavailable" : "Create a damage map"}
            </strong>
            <p>
              {state.diagnosticError ??
                "Generate a wireframe comparison with the suspected areas clearly circled."}
            </p>
            <button type="button" className="secondary-button" onClick={requestDiagnostic}>
              <RepairIcon name={state.diagnosticError ? "reset" : "inspect"} />
              {state.diagnosticError ? "Try again" : "Generate damage map"}
            </button>
          </div>
        )}
      </figure>
    </div>
  );
}

function ModelProgress({ webgl }: { webgl: boolean }) {
  const state = useWorkspaceStore((current) => current);
  const active =
    ["queued", "processing"].includes(state.generationStatus) || state.stage === "preparing";
  const progress = state.generationProgress;
  const safetyStopped = state.analysis?.safety.riskLevel === "professional_help_only";
  const retry = () =>
    void workspaceStore.getState().start3DGeneration(humanActionOptions(workspaceStore));

  if (!webgl) {
    return (
      <div className="model-generation-state" role="status">
        <RepairIcon name="warning" size={34} />
        <strong>3D is not supported in this browser</strong>
        <p>The photo and AI damage map remain fully usable.</p>
      </div>
    );
  }

  if (active) {
    return (
      <div className="model-generation-state" role="status">
        <div className="model-build-visual" aria-hidden="true">
          <RepairIcon name="cube" size={42} />
          <span />
        </div>
        <div className="model-build-copy">
          <small>Meshy image-to-3D</small>
          <strong>
            {state.stage === "preparing" ? "Preparing your photo" : "Building the model"}
          </strong>
          <p>{state.generationMessage ?? "This usually takes a few minutes."}</p>
        </div>
        <div
          className="model-progress"
          role="progressbar"
          aria-label="3D model generation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(progress === null ? {} : { "aria-valuenow": progress })}
        >
          <span style={{ width: progress === null ? "36%" : `${Math.max(progress, 5)}%` }} />
        </div>
        <div className="model-progress-meta">
          <span>{progress === null ? "Working" : `${progress}% complete`}</span>
          <span>You can keep reviewing the photo</span>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            workspaceStore.getState().cancelCurrentTask(humanActionOptions(workspaceStore))
          }
        >
          Cancel 3D generation
        </button>
      </div>
    );
  }

  return (
    <div className="model-generation-state" role={state.generationError ? "alert" : "status"}>
      <RepairIcon name={state.generationError ? "warning" : "cube"} size={38} />
      <small>Meshy image-to-3D</small>
      <strong>
        {safetyStopped
          ? "3D generation paused for safety"
          : state.generationError
            ? "The model was not completed"
            : "Create an interactive 3D model"}
      </strong>
      <p>
        {safetyStopped
          ? "Continue with the photo and follow the safety guidance."
          : (state.generationError?.message ??
            "Rotate, zoom, and inspect the object from every angle once Meshy finishes.")}
      </p>
      {!safetyStopped && (
        <button type="button" className="primary-button" disabled={state.isBusy} onClick={retry}>
          <RepairIcon name={state.generationError ? "reset" : "cube"} />
          {state.generationError ? "Retry 3D model" : "Build 3D model"}
        </button>
      )}
    </div>
  );
}

export function VisualWorkspace() {
  const state = useWorkspaceStore((current) => current);
  const [webgl] = useState(supportsWebGL);
  const [command, setCommand] = useState<SceneCommand>({ id: 0, type: "reset" });
  const modelAvailable = Boolean(state.model && webgl && !state.modelError);
  const showModel = state.visualMode === "model";
  const showReadyModel = showModel && modelAvailable;
  const objectName = state.objectNameCorrection || state.analysis?.objectName || "the object";
  const exploded = state.exploded;

  useEffect(() => {
    if (showReadyModel) void loadScene().catch(() => undefined);
  }, [showReadyModel]);

  const nextCommand = (type: SceneCommand["type"]) =>
    setCommand((current) => ({ id: current.id + 1, type }));
  const choosePhoto = () => workspaceStore.getState().setVisualMode("photo");
  const chooseDiagnostic = () => {
    workspaceStore.getState().setVisualMode("diagnostic");
    const next = workspaceStore.getState();
    if (["idle", "failed"].includes(next.diagnosticStatus)) {
      void next.generateDiagnosticView(humanActionOptions(workspaceStore));
    }
  };
  const chooseModel = () => {
    workspaceStore.getState().setVisualMode("model");
    const next = workspaceStore.getState();
    if (
      webgl &&
      !next.isBusy &&
      (["idle", "failed", "cancelled"].includes(next.generationStatus) || next.modelError)
    ) {
      void next.start3DGeneration(humanActionOptions(workspaceStore));
    }
  };

  return (
    <section className="visual-workspace" aria-labelledby="visual-title">
      <div className="visual-toolbar">
        <div>
          <p className="eyebrow">Visual diagnosis</p>
          <h2 id="visual-title">See the damage clearly.</h2>
          <span>Choose a view, then select a numbered area.</span>
        </div>
        <fieldset className="view-tabs">
          <legend className="sr-only">Choose object view</legend>
          <button type="button" aria-pressed={state.visualMode === "photo"} onClick={choosePhoto}>
            <RepairIcon name="camera" /> Photo
          </button>
          <button
            type="button"
            aria-label={
              state.diagnosticStatus === "generating" ? "Damage map, generating" : "Damage map"
            }
            aria-pressed={state.visualMode === "diagnostic"}
            onClick={chooseDiagnostic}
          >
            <RepairIcon name="inspect" /> Damage map
            {state.diagnosticStatus === "generating" && <i aria-hidden="true" />}
          </button>
          <button
            type="button"
            aria-label={
              ["queued", "processing"].includes(state.generationStatus)
                ? "3D model, generating"
                : "3D model"
            }
            aria-pressed={showModel}
            onClick={chooseModel}
          >
            <RepairIcon name="cube" /> 3D model
            {["queued", "processing"].includes(state.generationStatus) && <i aria-hidden="true" />}
          </button>
        </fieldset>
      </div>
      <div className="visual-stage" data-mode={state.visualMode}>
        {showReadyModel && state.model ? (
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
              <RepairScene
                modelUrl={state.model.glbUrl}
                command={command}
                exploded={exploded}
                requestHeaders={modelRequestHeaders(state.model.glbUrl, state.sessionToken)}
              />
            </Suspense>
          </ModelBoundary>
        ) : showModel ? (
          <ModelProgress webgl={webgl} />
        ) : state.visualMode === "diagnostic" && state.image ? (
          <DiagnosticView source={state.image.previewUrl} objectName={objectName} />
        ) : state.image ? (
          <PhotoView source={state.image.previewUrl} objectName={objectName} />
        ) : null}
      </div>
      {state.modelError && (
        <p className="model-fallback-note" role="status">
          <RepairIcon name="info" /> The remote model blocked access, so the original photo is
          shown. Select 3D model to retry.
        </p>
      )}
      {showReadyModel && (
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
                workspaceStore
                  .getState()
                  .setExplodedView(!exploded, humanActionOptions(workspaceStore))
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
