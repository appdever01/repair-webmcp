import { Component, lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import { repairGuideSteps } from "../generation/repairGuide";
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
        <div className="photo-frame">
          <img src={source} alt={`Original view of ${objectName}`} />
        </div>
        <figcaption>Original</figcaption>
      </figure>
      <figure className="diagnostic-frame diagnostic-map-frame">
        {diagnosticSource ? (
          <>
            <img src={diagnosticSource} alt={`AI diagnostic damage map of ${objectName}`} />
            <figcaption>AI map</figcaption>
          </>
        ) : state.diagnosticStatus === "generating" ? (
          <div className="diagnostic-loading" role="status">
            <span className="diagnostic-scan" aria-hidden="true" />
            <RepairIcon name="inspect" size={30} />
            <strong>Drawing damage map</strong>
            <div className="indeterminate-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : (
          <div className="diagnostic-loading" role={state.diagnosticError ? "alert" : "status"}>
            <RepairIcon name={state.diagnosticError ? "warning" : "inspect"} size={30} />
            {state.diagnosticError && (
              <>
                <strong>Damage map unavailable</strong>
                <p>{state.diagnosticError}</p>
              </>
            )}
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

function RepairGuideView({ source, objectName }: { source: string; objectName: string }) {
  const state = useWorkspaceStore((current) => current);
  const steps = state.plan ? repairGuideSteps(state.plan) : [];
  const activeIndex = Math.min(state.activeRepairStepIndex, Math.max(steps.length - 1, 0));
  const activeStep = steps[activeIndex];
  const visual = state.repairStepVisuals[activeIndex];
  const generatedSource = visual?.image
    ? `data:${visual.image.mediaType};base64,${visual.image.base64}`
    : null;

  if (!activeStep) return null;

  return (
    <div className="repair-guide-canvas">
      <figure className="repair-guide-frame">
        {generatedSource ? (
          <img
            src={generatedSource}
            alt={`Wireframe for step ${activeIndex + 1}: ${activeStep.step.title}`}
          />
        ) : (
          <img className="repair-guide-source" src={source} alt={objectName} />
        )}
        {!generatedSource && (
          <div
            className="repair-guide-generation"
            role={visual?.status === "failed" ? "alert" : "status"}
          >
            {visual?.status !== "failed" && <span className="guide-scan-line" aria-hidden="true" />}
            <span className="guide-drawing-mark" aria-hidden="true">
              <RepairIcon name={visual?.status === "failed" ? "warning" : "repair"} size={30} />
            </span>
            <strong>
              {visual?.status === "failed"
                ? "Visual unavailable"
                : `Drawing step ${activeIndex + 1}`}
            </strong>
            {visual?.status !== "failed" && (
              <div
                className="indeterminate-progress guide-progress"
                role="progressbar"
                aria-label={`Generating visual for step ${activeIndex + 1}`}
              >
                <span />
              </div>
            )}
            {visual?.status === "failed" && (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void workspaceStore
                    .getState()
                    .generateRepairStepVisuals(humanActionOptions(workspaceStore))
                }
              >
                <RepairIcon name="reset" /> Retry visual
              </button>
            )}
          </div>
        )}
        <figcaption>
          Step {activeIndex + 1} / {steps.length}
        </figcaption>
      </figure>
      <nav className="repair-guide-steps" aria-label="Repair guide steps">
        {steps.map(({ kind, step }, index) => (
          <button
            key={`${kind}-${step.title}`}
            type="button"
            aria-label={`Show step ${index + 1}: ${step.title}`}
            aria-current={index === activeIndex ? "step" : undefined}
            data-status={state.repairStepVisuals[index]?.status ?? "idle"}
            onClick={() => workspaceStore.getState().setActiveRepairStep(index)}
          >
            <span>{index + 1}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function RepairGuideVisual() {
  const state = useWorkspaceStore((current) => current);
  const [webgl] = useState(supportsWebGL);
  const [command] = useState<SceneCommand>({ id: 0, type: "reset" });
  const objectName = state.objectNameCorrection || state.analysis?.objectName || "the object";
  const showModel = state.visualMode === "model";
  const showReadyModel = Boolean(showModel && state.model && webgl && !state.modelError);

  useEffect(() => {
    if (showReadyModel) void loadScene().catch(() => undefined);
  }, [showReadyModel]);

  if (!state.image || !state.plan) return null;

  return (
    <section
      className="repair-guide-visual"
      data-view={showModel ? "model" : "steps"}
      aria-label={showModel ? "Interactive 3D object" : "Illustrated repair step"}
    >
      {showReadyModel && state.model ? (
        <ModelBoundary
          modelKey={state.model.glbUrl}
          onFailure={() => {
            workspaceStore.getState().setModelError("The 3D model could not be loaded.");
            workspaceStore.getState().setVisualMode("guide");
          }}
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
              exploded={state.exploded}
              requestHeaders={modelRequestHeaders(state.model.glbUrl, state.sessionToken)}
            />
            <span className="guide-model-hint">Drag to rotate · scroll to zoom</span>
          </Suspense>
        </ModelBoundary>
      ) : showModel ? (
        <ModelProgress webgl={webgl} guideContext />
      ) : (
        <RepairGuideView source={state.image.previewUrl} objectName={objectName} />
      )}
    </section>
  );
}

function ModelProgress({
  webgl,
  guideContext = false,
}: {
  webgl: boolean;
  guideContext?: boolean;
}) {
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
        <p>
          {guideContext
            ? "Your illustrated repair steps remain fully usable."
            : "The photo and AI damage map remain fully usable."}
        </p>
      </div>
    );
  }

  if (active) {
    return (
      <div className="model-generation-state" role="status">
        <div className="model-cube-loader" aria-hidden="true">
          <span className="loading-cube loading-cube-main">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="loading-cube loading-cube-left">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="loading-cube loading-cube-right">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="model-build-copy">
          <small>3D reconstruction</small>
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
          <span>
            {guideContext
              ? "You can switch back to the steps anytime"
              : "You can keep reviewing the damage map"}
          </span>
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
      <small>3D reconstruction</small>
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
            "Rotate, zoom, and inspect the object from every angle once the model is ready.")}
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
  const guideAvailable = Boolean(state.plan && repairGuideSteps(state.plan).length > 0);
  const showModel = state.visualMode === "model";
  const showGuide = state.visualMode === "guide" && guideAvailable;
  const showReadyModel = showModel && modelAvailable;
  const objectName = state.objectNameCorrection || state.analysis?.objectName || "the object";
  const exploded = state.exploded;

  useEffect(() => {
    if (showReadyModel) void loadScene().catch(() => undefined);
  }, [showReadyModel]);

  const nextCommand = (type: SceneCommand["type"]) =>
    setCommand((current) => ({ id: current.id + 1, type }));
  const chooseDiagnostic = () => {
    workspaceStore.getState().setVisualMode("diagnostic");
    const next = workspaceStore.getState();
    if (["idle", "failed"].includes(next.diagnosticStatus)) {
      void next.generateDiagnosticView(humanActionOptions(workspaceStore));
    }
  };
  const chooseGuide = () => {
    workspaceStore.getState().setGuidePageOpen(true);
    const next = workspaceStore.getState();
    if (
      next.repairStepVisuals.length > 0 &&
      !next.repairStepVisuals.some((visual) => visual.status === "generating") &&
      next.repairStepVisuals.some(
        (visual) => visual.status === "idle" || visual.status === "failed",
      )
    ) {
      void next.generateRepairStepVisuals(humanActionOptions(workspaceStore));
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
    <section className="visual-workspace" aria-label="Object views">
      <div className="visual-toolbar">
        <fieldset className="view-tabs">
          <legend className="sr-only">Choose object view</legend>
          {guideAvailable && (
            <button
              type="button"
              aria-label="Repair guide"
              aria-pressed={showGuide}
              onClick={chooseGuide}
            >
              <RepairIcon name="repair" /> Repair guide
              {state.repairStepVisuals.some((visual) => visual.status === "generating") && (
                <i aria-hidden="true" />
              )}
            </button>
          )}
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
        {showGuide && state.image ? (
          <RepairGuideView source={state.image.previewUrl} objectName={objectName} />
        ) : showReadyModel && state.model ? (
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
        ) : state.image ? (
          <DiagnosticView source={state.image.previewUrl} objectName={objectName} />
        ) : null}
      </div>
      {state.modelError && (
        <p className="model-fallback-note" role="status">
          <RepairIcon name="info" /> The remote model blocked access, so the damage map is shown.
          Select 3D model to retry.
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
