import { createStore } from "zustand/vanilla";
import type { WorkspaceActionResult } from "../agent-runtime";
import type {
  GenerationError,
  GetModelGenerationResponse,
  HumanObservation,
} from "../generation/contracts";
import { validateImageFile } from "./image";
import { defaultWorkspaceServices, type WorkspaceServices } from "./services";
import type {
  QuestionAnswer,
  WorkspaceActionSource,
  WorkspaceState,
  WorkspaceVisualMode,
} from "./types";

export interface WorkspaceActionOptions {
  expectedStateVersion: number;
  source: WorkspaceActionSource;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface WorkspaceActions {
  selectImage(file: File): string | null;
  removeImage(): void;
  setProblemDescription(value: string): void;
  setObjectNameCorrection(value: string): void;
  setVisualMode(mode: WorkspaceVisualMode): void;
  setModelError(message: string): void;
  setActivityOpen(open: boolean): void;
  answerQuestion(questionId: string, observation: HumanObservation): void;
  generateDiagnosticView(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  loadNextQuestion(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  finishQuestioning(): void;
  openImageUploader(options: WorkspaceActionOptions): WorkspaceActionResult;
  analyzeUploadedObject(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  start3DGeneration(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  refreshGenerationStatus(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  focusHotspot(hotspotId: string, options: WorkspaceActionOptions): WorkspaceActionResult;
  setExplodedView(exploded: boolean, options: WorkspaceActionOptions): WorkspaceActionResult;
  requestHumanObservation(
    questionId: string,
    options: WorkspaceActionOptions,
  ): WorkspaceActionResult;
  draftRepairPlan(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  cancelCurrentTask(options: WorkspaceActionOptions): WorkspaceActionResult;
  undoAgentAction(activityId: string, options: WorkspaceActionOptions): WorkspaceActionResult;
  reset(): void;
  dispose(): void;
}

export type WorkspaceStoreState = WorkspaceState & WorkspaceActions;
export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

const initialState: WorkspaceState = {
  stage: "intake",
  stateVersion: 0,
  image: null,
  originalFile: null,
  compressedImage: null,
  problemDescription: "",
  analysis: null,
  objectNameCorrection: "",
  sessionToken: null,
  diagnosticImage: null,
  diagnosticStatus: "idle",
  diagnosticError: null,
  generationStatus: "idle",
  generationProgress: null,
  generationMessage: null,
  generationError: null,
  jobId: null,
  model: null,
  modelError: null,
  visualMode: "photo",
  exploded: false,
  focusedHotspotId: null,
  activeQuestionId: null,
  questions: [],
  questionStatus: "idle",
  questionMessage: null,
  questionError: null,
  answers: [],
  plan: null,
  operationError: null,
  isBusy: false,
  uploaderFocusRequest: 0,
  uploaderPromptVisible: false,
  activityOpen: false,
  announcement: "",
  reversibleActivity: null,
};

function createPreviewUrl(value: Blob): string {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(value)
    : `blob:repair-preview-${Date.now()}`;
}

function revokePreviewUrl(value: string | null | undefined) {
  if (value?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(value);
  }
}

function isCancelled(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function publicError(error: unknown): string {
  if (isCancelled(error)) return "The current task was cancelled.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong. Your photo and workspace are still available.";
}

function failure(message: string, recoverable = true): GenerationError {
  return { code: "MODEL_GENERATION_FAILED", message, recoverable };
}

export function createWorkspaceStore(services: WorkspaceServices = defaultWorkspaceServices) {
  let currentTaskController: AbortController | null = null;
  let currentTaskSequence = 0;
  let diagnosticTaskController: AbortController | null = null;
  let diagnosticTaskSequence = 0;
  let questionTaskController: AbortController | null = null;
  let questionTaskSequence = 0;
  let reversibleSequence = 0;
  let reversiblePatch: Partial<WorkspaceState> | null = null;

  const store = createStore<WorkspaceStoreState>()((set, get) => {
    const commit = (patch: Partial<WorkspaceState>) => {
      set((state) => ({ ...patch, stateVersion: state.stateVersion + 1 }));
    };

    const validVersion = (options: WorkspaceActionOptions) =>
      options.expectedStateVersion === get().stateVersion;

    const reversible = (title: string, patch: Partial<WorkspaceState>) => {
      reversibleSequence += 1;
      reversiblePatch = patch;
      return { activityId: `activity.${reversibleSequence}`, title };
    };

    const beginTask = (externalSignal?: AbortSignal) => {
      currentTaskController?.abort();
      const controller = new AbortController();
      currentTaskController = controller;
      currentTaskSequence += 1;
      const sequence = currentTaskSequence;
      const abort = () => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abort();
      else externalSignal?.addEventListener("abort", abort, { once: true });
      return {
        controller,
        sequence,
        release: () => externalSignal?.removeEventListener("abort", abort),
      };
    };

    const isCurrentTask = (sequence: number) =>
      currentTaskSequence === sequence && currentTaskController !== null;

    const beginDiagnosticTask = (externalSignal?: AbortSignal) => {
      diagnosticTaskController?.abort();
      const controller = new AbortController();
      diagnosticTaskController = controller;
      diagnosticTaskSequence += 1;
      const sequence = diagnosticTaskSequence;
      const abort = () => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abort();
      else externalSignal?.addEventListener("abort", abort, { once: true });
      return {
        controller,
        sequence,
        release: () => externalSignal?.removeEventListener("abort", abort),
      };
    };

    const isCurrentDiagnosticTask = (sequence: number) =>
      diagnosticTaskSequence === sequence && diagnosticTaskController !== null;

    const beginQuestionTask = (externalSignal?: AbortSignal) => {
      questionTaskController?.abort();
      const controller = new AbortController();
      questionTaskController = controller;
      questionTaskSequence += 1;
      const sequence = questionTaskSequence;
      const abort = () => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abort();
      else externalSignal?.addEventListener("abort", abort, { once: true });
      return {
        controller,
        sequence,
        release: () => externalSignal?.removeEventListener("abort", abort),
      };
    };

    const isCurrentQuestionTask = (sequence: number) =>
      questionTaskSequence === sequence && questionTaskController !== null;

    const applyGeneration = (response: GetModelGenerationResponse) => {
      if (response.status === "succeeded") {
        currentTaskController = null;
        commit({
          stage: "workspace",
          generationStatus: "succeeded",
          generationProgress: 100,
          generationMessage: response.message,
          generationError: null,
          model: response.model,
          operationError: null,
          exploded: false,
          isBusy: false,
          originalFile: null,
          announcement: "The interactive 3D model is ready.",
        });
        return true;
      }
      if (response.status === "failed" || response.status === "cancelled") {
        currentTaskController = null;
        commit({
          stage: "workspace",
          generationStatus: response.status,
          generationProgress: response.progress,
          generationMessage: response.message,
          generationError: response.error,
          model: null,
          operationError: response.error.message,
          exploded: false,
          isBusy: false,
          originalFile: null,
          announcement:
            response.status === "cancelled"
              ? "3D generation was cancelled. You can retry or return to the photo."
              : "The 3D model could not be built. You can retry or return to the photo.",
        });
        return true;
      }
      commit({
        stage: response.status === "queued" ? "generating" : "finishing",
        generationStatus: response.status,
        generationProgress: response.progress,
        generationMessage: response.message,
        announcement:
          response.status === "queued" ? "Building the 3D model." : "Finishing the workspace.",
      });
      return false;
    };

    const pollGeneration = async (sequence: number, signal: AbortSignal) => {
      let delay = 1_200;
      for (let attempt = 0; attempt < 48; attempt += 1) {
        try {
          await services.wait(delay, signal);
          if (!isCurrentTask(sequence)) return;
          const state = get();
          if (!state.sessionToken || !state.jobId) return;
          const response = await services.getModelGeneration(
            { sessionToken: state.sessionToken, jobId: state.jobId },
            signal,
          );
          if (!isCurrentTask(sequence)) return;
          if (applyGeneration(response)) return;
          delay = Math.min(8_000, Math.round(delay * 1.55));
        } catch (error) {
          if (!isCurrentTask(sequence)) return;
          if (isCancelled(error)) {
            currentTaskController = null;
            commit({
              stage: "workspace",
              generationStatus: "cancelled",
              generationProgress: null,
              generationError: failure("3D generation was cancelled."),
              generationMessage: "3D generation was cancelled.",
              isBusy: false,
              originalFile: null,
              announcement: "3D generation cancelled. The photo workspace remains available.",
            });
            return;
          }
          currentTaskController = null;
          commit({
            stage: "workspace",
            generationStatus: "failed",
            generationProgress: null,
            generationError: failure(publicError(error)),
            operationError: publicError(error),
            generationMessage: "The model status could not be refreshed.",
            isBusy: false,
            originalFile: null,
            announcement: "3D generation failed. Continue with the interactive photo.",
          });
          return;
        }
      }
      if (!isCurrentTask(sequence)) return;
      currentTaskController = null;
      commit({
        stage: "workspace",
        generationStatus: "failed",
        generationProgress: null,
        generationError: failure(
          "3D generation took too long. You can retry from the photo workspace.",
        ),
        operationError: "3D generation took too long. You can retry from the photo workspace.",
        generationMessage: "3D generation timed out.",
        isBusy: false,
        originalFile: null,
        announcement: "3D generation timed out. Continue with the interactive photo.",
      });
    };

    return {
      ...initialState,
      selectImage(file) {
        const validationError = validateImageFile(file);
        if (validationError) {
          commit({ announcement: validationError });
          return validationError;
        }
        const problemDescription = get().problemDescription;
        currentTaskController?.abort();
        currentTaskController = null;
        diagnosticTaskController?.abort();
        diagnosticTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        const previousUrl = get().image?.previewUrl;
        const previewUrl = createPreviewUrl(file);
        revokePreviewUrl(previousUrl);
        reversiblePatch = null;
        commit({
          ...initialState,
          stage: "image-ready",
          stateVersion: get().stateVersion,
          image: { name: file.name, previewUrl, width: null, height: null },
          originalFile: file,
          problemDescription,
          announcement: `${file.name} is ready to review before sending.`,
        });
        return null;
      },
      removeImage() {
        currentTaskController?.abort();
        currentTaskController = null;
        diagnosticTaskController?.abort();
        diagnosticTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        revokePreviewUrl(get().image?.previewUrl);
        reversiblePatch = null;
        commit({
          ...initialState,
          stateVersion: get().stateVersion,
          announcement: "Photo removed.",
        });
      },
      setProblemDescription(value) {
        commit({ problemDescription: value.slice(0, 2_000) });
      },
      setObjectNameCorrection(value) {
        commit({
          objectNameCorrection: value.slice(0, 160),
          announcement:
            "The displayed object name was updated. The original signed analysis is unchanged.",
        });
      },
      setVisualMode(mode) {
        commit({
          visualMode: mode,
          announcement:
            mode === "model"
              ? "3D workspace shown."
              : mode === "diagnostic"
                ? "Diagnostic damage map shown."
                : "Original photo shown.",
        });
      },
      setModelError(message) {
        commit({
          modelError: message,
          visualMode: "photo",
          exploded: false,
          announcement:
            "The 3D model could not be displayed. The interactive photo is still available.",
        });
      },
      setActivityOpen(open) {
        set({ activityOpen: open });
      },
      answerQuestion(id, observation) {
        const state = get();
        const question = state.questions.find((candidate) => candidate.id === id);
        if (!question || state.answers.some((answer) => answer.questionId === id)) return;
        const answer: QuestionAnswer = {
          questionId: id,
          question: question.prompt,
          observation,
        };
        commit({
          answers: [...state.answers, answer],
          activeQuestionId: null,
          questionStatus: "idle",
          questionMessage: null,
          announcement: "Observation recorded. AI is deciding what to ask next.",
        });
        const next = get();
        void next.loadNextQuestion({
          expectedStateVersion: next.stateVersion,
          source: "human",
        });
      },
      async generateDiagnosticView(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          state.diagnosticStatus === "generating" ||
          !state.analysis ||
          !state.sessionToken ||
          !state.compressedImage
        ) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        const task = beginDiagnosticTask(options.signal);
        commit({
          diagnosticStatus: "generating",
          diagnosticError: null,
          visualMode: "diagnostic",
          announcement: "OpenAI is creating a diagnostic damage map.",
        });
        try {
          const response = await services.generateDiagnosticView(
            {
              sessionToken: state.sessionToken,
              image: state.compressedImage,
              analysis: state.analysis,
            },
            task.controller.signal,
          );
          if (!isCurrentDiagnosticTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          diagnosticTaskController = null;
          commit({
            diagnosticImage: response.image,
            diagnosticStatus: "succeeded",
            diagnosticError: null,
            announcement: "The diagnostic damage map is ready. Verify it against the photo.",
          });
          return { ok: true };
        } catch (error) {
          if (!isCurrentDiagnosticTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          diagnosticTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            diagnosticStatus: "failed",
            diagnosticError: cancelled ? "Diagnostic view cancelled." : publicError(error),
            announcement: cancelled
              ? "Diagnostic view cancelled."
              : "The diagnostic view could not be created. The original photo is still available.",
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          task.release();
        }
      },
      async loadNextQuestion(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          !state.analysis ||
          !state.sessionToken ||
          !state.compressedImage ||
          state.questionStatus === "loading" ||
          state.questionStatus === "complete" ||
          state.analysis.safety.riskLevel === "professional_help_only" ||
          state.questions.some(
            (question) => !state.answers.some((answer) => answer.questionId === question.id),
          )
        ) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        const task = beginQuestionTask(options.signal);
        commit({
          questionStatus: "loading",
          questionError: null,
          activeQuestionId: null,
          announcement:
            state.answers.length === 0
              ? "AI is choosing a question from the uploaded image."
              : "AI is adapting the next question to your latest observation.",
        });
        try {
          const response = await services.getNextQuestion(
            {
              sessionToken: state.sessionToken,
              image: state.compressedImage,
              analysis: state.analysis,
              problemDescription: state.problemDescription,
              answers: [...state.answers],
            },
            task.controller.signal,
          );
          if (!isCurrentQuestionTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          questionTaskController = null;
          if (response.status === "ready") {
            commit({
              questionStatus: "complete",
              questionMessage: response.message,
              questionError: null,
              activeQuestionId: null,
              announcement: response.message,
            });
            return { ok: true };
          }
          const current = get();
          commit({
            questions: [...current.questions, response.question],
            questionStatus: "asking",
            questionMessage: response.message,
            questionError: null,
            activeQuestionId: response.question.id,
            focusedHotspotId: response.question.hotspotId ?? current.focusedHotspotId,
            announcement: `AI asks: ${response.question.prompt}`,
          });
          return { ok: true };
        } catch (error) {
          if (!isCurrentQuestionTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          questionTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            questionStatus: "failed",
            questionError: cancelled ? "Question generation was cancelled." : publicError(error),
            questionMessage: null,
            announcement: cancelled
              ? "Question generation was cancelled."
              : "The AI could not choose the next question. You can retry or continue.",
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          task.release();
        }
      },
      finishQuestioning() {
        const state = get();
        if (
          !state.analysis ||
          state.questions.some(
            (question) => !state.answers.some((answer) => answer.questionId === question.id),
          )
        ) {
          return;
        }
        questionTaskController?.abort();
        questionTaskController = null;
        questionTaskSequence += 1;
        commit({
          questionStatus: "complete",
          questionError: null,
          questionMessage: "Continuing with the evidence collected so far.",
          activeQuestionId: null,
          announcement: "The AI interview is complete. Repair guidance can now be prepared.",
        });
      },
      openImageUploader(options) {
        if (!validVersion(options) || get().isBusy) return { ok: false, code: "STALE_STATE" };
        const previous = {
          uploaderPromptVisible: get().uploaderPromptVisible,
          announcement: get().announcement,
        };
        commit({
          uploaderFocusRequest: get().uploaderFocusRequest + 1,
          uploaderPromptVisible: true,
          announcement:
            "Choose a photo in the highlighted upload area. The browser agent cannot choose a local file.",
          reversibleActivity: reversible("Opened the image uploader", previous),
        });
        return { ok: true };
      },
      async analyzeUploadedObject(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (!state.image || (!state.originalFile && !state.compressedImage) || state.isBusy) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        const task = beginTask(options.signal);
        commit({
          stage: "uploading",
          isBusy: true,
          generationError: null,
          operationError: null,
          announcement: "Uploading the selected photo.",
          reversibleActivity: null,
        });
        try {
          let image = get().compressedImage;
          if (!image) {
            const original = get().originalFile;
            if (!original) return { ok: false, code: "ACTION_NOT_AVAILABLE" };
            const prepared = await services.prepareImage(original, task.controller.signal);
            if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
            const previousUrl = get().image?.previewUrl;
            const previewUrl = createPreviewUrl(prepared.blob);
            commit({
              image: {
                name: original.name,
                previewUrl,
                width: prepared.width,
                height: prepared.height,
              },
              compressedImage: prepared.image,
            });
            revokePreviewUrl(previousUrl);
            image = prepared.image;
          }
          commit({
            stage: "understanding",
            announcement: "Understanding the object and visible condition.",
          });
          const response = await services.analyzeObject(
            {
              image,
              ...(get().problemDescription.trim()
                ? { problemDescription: get().problemDescription.trim() }
                : {}),
            },
            task.controller.signal,
          );
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          currentTaskController = null;
          const safetyStop = response.analysis.safety.riskLevel === "professional_help_only";
          commit({
            stage: safetyStop ? "safety-stop" : "analysis",
            analysis: response.analysis,
            sessionToken: response.sessionToken,
            objectNameCorrection: response.analysis.objectName,
            focusedHotspotId: response.analysis.hotspots[0]?.id ?? null,
            activeQuestionId: null,
            questions: [],
            questionStatus: safetyStop ? "complete" : "idle",
            questionMessage: safetyStop ? "The safety stop ends the AI interview." : null,
            questionError: null,
            answers: [],
            isBusy: false,
            originalFile: safetyStop ? null : get().originalFile,
            announcement: safetyStop
              ? "A safety stop is active. Qualified help is recommended."
              : `${response.analysis.objectName} identified. Review the findings as hypotheses.`,
          });
          if (!safetyStop) {
            const next = get();
            void next.loadNextQuestion({
              expectedStateVersion: next.stateVersion,
              source: options.source,
            });
          }
          return { ok: true };
        } catch (error) {
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          currentTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            stage: get().image ? "image-ready" : "intake",
            isBusy: false,
            originalFile: cancelled ? null : get().originalFile,
            operationError: cancelled ? null : publicError(error),
            announcement: cancelled ? "Analysis cancelled." : publicError(error),
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          task.release();
        }
      },
      async start3DGeneration(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (state.isBusy || !state.analysis || !state.sessionToken || !state.compressedImage) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        if (state.analysis.safety.riskLevel === "professional_help_only") {
          return { ok: false, code: "SAFETY_STOP" };
        }
        const task = beginTask(options.signal);
        commit({
          stage: "preparing",
          generationStatus: "queued",
          generationProgress: 5,
          generationMessage: "Preparing a clean reference.",
          generationError: null,
          operationError: null,
          isBusy: true,
          model: null,
          modelError: null,
          visualMode: "model",
          exploded: false,
          announcement: "Preparing a clean reference for the 3D provider.",
          reversibleActivity: null,
        });
        try {
          const response = await services.startModelGeneration(
            {
              sessionToken: state.sessionToken,
              image: state.compressedImage,
              analysis: state.analysis,
            },
            task.controller.signal,
          );
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          commit({
            stage: "generating",
            generationStatus: response.status,
            generationProgress: 12,
            generationMessage: response.message,
            jobId: response.jobId,
            announcement: "Building the 3D model.",
          });
          void pollGeneration(task.sequence, task.controller.signal).finally(task.release);
          return { ok: true };
        } catch (error) {
          task.release();
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          currentTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            stage: "workspace",
            generationStatus: cancelled ? "cancelled" : "failed",
            generationProgress: null,
            generationError: cancelled
              ? failure("3D generation was cancelled.")
              : failure(publicError(error)),
            operationError: cancelled ? null : publicError(error),
            generationMessage: cancelled
              ? "3D generation was cancelled."
              : "The 3D model could not be started.",
            isBusy: false,
            originalFile: null,
            exploded: false,
            announcement: cancelled
              ? "3D generation cancelled. The photo workspace remains available."
              : "3D generation failed. Continue with the interactive photo.",
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
      },
      async refreshGenerationStatus(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          !state.sessionToken ||
          !state.jobId ||
          !["queued", "processing"].includes(state.generationStatus)
        ) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        try {
          const response = await services.getModelGeneration(
            { sessionToken: state.sessionToken, jobId: state.jobId },
            options.signal ?? new AbortController().signal,
          );
          applyGeneration(response);
          return { ok: true };
        } catch (error) {
          if (isCancelled(error)) return { ok: false, code: "CANCELLED" };
          commit({
            announcement:
              "The model status could not be refreshed. Automatic polling will continue.",
          });
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
      },
      focusHotspot(id, options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (!state.analysis?.hotspots.some((hotspot) => hotspot.id === id)) {
          return { ok: false, code: "INVALID_INPUT" };
        }
        const hotspot = state.analysis.hotspots.find((item) => item.id === id);
        commit({
          focusedHotspotId: id,
          announcement: `${hotspot?.label ?? "Hotspot"} focused in the visual workspace and list.`,
          reversibleActivity: reversible("Focused a repair hotspot", {
            focusedHotspotId: state.focusedHotspotId,
            announcement: state.announcement,
          }),
        });
        return { ok: true };
      },
      setExplodedView(exploded, options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (!state.model || state.modelError) return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        commit({
          exploded,
          visualMode: "model",
          announcement: exploded
            ? "3D model parts are separated."
            : "3D model parts are reassembled.",
          reversibleActivity: reversible(
            exploded ? "Exploded the 3D model" : "Assembled the 3D model",
            {
              exploded: state.exploded,
              visualMode: state.visualMode,
              announcement: state.announcement,
            },
          ),
        });
        return { ok: true };
      },
      requestHumanObservation(id, options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        const exists = state.questions.some(
          (question) =>
            question.id === id && !state.answers.some((answer) => answer.questionId === id),
        );
        if (!exists) return { ok: false, code: "INVALID_INPUT" };
        commit({
          activeQuestionId: id,
          announcement: "A question is open for the person. The browser agent did not answer it.",
          reversibleActivity: reversible("Opened a human observation question", {
            activeQuestionId: state.activeQuestionId,
            announcement: state.announcement,
          }),
        });
        return { ok: true };
      },
      async draftRepairPlan(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (state.isBusy || !state.analysis || !state.sessionToken || state.plan) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        if (state.questionStatus !== "complete") {
          return { ok: false, code: "HUMAN_ACTION_REQUIRED" };
        }
        if (
          state.questions.some(
            (question) => !state.answers.some((answer) => answer.questionId === question.id),
          )
        ) {
          return { ok: false, code: "HUMAN_ACTION_REQUIRED" };
        }
        if (state.analysis.safety.riskLevel === "professional_help_only") {
          return { ok: false, code: "SAFETY_STOP" };
        }
        const task = beginTask(options.signal);
        commit({
          stage: "planning",
          isBusy: true,
          announcement: "Drafting cautious repair guidance.",
          reversibleActivity: null,
        });
        try {
          const response = await services.draftRepairPlan(
            {
              sessionToken: state.sessionToken,
              analysis: state.analysis,
              problemDescription: state.problemDescription,
              answers: [...state.answers],
            },
            task.controller.signal,
          );
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          currentTaskController = null;
          commit({
            stage: "guidance",
            plan: response.plan,
            operationError: null,
            isBusy: false,
            announcement: response.plan.professionalHelp.required
              ? "The guidance recommends qualified help."
              : "Cautious repair guidance is ready for human review.",
          });
          return { ok: true };
        } catch (error) {
          if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
          currentTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            stage: "workspace",
            isBusy: false,
            operationError: cancelled ? null : publicError(error),
            announcement: cancelled ? "Guidance request cancelled." : publicError(error),
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          task.release();
        }
      },
      cancelCurrentTask(options) {
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        const state = get();
        if (!state.isBusy || !currentTaskController)
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        currentTaskController.abort();
        currentTaskController = null;
        currentTaskSequence += 1;
        const wasGeneration = ["preparing", "generating", "finishing"].includes(state.stage);
        commit({
          stage: state.analysis ? "workspace" : state.image ? "image-ready" : "intake",
          generationStatus: wasGeneration ? "cancelled" : state.generationStatus,
          generationProgress: wasGeneration ? null : state.generationProgress,
          generationMessage: wasGeneration
            ? "3D generation was cancelled."
            : state.generationMessage,
          generationError: wasGeneration
            ? failure("3D generation was cancelled.")
            : state.generationError,
          operationError: null,
          isBusy: false,
          originalFile: state.analysis ? null : state.originalFile,
          exploded: wasGeneration ? false : state.exploded,
          announcement: "The current task was cancelled. The workspace remains available.",
        });
        return { ok: true };
      },
      undoAgentAction(id, options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          !state.reversibleActivity ||
          state.reversibleActivity.activityId !== id ||
          !reversiblePatch
        ) {
          return { ok: false, code: "NOT_REVERSIBLE" };
        }
        const patch = reversiblePatch;
        reversiblePatch = null;
        commit({
          ...patch,
          reversibleActivity: null,
          announcement: "The last reversible workspace action was undone.",
        });
        return { ok: true };
      },
      reset() {
        currentTaskController?.abort();
        currentTaskController = null;
        currentTaskSequence += 1;
        diagnosticTaskController?.abort();
        diagnosticTaskController = null;
        diagnosticTaskSequence += 1;
        questionTaskController?.abort();
        questionTaskController = null;
        questionTaskSequence += 1;
        revokePreviewUrl(get().image?.previewUrl);
        reversiblePatch = null;
        set({
          ...initialState,
          stateVersion: get().stateVersion + 1,
          announcement: "Workspace reset.",
        });
      },
      dispose() {
        currentTaskController?.abort();
        currentTaskController = null;
        diagnosticTaskController?.abort();
        diagnosticTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        revokePreviewUrl(get().image?.previewUrl);
      },
    };
  });

  return store;
}

export const workspaceStore = createWorkspaceStore();

export function humanActionOptions(store: WorkspaceStore): WorkspaceActionOptions {
  return { source: "human", expectedStateVersion: store.getState().stateVersion };
}
