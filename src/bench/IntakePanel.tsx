import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import {
  humanActionOptions,
  useWorkspaceStore,
  validateImageFile,
  workspaceStore,
} from "../workspace";
import { AgentSection, HowItWorks, ObjectShowcase, SiteFooter } from "./LandingSections";

const sampleObjects = [
  {
    label: "broken cup",
    path: "/sample-broken-cup.jpg",
    name: "sample-broken-cup.jpg",
    type: "image/jpeg",
  },
  { label: "desk lamp", path: "/fallback-lamp.webp", name: "sample-lamp.webp", type: "image/webp" },
] as const;

export function IntakePanel() {
  const state = useWorkspaceStore((current) => current);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const uploaderRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.uploaderFocusRequest === 0) return;
    uploaderRef.current?.focus();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    uploaderRef.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [state.uploaderFocusRequest]);

  const acceptFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const error = validateImageFile(file);
    setSelectionError(error);
    if (!error) workspaceStore.getState().selectImage(file);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pastedImage =
        Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.kind === "file" && item.type.startsWith("image/"))
          ?.getAsFile() ??
        Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));

      if (!pastedImage) return;
      event.preventDefault();
      acceptFile(pastedImage);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  const selectSample = async (sample: (typeof sampleObjects)[number]) => {
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      acceptFile(new File([blob], sample.name, { type: sample.type }));
    } catch {
      setSelectionError("The sample image could not be loaded. Choose a photo instead.");
    }
  };

  const startAnalysis = () =>
    workspaceStore.getState().analyzeUploadedObject(humanActionOptions(workspaceStore));

  return (
    <div className="intake-page">
      <section className="intake-hero" aria-labelledby="intake-title">
        <a className="hero-wordmark" href="#main-content" aria-label="RE:PAIR home">
          <img src="/repair-logo.png" alt="" width="32" height="32" />
          <span className="wordmark-text">
            RE<span aria-hidden="true">:</span>PAIR
          </span>
        </a>
        <div className="intake-copy">
          <p className="hero-kicker">
            <span aria-hidden="true" /> Visual repair intelligence
          </p>
          <h1 id="intake-title">
            <span className="hero-title-plain">One photo.</span>{" "}
            <span className="hero-title-block">A clearer fix.</span>
          </h1>
          <p className="hero-copy">
            Turn one photo into a clear, careful next step. Understand what failed, what to check,
            and when it is safer to stop.
          </p>
          <ul className="hero-proof" aria-label="RE:PAIR benefits">
            <li>Evidence-led</li>
            <li>Safety-aware</li>
            <li>You stay in control</li>
          </ul>
        </div>
        <div className="upload-stage">
          <div className="upload-card">
            <div className="upload-card-heading">
              <div>
                <span className="upload-card-index">01</span>
                <h2>Start a new repair</h2>
              </div>
              <p>
                <RepairIcon name="shield" size={14} /> Private until you start
              </p>
            </div>
            <input
              ref={inputRef}
              id="object-photo"
              className="sr-only file-input"
              type="file"
              hidden
              aria-label="Choose a photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
            />
            <button
              type="button"
              ref={uploaderRef}
              id="image-uploader"
              className="upload-surface"
              data-dragging={dragging}
              data-prompted={state.uploaderPromptVisible}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {state.image ? (
                <div className="selected-preview">
                  <img src={state.image.previewUrl} alt="Selected object preview" />
                </div>
              ) : (
                <div className="upload-empty">
                  <span className="upload-icon">
                    <RepairIcon name="upload" size={28} />
                  </span>
                  <strong>Drop or paste your photo</strong>
                  <span>or click anywhere to browse</span>
                  <small>JPEG, PNG or WebP · up to 24 MB</small>
                </div>
              )}
            </button>
            {state.uploaderPromptVisible && (
              <p className="agent-prompt-note">
                <RepairIcon name="agent" /> Assistance opened the image picker. Choose the image
                yourself.
              </p>
            )}
            {selectionError && (
              <p className="field-error" role="alert">
                {selectionError}
              </p>
            )}
            {state.operationError && (
              <p className="field-error" role="alert">
                {state.operationError}
              </p>
            )}
            {state.image && (
              <div className="image-actions">
                <button
                  type="button"
                  className="replace-image-action"
                  onClick={() => inputRef.current?.click()}
                >
                  <RepairIcon name="camera" /> Replace photo
                </button>
                <button
                  type="button"
                  className="remove-image-action"
                  onClick={() => workspaceStore.getState().removeImage()}
                >
                  <RepairIcon name="delete" /> Remove
                </button>
              </div>
            )}
            <label className="description-field" htmlFor="problem-description">
              <span>
                What are you noticing? <small>Optional</small>
              </span>
              <textarea
                id="problem-description"
                rows={2}
                maxLength={2_000}
                value={state.problemDescription}
                placeholder="e.g. The hinge is loose and clicks when opened"
                onChange={(event) =>
                  workspaceStore.getState().setProblemDescription(event.currentTarget.value)
                }
              />
            </label>
            <button
              type="button"
              className="primary-button hero-analyze-button"
              disabled={!state.image || state.isBusy}
              aria-busy={state.isBusy}
              onClick={() => void startAnalysis()}
            >
              {state.isBusy ? (
                <span className="loading-spinner" aria-hidden="true" />
              ) : (
                <RepairIcon name="inspect" />
              )}
              <span>{state.isBusy ? "Analyzing" : "Start analysis"}</span>
              {!state.isBusy && <RepairIcon name="forward" />}
            </button>
            {state.isBusy && (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  workspaceStore.getState().cancelCurrentTask(humanActionOptions(workspaceStore))
                }
              >
                <RepairIcon name="stop" /> Cancel
              </button>
            )}
            <div className="upload-card-footer">
              <div className="sample-action">
                <span>No photo?</span>
                <span className="sample-action-group">
                  {sampleObjects.map((sample) => (
                    <button
                      key={sample.path}
                      type="button"
                      onClick={() => void selectSample(sample)}
                    >
                      Try a {sample.label}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <HowItWorks />
      <ObjectShowcase />
      <AgentSection />
      <SiteFooter />
    </div>
  );
}
