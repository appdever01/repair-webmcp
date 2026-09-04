import { createStore } from "zustand/vanilla";
import type { WorkspaceActionResult } from "../agent-runtime";
import { type DemoObjectId, demoObjects } from "../demoObjects";
import type {
  GenerationError,
  GetModelGenerationResponse,
  HumanObservation,
} from "../generation/contracts";
import { repairGuideSteps } from "../generation/repairGuide";
import { validateImageFile } from "./image";
import {
  browserWorkspacePersistence,
  type PersistedWorkspaceRecord,
  type WorkspacePersistence,
} from "./persistence";
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
  hydrateWorkspace(): Promise<void>;
  selectImage(file: File): string | null;
  removeImage(): void;
  setProblemDescription(value: string): void;
  setObjectNameCorrection(value: string): void;
  setVisualMode(mode: WorkspaceVisualMode): void;
  setGuidePageOpen(open: boolean): void;
  setActiveRepairStep(index: number): void;
  setModelError(message: string | null): void;
  setActivityOpen(open: boolean): void;
  askRepairAssistant(
    question: string,
    options: WorkspaceActionOptions,
  ): Promise<WorkspaceActionResult>;
  clearAssistantChat(): void;
  answerQuestion(questionId: string, observation: HumanObservation): void;
  generateDiagnosticView(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  generateRepairStepVisuals(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  loadNextQuestion(options: WorkspaceActionOptions): Promise<WorkspaceActionResult>;
  finishQuestioning(): void;
  openImageUploader(options: WorkspaceActionOptions): WorkspaceActionResult;
  selectDemoObject(
    sampleId: DemoObjectId,
    options: WorkspaceActionOptions,
  ): Promise<WorkspaceActionResult>;
  importImageFromUrl(
    imageUrl: string,
    options: WorkspaceActionOptions,
  ): Promise<WorkspaceActionResult>;
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
  hasHydrated: true,
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
  visualMode: "diagnostic",
  guidePageOpen: false,
  exploded: false,
  focusedHotspotId: null,
  activeQuestionId: null,
  questions: [],
  questionStatus: "idle",
  questionMessage: null,
  questionError: null,
  answers: [],
  plan: null,
  planToken: null,
  repairStepVisuals: [],
  activeRepairStepIndex: 0,
  operationError: null,
  isBusy: false,
  uploaderFocusRequest: 0,
  uploaderPromptVisible: false,
  activityOpen: false,
  assistantMessages: [],
  assistantChatStatus: "idle",
  assistantChatError: null,
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

function isSessionExpired(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code?: unknown }).code === "SESSION_EXPIRED"
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

function workspaceStateSnapshot(state: WorkspaceStoreState): WorkspaceState {
  return Object.fromEntries(
    (Object.keys(initialState) as Array<keyof WorkspaceState>).map((key) => [key, state[key]]),
  ) as unknown as WorkspaceState;
}

function persistedWorkspaceRecord(state: WorkspaceStoreState): PersistedWorkspaceRecord {
  const snapshot = workspaceStateSnapshot(state);
  const { hasHydrated: _hasHydrated, image, isBusy: _isBusy, ...rest } = snapshot;
  return {
    version: 1,
    state: {
      ...rest,
      image: image ? { name: image.name, width: image.width, height: image.height } : null,
      isBusy: false,
    },
  };
}

function restoredWorkspaceState(record: PersistedWorkspaceRecord): WorkspaceState {
  const saved = record.state;
  const originalFile =
    typeof File !== "undefined" && saved.originalFile instanceof File ? saved.originalFile : null;
  const previewUrl = originalFile
    ? createPreviewUrl(originalFile)
    : saved.compressedImage
      ? `data:${saved.compressedImage.mediaType};base64,${saved.compressedImage.base64}`
      : null;
  const interruptedModel = ["queued", "processing"].includes(saved.generationStatus);
  const interruptedStage = [
    "uploading",
    "understanding",
    "preparing",
    "generating",
    "finishing",
    "planning",
  ].includes(saved.stage);
  const stage = interruptedStage
    ? saved.plan
      ? "guidance"
      : saved.analysis?.safety.riskLevel === "professional_help_only"
        ? "safety-stop"
        : saved.analysis
          ? "analysis"
          : saved.image
            ? "image-ready"
            : "intake"
    : saved.stage;

  return {
    ...initialState,
    ...saved,
    hasHydrated: true,
    stage,
    image:
      saved.image && previewUrl
        ? {
            ...saved.image,
            previewUrl,
          }
        : null,
    originalFile,
    diagnosticStatus: saved.diagnosticStatus === "generating" ? "idle" : saved.diagnosticStatus,
    generationStatus: interruptedModel ? "failed" : saved.generationStatus,
    generationProgress: interruptedModel ? null : saved.generationProgress,
    generationMessage: interruptedModel
      ? "3D generation was interrupted by the refresh."
      : saved.generationMessage,
    generationError: interruptedModel
      ? failure("3D generation was interrupted by the refresh. You can retry it.")
      : saved.generationError,
    questionStatus: saved.questionStatus === "loading" ? "idle" : saved.questionStatus,
    guidePageOpen: saved.guidePageOpen || (saved.visualMode === "guide" && Boolean(saved.plan)),
    assistantChatStatus:
      saved.assistantChatStatus === "sending" ? "failed" : saved.assistantChatStatus,
    assistantChatError:
      saved.assistantChatStatus === "sending"
        ? "The previous message was interrupted by the refresh."
        : saved.assistantChatError,
    repairStepVisuals: saved.repairStepVisuals.map((visual) =>
      visual.status === "generating" ? { ...visual, status: "idle" } : visual,
    ),
    uploaderFocusRequest: 0,
    uploaderPromptVisible: false,
    isBusy: false,
    announcement: saved.analysis ? "Your repair workspace was restored." : saved.announcement,
  };
}

export function createWorkspaceStore(
  services: WorkspaceServices = defaultWorkspaceServices,
  persistence: WorkspacePersistence = browserWorkspacePersistence,
) {
  const storeInitialState = { ...initialState, hasHydrated: !persistence.available };
  let persistenceReady = !persistence.available;
  let persistenceQueue = Promise.resolve();
  let currentTaskController: AbortController | null = null;
  let currentTaskSequence = 0;
  let diagnosticTaskController: AbortController | null = null;
  let diagnosticTaskSequence = 0;
  let repairVisualTaskController: AbortController | null = null;
  let repairVisualTaskSequence = 0;
  let questionTaskController: AbortController | null = null;
  let questionTaskSequence = 0;
  let assistantTaskController: AbortController | null = null;
  let assistantTaskSequence = 0;
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

    const beginRepairVisualTask = (externalSignal?: AbortSignal) => {
      repairVisualTaskController?.abort();
      const controller = new AbortController();
      repairVisualTaskController = controller;
      repairVisualTaskSequence += 1;
      const sequence = repairVisualTaskSequence;
      const abort = () => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abort();
      else externalSignal?.addEventListener("abort", abort, { once: true });
      return {
        controller,
        sequence,
        release: () => externalSignal?.removeEventListener("abort", abort),
      };
    };

    const isCurrentRepairVisualTask = (sequence: number) =>
      repairVisualTaskSequence === sequence && repairVisualTaskController !== null;

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

    const beginAssistantTask = (externalSignal?: AbortSignal) => {
      assistantTaskController?.abort();
      const controller = new AbortController();
      assistantTaskController = controller;
      assistantTaskSequence += 1;
      const sequence = assistantTaskSequence;
      const abort = () => controller.abort(externalSignal?.reason);
      if (externalSignal?.aborted) abort();
      else externalSignal?.addEventListener("abort", abort, { once: true });
      return {
        controller,
        sequence,
        release: () => externalSignal?.removeEventListener("abort", abort),
      };
    };

    const isCurrentAssistantTask = (sequence: number) =>
      assistantTaskSequence === sequence && assistantTaskController !== null;

    const loadImageIntoWorkspace = async (
      url: string,
      preferredName: string | undefined,
      options: WorkspaceActionOptions,
    ): Promise<WorkspaceActionResult> => {
      const state = get();
      if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
      if (state.image || state.isBusy) return { ok: false, code: "ACTION_NOT_AVAILABLE" };
      try {
        const file = await services.loadImageFile(
          url,
          preferredName,
          options.signal ?? new AbortController().signal,
        );
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        const validationError = get().selectImage(file);
        return validationError ? { ok: false, code: "INVALID_INPUT" } : { ok: true };
      } catch (error) {
        if (isCancelled(error) || options.signal?.aborted) {
          return { ok: false, code: "CANCELLED" };
        }
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        const message = publicError(error);
        commit({ operationError: message, announcement: message });
        return { ok: false, code: "ACTION_NOT_AVAILABLE" };
      }
    };

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
      ...storeInitialState,
      async hydrateWorkspace() {
        if (get().hasHydrated) return;
        const record = await persistence.load();
        if (record) {
          try {
            revokePreviewUrl(get().image?.previewUrl);
            set(restoredWorkspaceState(record));
          } catch {
            await persistence.clear();
            set({ hasHydrated: true });
          }
        } else {
          set({ hasHydrated: true });
        }
        persistenceReady = true;
        const restored = get();
        if (
          restored.analysis &&
          restored.sessionToken &&
          restored.compressedImage &&
          restored.diagnosticStatus === "idle"
        ) {
          void restored.generateDiagnosticView({
            expectedStateVersion: restored.stateVersion,
            source: "human",
          });
          return;
        }
        if (
          restored.analysis &&
          restored.sessionToken &&
          restored.compressedImage &&
          restored.diagnosticStatus === "succeeded" &&
          restored.questionStatus === "idle" &&
          !restored.plan
        ) {
          void restored.loadNextQuestion({
            expectedStateVersion: restored.stateVersion,
            source: "human",
          });
        }
        if (
          restored.plan &&
          restored.planToken &&
          restored.repairStepVisuals.some((visual) => visual.status === "idle")
        ) {
          void restored.generateRepairStepVisuals({
            expectedStateVersion: get().stateVersion,
            source: "human",
          });
        }
      },
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
        repairVisualTaskController?.abort();
        repairVisualTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        assistantTaskController?.abort();
        assistantTaskController = null;
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
        repairVisualTaskController?.abort();
        repairVisualTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        assistantTaskController?.abort();
        assistantTaskController = null;
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
                : "Step-by-step repair visual shown.",
        });
      },
      setGuidePageOpen(open) {
        commit({
          guidePageOpen: open,
          visualMode: open ? "guide" : get().visualMode,
          announcement: open ? "Step-by-step repair guide opened." : "Repair findings shown.",
        });
      },
      setActiveRepairStep(index) {
        const state = get();
        const steps = state.plan ? repairGuideSteps(state.plan) : [];
        if (!steps[index]) return;
        commit({
          activeRepairStepIndex: index,
          visualMode: "guide",
          announcement: `Repair step ${index + 1} of ${steps.length} shown.`,
        });
      },
      setModelError(message) {
        commit({
          modelError: message,
          visualMode: "model",
          exploded: false,
          announcement: message
            ? "The 3D model is ready, but the viewer could not display it."
            : "Retrying the completed 3D model in the viewer.",
        });
      },
      setActivityOpen(open) {
        set({ activityOpen: open });
      },
      async askRepairAssistant(question, options) {
        const state = get();
        const content = question.trim();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          !content ||
          content.length > 1_200 ||
          state.assistantChatStatus === "sending" ||
          !state.analysis ||
          !state.sessionToken ||
          !state.plan ||
          !state.planToken ||
          !state.compressedImage
        ) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        const task = beginAssistantTask(options.signal);
        const messages = [
          ...state.assistantMessages.slice(-22),
          { role: "user" as const, content },
        ];
        commit({
          assistantMessages: messages,
          assistantChatStatus: "sending",
          assistantChatError: null,
          activityOpen: true,
          announcement: "The repair assistant is answering your question.",
        });
        try {
          const response = await services.askRepairAssistant(
            {
              sessionToken: state.sessionToken,
              planToken: state.planToken,
              image: state.compressedImage,
              analysis: state.analysis,
              plan: state.plan,
              activeStepIndex: state.activeRepairStepIndex,
              messages,
            },
            task.controller.signal,
          );
          if (!isCurrentAssistantTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          assistantTaskController = null;
          commit({
            assistantMessages: [
              ...get().assistantMessages,
              { role: "assistant", content: response.answer },
            ],
            assistantChatStatus: "idle",
            assistantChatError: null,
            announcement: "The repair assistant answered your question.",
          });
          return { ok: true };
        } catch (error) {
          if (!isCurrentAssistantTask(task.sequence)) {
            return { ok: false, code: "CANCELLED" };
          }
          assistantTaskController = null;
          const cancelled = isCancelled(error) || task.controller.signal.aborted;
          commit({
            assistantChatStatus: cancelled ? "idle" : "failed",
            assistantChatError: cancelled ? null : publicError(error),
            announcement: cancelled
              ? "The assistant response was cancelled."
              : "The repair assistant could not answer. You can try again.",
          });
          return cancelled
            ? { ok: false, code: "CANCELLED" }
            : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          task.release();
        }
      },
      clearAssistantChat() {
        assistantTaskController?.abort();
        assistantTaskController = null;
        assistantTaskSequence += 1;
        commit({
          assistantMessages: [],
          assistantChatStatus: "idle",
          assistantChatError: null,
          announcement: "Assistant conversation cleared.",
        });
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
          announcement: "Detail added. Updating the repair guide.",
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
          announcement: "AI is creating a diagnostic damage map.",
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
          const next = get();
          if (
            next.analysis?.safety.riskLevel !== "professional_help_only" &&
            next.questionStatus === "idle"
          ) {
            void next.loadNextQuestion({
              expectedStateVersion: next.stateVersion,
              source: options.source,
            });
          }
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
      async generateRepairStepVisuals(options) {
        const state = get();
        if (!validVersion(options)) return { ok: false, code: "STALE_STATE" };
        if (
          !state.analysis ||
          !state.sessionToken ||
          !state.plan ||
          !state.planToken ||
          !state.compressedImage ||
          state.plan.professionalHelp.required ||
          state.repairStepVisuals.some((visual) => visual.status === "generating")
        ) {
          return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        }
        const steps = repairGuideSteps(state.plan);
        if (steps.length === 0) return { ok: false, code: "ACTION_NOT_AVAILABLE" };
        const task = beginRepairVisualTask(options.signal);
        const regenerateAll =
          state.repairStepVisuals.length === steps.length &&
          state.repairStepVisuals.every((visual) => visual.status === "succeeded");
        const startingVisuals = steps.map(
          (_, index) =>
            (!regenerateAll && state.repairStepVisuals[index]) || {
              status: "idle" as const,
              image: null,
              error: null,
            },
        );
        commit({
          repairStepVisuals: startingVisuals,
          visualMode: "guide",
          announcement: `Creating ${steps.length} step-by-step repair visuals.`,
        });
        let completed = startingVisuals.filter((visual) => visual.status === "succeeded").length;
        try {
          for (let index = 0; index < steps.length; index += 1) {
            if (!isCurrentRepairVisualTask(task.sequence)) {
              return { ok: false, code: "CANCELLED" };
            }
            if (get().repairStepVisuals[index]?.status === "succeeded") continue;
            commit({
              repairStepVisuals: get().repairStepVisuals.map((visual, visualIndex) =>
                visualIndex === index ? { status: "generating", image: null, error: null } : visual,
              ),
              announcement: `Creating repair visual ${index + 1} of ${steps.length}.`,
            });
            try {
              const response = await services.generateRepairStepVisual(
                {
                  sessionToken: state.sessionToken,
                  planToken: state.planToken,
                  image: state.compressedImage,
                  analysis: state.analysis,
                  plan: state.plan,
                  stepIndex: index,
                },
                task.controller.signal,
              );
              if (!isCurrentRepairVisualTask(task.sequence)) {
                return { ok: false, code: "CANCELLED" };
              }
              completed += 1;
              commit({
                repairStepVisuals: get().repairStepVisuals.map((visual, visualIndex) =>
                  visualIndex === index
                    ? { status: "succeeded", image: response.image, error: null }
                    : visual,
                ),
              });
            } catch (error) {
              if (!isCurrentRepairVisualTask(task.sequence) || task.controller.signal.aborted) {
                return { ok: false, code: "CANCELLED" };
              }
              commit({
                repairStepVisuals: get().repairStepVisuals.map((visual, visualIndex) =>
                  visualIndex === index
                    ? { status: "failed", image: null, error: publicError(error) }
                    : visual,
                ),
              });
            }
          }
          repairVisualTaskController = null;
          commit({
            announcement:
              completed === steps.length
                ? "All step-by-step repair visuals are ready."
                : `${completed} of ${steps.length} repair visuals are ready.`,
          });
          return completed > 0 ? { ok: true } : { ok: false, code: "ACTION_NOT_AVAILABLE" };
        } finally {
          if (isCurrentRepairVisualTask(task.sequence)) repairVisualTaskController = null;
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
          state.diagnosticStatus !== "succeeded" ||
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
              ? "Checking whether one visible detail is needed before the repair guide."
              : "Updating the repair check with your latest detail.",
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
            announcement: `One repair detail is needed: ${response.question.prompt}`,
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
            questionError: cancelled ? "The photo check was cancelled." : publicError(error),
            questionMessage: null,
            announcement: cancelled
              ? "The photo check was cancelled."
              : "The photo check could not finish. You can retry or continue.",
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
        assistantTaskController?.abort();
        assistantTaskController = null;
        assistantTaskSequence += 1;
        commit({
          questionStatus: "complete",
          questionError: null,
          questionMessage: "Continuing with the evidence collected so far.",
          activeQuestionId: null,
          announcement: "The repair check is complete. The illustrated guide can now be created.",
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
            "The photo uploader is ready. Press Enter or click the highlighted area to choose a photo.",
          reversibleActivity: reversible("Prepared the image uploader", previous),
        });
        return { ok: true };
      },
      selectDemoObject(sampleId, options) {
        const sample = demoObjects.find((item) => item.id === sampleId);
        if (!sample) return Promise.resolve({ ok: false, code: "INVALID_INPUT" });
        return loadImageIntoWorkspace(sample.path, sample.name, options);
      },
      importImageFromUrl(imageUrl, options) {
        return loadImageIntoWorkspace(imageUrl, undefined, options);
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
            questionMessage: safetyStop ? "The safety finding prevents actionable steps." : null,
            questionError: null,
            answers: [],
            isBusy: false,
            originalFile: safetyStop ? null : get().originalFile,
            announcement: safetyStop
              ? "A safety stop is active. Qualified help is recommended."
              : `${response.analysis.objectName} identified. Review the findings as hypotheses.`,
          });
          const diagnosticState = get();
          void diagnosticState.generateDiagnosticView({
            expectedStateVersion: diagnosticState.stateVersion,
            source: options.source,
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
        const compressedImage = state.compressedImage;
        const task = beginTask(options.signal);
        commit({
          stage: "preparing",
          generationStatus: "queued",
          generationProgress: 5,
          generationMessage:
            "Preparing a damage-preserving reference. This stage is capped at 45 seconds.",
          generationError: null,
          operationError: null,
          isBusy: true,
          model: null,
          modelError: null,
          visualMode: "model",
          exploded: false,
          announcement: "Preparing a damage-preserving reference for 3D reconstruction.",
          reversibleActivity: null,
        });
        try {
          let activeSessionToken = state.sessionToken;
          let activeAnalysis = state.analysis;
          const startModel = () =>
            services.startModelGeneration(
              {
                sessionToken: activeSessionToken,
                image: compressedImage,
                analysis: activeAnalysis,
                normalizeImage: true,
              },
              task.controller.signal,
            );
          let response: Awaited<ReturnType<WorkspaceServices["startModelGeneration"]>>;
          try {
            response = await startModel();
          } catch (error) {
            if (!isSessionExpired(error)) throw error;
            commit({
              generationMessage: "Refreshing your repair session.",
              announcement: "Refreshing the repair session before rebuilding the 3D model.",
            });
            const refreshed = await services.analyzeObject(
              {
                image: compressedImage,
                ...(state.problemDescription.trim()
                  ? { problemDescription: state.problemDescription.trim() }
                  : {}),
              },
              task.controller.signal,
            );
            if (!isCurrentTask(task.sequence)) return { ok: false, code: "CANCELLED" };
            activeSessionToken = refreshed.sessionToken;
            activeAnalysis = refreshed.analysis;
            const objectNameCorrection =
              state.objectNameCorrection === state.analysis.objectName
                ? refreshed.analysis.objectName
                : state.objectNameCorrection;
            commit({
              sessionToken: refreshed.sessionToken,
              analysis: refreshed.analysis,
              objectNameCorrection,
              generationMessage:
                "Preparing a damage-preserving reference. This stage is capped at 45 seconds.",
            });
            if (refreshed.analysis.safety.riskLevel === "professional_help_only") {
              currentTaskController = null;
              task.release();
              commit({
                stage: "safety-stop",
                generationStatus: "failed",
                generationProgress: null,
                generationError: failure(
                  "3D generation paused because the refreshed safety review recommends professional help.",
                ),
                operationError: null,
                generationMessage: "3D generation paused for safety.",
                isBusy: false,
                originalFile: null,
                exploded: false,
                announcement: "The refreshed safety review recommends qualified help.",
              });
              return { ok: false, code: "SAFETY_STOP" };
            }
            response = await startModel();
          }
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
          announcement: "A question is open for the person to answer.",
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
            planToken: response.planToken,
            repairStepVisuals: repairGuideSteps(response.plan).map(() => ({
              status: "idle",
              image: null,
              error: null,
            })),
            activeRepairStepIndex: 0,
            visualMode:
              !response.plan.professionalHelp.required && repairGuideSteps(response.plan).length > 0
                ? "guide"
                : state.visualMode,
            guidePageOpen:
              !response.plan.professionalHelp.required &&
              repairGuideSteps(response.plan).length > 0,
            operationError: null,
            isBusy: false,
            announcement: response.plan.professionalHelp.required
              ? "The guidance recommends qualified help."
              : "Cautious repair guidance is ready for human review.",
          });
          const guideState = get();
          if (
            !response.plan.professionalHelp.required &&
            repairGuideSteps(response.plan).length > 0
          ) {
            void guideState.generateRepairStepVisuals({
              expectedStateVersion: guideState.stateVersion,
              source: options.source,
            });
          }
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
        repairVisualTaskController?.abort();
        repairVisualTaskController = null;
        repairVisualTaskSequence += 1;
        questionTaskController?.abort();
        questionTaskController = null;
        assistantTaskController?.abort();
        assistantTaskController = null;
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
        repairVisualTaskController?.abort();
        repairVisualTaskController = null;
        questionTaskController?.abort();
        questionTaskController = null;
        revokePreviewUrl(get().image?.previewUrl);
      },
    };
  });

  if (persistence.available) {
    store.subscribe((state) => {
      if (!persistenceReady || !state.hasHydrated) return;
      const record = persistedWorkspaceRecord(state);
      persistenceQueue = persistenceQueue
        .catch(() => undefined)
        .then(() =>
          record.state.image || record.state.analysis
            ? persistence.save(record)
            : persistence.clear(),
        );
    });
  }

  return store;
}

export const workspaceStore = createWorkspaceStore();

export function humanActionOptions(store: WorkspaceStore): WorkspaceActionOptions {
  return { source: "human", expectedStateVersion: store.getState().stateVersion };
}
