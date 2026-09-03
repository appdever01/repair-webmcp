import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import {
  humanActionOptions,
  useWorkspaceStore,
  validateImageFile,
  workspaceStore,
} from "../workspace";

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

  const selectSample = async () => {
    try {
      const response = await fetch("/fallback-lamp.webp");
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      acceptFile(new File([blob], "sample-lamp.webp", { type: "image/webp" }));
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
          <div className="sample-action">
            <span>Don’t have a photo ready?</span>
            <button type="button" onClick={() => void selectSample()}>
              Try the sample lamp
            </button>
          </div>
        </div>
      </section>
      <section className="object-showcase" aria-labelledby="object-showcase-title">
        <div className="object-showcase-heading">
          <p className="eyebrow">Built for everyday objects</p>
          <h2 id="object-showcase-title">The things you actually use.</h2>
        </div>
        <div className="object-stage">
          <figure className="repair-object repair-object-phone">
            <img
              src="/repair-phone.png"
              alt="A phone with a cracked screen and loose charging port highlighted."
              width="488"
              height="760"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Cracked screen</figcaption>
          </figure>
          <figure className="repair-object repair-object-sneaker">
            <img
              src="/repair-sneaker.png"
              alt="A sneaker with a peeling sole highlighted and its layers separated."
              width="760"
              height="461"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Peeling sole</figcaption>
          </figure>
          <figure className="repair-object repair-object-bike">
            <img
              src="/repair-bike.png"
              alt="A bicycle with its slipped chain and rear gear highlighted."
              width="760"
              height="452"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Slipped chain</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}
