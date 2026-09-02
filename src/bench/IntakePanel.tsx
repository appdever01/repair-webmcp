import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
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

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    const error = validateImageFile(file);
    setSelectionError(error);
    if (!error) workspaceStore.getState().selectImage(file);
  };

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
          <p className="eyebrow">Photo-guided repair</p>
          <h1 id="intake-title">Show us what needs fixing.</h1>
          <p className="hero-copy">
            Upload a clear photo. RE:PAIR identifies the object, labels visible areas, and guides a
            safe next step. A 3D model is optional after the guidance is ready.
          </p>
        </div>
        <div className="upload-card">
          <input
            ref={inputRef}
            id="object-photo"
            className="sr-only file-input"
            type="file"
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
                <div>
                  <RepairIcon name="check" />
                  <strong>{state.image.name}</strong>
                  <span>The image stays in this session until you choose to send it.</span>
                </div>
              </div>
            ) : (
              <div className="upload-empty">
                <span className="upload-icon">
                  <RepairIcon name="upload" size={28} />
                </span>
                <strong>Choose a photo</strong>
                <span>or drop it here</span>
                <small>JPEG, PNG, or WebP · up to 24 MB before compression</small>
              </div>
            )}
          </button>
          {state.uploaderPromptVisible && (
            <p className="agent-prompt-note">
              <RepairIcon name="agent" /> A browser agent opened this area. You must choose the
              file.
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
              <button type="button" onClick={() => inputRef.current?.click()}>
                <RepairIcon name="camera" /> Replace photo
              </button>
              <button type="button" onClick={() => workspaceStore.getState().removeImage()}>
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
          {state.image && (
            <div className="consent-block">
              <label className="consent-control">
                <input
                  type="checkbox"
                  checked={state.consentGranted}
                  onChange={(event) =>
                    workspaceStore.getState().setConsentGranted(event.currentTarget.checked)
                  }
                />
                <span>
                  I agree to send this image to OpenAI for analysis. It goes to the 3D provider only
                  if I later choose to build a model.
                </span>
              </label>
              <p>
                RE:PAIR does not save the uploaded image to browser storage. Provider retention and
                privacy terms apply.
              </p>
            </div>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={!state.image || !state.consentGranted || state.isBusy}
            onClick={() => void startAnalysis()}
          >
            <RepairIcon name="inspect" />
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
      <section className="how-it-works" aria-labelledby="how-title">
        <div>
          <p className="eyebrow">A careful path</p>
          <h2 id="how-title">How it works</h2>
        </div>
        <ol>
          <li>
            <b>1</b>
            <span>
              <strong>Share one clear view</strong>Show the object and visible damage without
              opening hazardous parts.
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              <strong>Review what we see</strong>Correct the name, inspect uncertainties, and answer
              only what you can observe.
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              <strong>Choose a safe next step</strong>Use cautious guidance or stop and contact a
              qualified professional.
            </span>
          </li>
        </ol>
      </section>
    </div>
  );
}
