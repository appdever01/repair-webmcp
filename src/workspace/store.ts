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
  openImageUploader(options: WorkspaceActionOptions): WorkspaceActionResult;
  analyzeUploadedObject(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  start3DGeneration(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  refreshGenerationStatus(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  focusHotspot(hotspotId: string, options: WorkspaceActionOptions): WorkspaceActionResult;
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
  generationStatus: "idle",
  generationMessage: null,
  generationError: null,
  jobId: null,
  model: null,
  modelError: null,
  visualMode: "photo",
  focusedHotspotId: null,
  activeQuestionId: null,
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

function questionId(index: number): string {
  return `question.${index + 1}`;
}

function failure(message: string, recoverable = true): GenerationError {
  return { code: "MODEL_GENERATION_FAILED", message, recoverable };
}

export function createWorkspaceStore(services: WorkspaceServices = defaultWorkspaceServices) {
  let currentTaskController: AbortController | null = null;
  let currentTaskSequence = 0;
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

    const applyGeneration = (response: GetModelGenerationResponse) => {
      if (response.status === "succeeded") {
        currentTaskController = null;
        commit({
          stage: "workspace",
          generationStatus: "succeeded",
          generationMessage: response.message,
          generationError: null,
          model: response.model,
          operationError: null,
          visualMode: "model",
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
          generationMessage: response.message,
          generationError: response.error,
          model: null,
          operationError: response.error.message,
          visualMode: "photo",
          isBusy: false,
          originalFile: null,
          announcement:
            response.status === "cancelled"
              ? "3D generation was cancelled. The photo workspace remains available."
              : "The 3D model could not be built. The photo workspace remains available.",
        });
        return true;
      }
      commit({
        stage: response.status === "queued" ? "generating" : "finishing",
        generationStatus: response.status,
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
              generationError: failure("3D generation was cancelled."),
              generationMessage: "3D generation was cancelled.",
              visualMode: "photo",
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
            generationError: failure(publicError(error)),
            operationError: publicError(error),
            generationMessage: "The model status could not be refreshed.",
            visualMode: "photo",
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
        generationError: failure(
          "3D generation took too long. You can retry from the photo workspace.",
        ),
        operationError: "3D generation took too long. You can retry from the photo workspace.",
        generationMessage: "3D generation timed out.",
        visualMode: "photo",
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
        const nextMode = mode === "model" && !get().model ? "photo" : mode;
        commit({
          visualMode: nextMode,
          announcement: nextMode === "model" ? "3D model shown." : "Photo shown.",
        });
      },
      setModelError(message) {
        commit({
          modelError: message,
          visualMode: "photo",
          announcement:
            "The 3D model could not be displayed. The interactive photo is still available.",
        });
      },
      setActivityOpen(open) {
        set({ activityOpen: open });
      },
      answerQuestion(id, observation) {
        const state = get();
        const index = state.analysis?.clarifyingQuestions.findIndex(
          (_, questionIndex) => questionId(questionIndex) === id,
        );
        if (index === undefined || index < 0 || !state.analysis) return;
        const answer: QuestionAnswer = {
          questionId: id,
          question: state.analysis.clarifyingQuestions[index] ?? "Clarifying question",
          observation,
        };
        commit({
          answers: [...state.answers.filter((item) => item.questionId !== id), answer],
          activeQuestionId: null,
          announcement: "Observation recorded from the person using the workspace.",
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
            answers: [],
            isBusy: false,
            originalFile: safetyStop ? null : get().originalFile,
            announcement: safetyStop
              ? "A safety stop is active. Qualified help is recommended."
              : `${response.analysis.objectName} identified. Review the findings as hypotheses.`,
          });
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
          generationMessage: "Preparing a clean reference.",
          generationError: null,
          operationError: null,
          isBusy: true,
          model: null,
          modelError: null,
          visualMode: "photo",
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
            generationError: cancelled
              ? failure("3D generation was cancelled.")
              : failure(publicError(error)),
            operationError: cancelled ? null : publicError(error),
            generationMessage: cancelled
              ? "3D generation was cancelled."
              : "The 3D model could not be started.",
            isBusy: false,
            originalFile: null,
            visualMode: "photo",
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
      requestHumanObservation(id, options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        const exists = state.analysis?.clarifyingQuestions.some(
          (_, index) =>
            questionId(index) === id && !state.answers.some((answer) => answer.questionId === id),
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
        if (state.answers.length < state.analysis.clarifyingQuestions.length) {
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
              observations: state.answers.map((answer) => answer.observation),
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
          generationMessage: wasGeneration
            ? "3D generation was cancelled."
            : state.generationMessage,
          generationError: wasGeneration
            ? failure("3D generation was cancelled.")
            : state.generationError,
          operationError: null,
          isBusy: false,
          originalFile: state.analysis ? null : state.originalFile,
          visualMode: "photo",
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
