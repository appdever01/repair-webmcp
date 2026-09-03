import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import {
  humanActionOptions,
  useWorkspaceStore,
  validateImageFile,
  workspaceStore,
} from "../workspace";
import {
  AgentGuide,
  AgentSection,
  HowItWorks,
  ObjectShowcase,
  SiteFooter,
} from "./LandingSections";

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
        <div className="intake-copy">
          <p className="eyebrow">Start with a photo</p>
          <h1 id="intake-title">One photo. A clearer fix.</h1>
          <p className="hero-copy">
            Drop in a photo. We’ll spot what’s wrong and guide you to the safest next step.
          </p>
        </div>
        <div className="upload-card">
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
                <strong>Drop or paste a photo</strong>
                <span>or click to browse</span>
                <small>JPEG, PNG, or WebP · up to 24 MB before compression</small>
              </div>
            )}
          </button>
          {state.uploaderPromptVisible && (
            <p className="agent-prompt-note">
              <RepairIcon name="agent" /> A browser agent opened this area. Drop, paste, or choose
              the image yourself.
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
              What seems wrong? <small>Optional</small>
            </span>
            <textarea
              id="problem-description"
              rows={3}
              maxLength={2_000}
              value={state.problemDescription}
              placeholder="For example: the handle wobbles and makes a clicking sound"
              onChange={(event) =>
                workspaceStore.getState().setProblemDescription(event.currentTarget.value)
              }
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!state.image || state.isBusy}
            aria-busy={state.isBusy}
            onClick={() => void startAnalysis()}
          >
            {state.isBusy ? (
              <span className="loading-spinner" aria-hidden="true" />
            ) : (
              <RepairIcon name="inspect" />
            )}
            {state.isBusy ? "Understanding your photo" : "Understand this object"}
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
          <p className="upload-disclosure">
            <RepairIcon name="shield" size={14} />
            <span>
              Your photo stays on this device until you start. It is then sent to OpenAI for
              analysis, and to the 3D provider only if you build a model. Nothing is kept in browser
              storage.
            </span>
          </p>
          <div className="sample-action">
            <span>Don’t have a photo ready? Try a sample:</span>
            <span className="sample-action-group">
              {sampleObjects.map((sample) => (
                <button key={sample.path} type="button" onClick={() => void selectSample(sample)}>
                  {sample.label}
                </button>
              ))}
            </span>
          </div>
        </div>
      </section>
      <HowItWorks />
      <ObjectShowcase />
      <AgentSection />
      <AgentGuide />
      <SiteFooter />
    </div>
  );
}
