import type { ZodType } from "zod";
import { createAgentActivityStore, type MutableAgentActivityStore } from "./activityStore";
import {
  type AgentToolName,
  agentInputJsonSchema,
  agentToolInputSchemas,
  agentToolManifestItem,
  agentToolMetadata,
} from "./schemas";
import {
  isCancellationError,
  sanitizeActivitySummary,
  sanitizeActivityText,
  summarizeAgentToolInput,
  summarizeToolResult,
  userSafeErrorMessage,
} from "./summaries";
import type {
  AgentActivityEvent,
  AgentActivityPhase,
  AgentActivitySource,
  AgentActivityStore,
  AgentToolClassification,
  AgentVisibleTarget,
  SafeActivitySummary,
  ToolManifestItem,
  WorkspaceActionContext,
  WorkspaceActionErrorCode,
  WorkspaceActionResult,
  WorkspaceController,
  WorkspaceSnapshot,
} from "./types";

const allToolNames = Object.keys(agentToolInputSchemas) as AgentToolName[];
const activeGenerationStatuses = new Set<WorkspaceSnapshot["generationStatus"]>([
  "queued",
  "processing",
]);

const errorMessages: Record<WorkspaceActionErrorCode, string> = {
  ACTION_NOT_AVAILABLE: "This action is not available in the current workspace state.",
  CANCELLED: "The request was cancelled before it completed.",
  HUMAN_ACTION_REQUIRED: "The person must complete this action in the visible workspace.",
  INVALID_INPUT: "The tool input is invalid.",
  NOT_REVERSIBLE: "That activity is no longer reversible.",
  SAFETY_STOP: "The safety stop is active. The agent cannot continue this action.",
  STALE_STATE: "The workspace changed. Read the current state and try again.",
};

const successMessages: Record<AgentToolName, string> = {
  get_workspace_state: "Read the current visible workspace state.",
  open_image_uploader: "Opened the uploader. The person must choose the local image.",
  analyze_uploaded_object: "Started analysis of the person-selected image.",
  start_3d_generation: "Started the 3D generation task.",
  get_generation_status: "Refreshed the visible generation status.",
  focus_hotspot: "Focused the selected repair hotspot.",
  request_human_observation: "Presented the observation request. No answer was recorded.",
  draft_repair_plan: "Drafted a plan for review. No physical step was marked complete.",
  cancel_current_task: "Requested cancellation of the current task.",
  undo_agent_action: "Undid the reversible agent action and recorded the reversal.",
};

interface ParsedToolInput extends Record<string, unknown> {
  expectedStateVersion?: number;
  hotspotId?: string;
  questionId?: string;
  activityId?: string;
}

interface InvocationOptions {
  signal?: AbortSignal;
}

export interface AgentRuntime {
  readonly activityStore: AgentActivityStore;
  readonly ready: Promise<void>;
  invokeForDemo(
    name: AgentToolName,
    input: Record<string, unknown>,
    options?: InvocationOptions,
  ): Promise<unknown>;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

function id(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${prefix}-${randomId}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function snapshotVersion(snapshot: WorkspaceSnapshot): number {
  const version = snapshot.stateVersion;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error("Invalid workspace state version.");
  }
  return version;
}

function safePublicId(value: string): string | null {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(value)) return null;
  const sanitized = sanitizeActivityText(value, 80);
  return sanitized === value ? value : null;
}

function safeTarget(
  kind: AgentVisibleTarget["kind"],
  target: { id: string; title: string } | null,
): AgentVisibleTarget | undefined {
  if (!target) return undefined;
  const targetId = safePublicId(target.id);
  if (!targetId) return undefined;
  return { kind, id: targetId, title: sanitizeActivityText(target.title, 100) };
}

export function selectAvailableAgentTools(snapshot: WorkspaceSnapshot): AgentToolName[] {
  const names: AgentToolName[] = ["get_workspace_state"];
  const stage = snapshot.stage.toLowerCase();
  const generationActive =
    activeGenerationStatuses.has(snapshot.generationStatus) ||
    ["preparing", "generating", "processing", "finishing"].includes(stage);
  const activeTask =
    generationActive || ["uploading", "understanding", "analyzing", "planning"].includes(stage);
  if (snapshot.safetyStop) {
    if (activeTask) names.push("cancel_current_task");
    if (snapshot.reversibleActivity) names.push("undo_agent_action");
    return names;
  }
  if (!snapshot.imageSelected && !activeTask) names.push("open_image_uploader");
  if (snapshot.imageSelected && !snapshot.analysisExists && !activeTask) {
    names.push("analyze_uploaded_object");
  }
  if (
    snapshot.analysisExists &&
    ["idle", "failed", "cancelled"].includes(snapshot.generationStatus) &&
    !activeTask
  ) {
    names.push("start_3d_generation");
  }
  if (activeTask) {
    if (generationActive) names.push("get_generation_status");
    names.push("cancel_current_task");
  }
  if (snapshot.hotspots.length > 0) names.push("focus_hotspot");
  if (snapshot.unansweredHumanQuestions.length > 0) names.push("request_human_observation");
  if (
    snapshot.analysisExists &&
    snapshot.unansweredHumanQuestions.length === 0 &&
    !snapshot.planExists &&
    !activeTask
  ) {
    names.push("draft_repair_plan");
  }
  if (snapshot.reversibleActivity) names.push("undo_agent_action");
  return names;
}

function publicWorkspaceResult(snapshot: WorkspaceSnapshot, source: AgentActivitySource) {
  return {
    ok: true,
    source,
    stateVersion: snapshot.stateVersion,
    stage: sanitizeActivityText(snapshot.stage, 60),
    imageSelected: snapshot.imageSelected,
    analysisExists: snapshot.analysisExists,
    generationStatus: snapshot.generationStatus,
    hotspotCount: snapshot.hotspots.length,
    hotspots: snapshot.hotspots.slice(0, 3).flatMap((hotspot) => {
      const hotspotId = safePublicId(hotspot.id);
      return hotspotId ? [{ id: hotspotId, label: sanitizeActivityText(hotspot.label, 72) }] : [];
    }),
    unansweredHumanQuestionCount: snapshot.unansweredHumanQuestions.length,
    unansweredHumanQuestions: snapshot.unansweredHumanQuestions.slice(0, 3).flatMap((question) => {
      const questionId = safePublicId(question.id);
      return questionId
        ? [{ id: questionId, prompt: sanitizeActivityText(question.prompt, 72) }]
        : [];
    }),
    planExists: snapshot.planExists,
    reversibleActivity: (() => {
      if (!snapshot.reversibleActivity) return null;
      const activityId = safePublicId(snapshot.reversibleActivity.activityId);
      return activityId
        ? {
            activityId,
            title: sanitizeActivityText(snapshot.reversibleActivity.title, 100),
          }
        : null;
    })(),
    safetyStop: snapshot.safetyStop
      ? {
          code: safePublicId(snapshot.safetyStop.code) ?? "active",
          title: sanitizeActivityText(snapshot.safetyStop.title, 100),
        }
      : null,
    availableTools: selectAvailableAgentTools(snapshot),
  };
}

function boundedToolResult(result: unknown): unknown {
  const encoded = JSON.stringify(result);
  if (encoded.length < 1500) return result;
  const source =
    typeof result === "object" &&
    result !== null &&
    "source" in result &&
    (result.source === "webmcp" || result.source === "demo")
      ? result.source
      : undefined;
  return {
    ok: false,
    ...(source ? { source } : {}),
    code: "RESULT_TOO_LARGE",
    message: "The tool result exceeded the response limit.",
  };
}

function isFailedToolResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && "ok" in result && result.ok === false;
}

function errorResult(
  code: WorkspaceActionErrorCode | "INTERNAL_ERROR",
  stateVersion: number,
  source: AgentActivitySource,
) {
  return boundedToolResult({
    ok: false,
    source,
    code,
    stateVersion,
    message:
      code === "INTERNAL_ERROR"
        ? "The agent runtime could not complete the request."
        : errorMessages[code],
    allowedNext: ["get_workspace_state"],
  });
}

function targetFor(
  name: AgentToolName,
  input: ParsedToolInput,
  snapshot: WorkspaceSnapshot,
): AgentVisibleTarget | undefined {
  switch (name) {
    case "open_image_uploader":
      return { kind: "uploader", id: "image-uploader", title: "Image uploader" };
    case "analyze_uploaded_object":
      return { kind: "analysis", id: "object-analysis", title: "Object analysis" };
    case "start_3d_generation":
    case "get_generation_status":
      return { kind: "generation", id: "3d-generation", title: "3D generation" };
    case "focus_hotspot":
      return safeTarget(
        "hotspot",
        (() => {
          const hotspot = snapshot.hotspots.find((item) => item.id === input.hotspotId);
          return hotspot ? { id: hotspot.id, title: hotspot.label } : null;
        })(),
      );
    case "request_human_observation":
      return safeTarget(
        "human-question",
        (() => {
          const question = snapshot.unansweredHumanQuestions.find(
            (item) => item.id === input.questionId,
          );
          return question ? { id: question.id, title: question.prompt } : null;
        })(),
      );
    case "draft_repair_plan":
      return { kind: "repair-plan", id: "repair-plan", title: "Repair plan" };
    case "cancel_current_task":
      return { kind: "task", id: "current-task", title: "Current task" };
    case "undo_agent_action":
      if (
        !snapshot.reversibleActivity ||
        snapshot.reversibleActivity.activityId !== input.activityId
      ) {
        return undefined;
      }
      return safeTarget("task", {
        id: snapshot.reversibleActivity.activityId,
        title: snapshot.reversibleActivity.title,
      });
    case "get_workspace_state":
      return undefined;
  }
}

function resultSummary(
  phase: Extract<AgentActivityPhase, "succeeded" | "failed" | "cancelled">,
  result: unknown,
): SafeActivitySummary {
  return summarizeToolResult({ phase, ...sanitizeActivitySummary(result) });
}

function activityEvent(
  name: AgentToolName,
  phase: AgentActivityPhase,
  source: AgentActivitySource,
  correlationId: string,
  inputSummary: SafeActivitySummary,
  classification: AgentToolClassification,
  values: {
    resultSummary?: SafeActivitySummary;
    durationMs?: number;
    target?: AgentVisibleTarget;
    stateVersionBefore?: number;
    stateVersionAfter?: number;
  } = {},
): AgentActivityEvent {
  return {
    id: id("activity"),
    correlationId,
    timestamp: new Date().toISOString(),
    toolName: name,
    title: agentToolMetadata[name].title,
    phase,
    classification,
    source,
    inputSummary,
    ...(values.resultSummary ? { resultSummary: values.resultSummary } : {}),
    ...(values.durationMs === undefined ? {} : { durationMs: values.durationMs }),
    ...(values.target ? { affectedTarget: values.target } : {}),
    ...(values.stateVersionBefore === undefined
      ? {}
      : { stateVersionBefore: values.stateVersionBefore }),
    ...(values.stateVersionAfter === undefined
      ? {}
      : { stateVersionAfter: values.stateVersionAfter }),
  };
}

async function runControllerAction(
  name: Exclude<AgentToolName, "get_workspace_state">,
  input: ParsedToolInput,
  controller: WorkspaceController,
  context: WorkspaceActionContext,
): Promise<WorkspaceActionResult> {
  switch (name) {
    case "open_image_uploader":
      return controller.openImageUploader(context);
    case "analyze_uploaded_object":
      return controller.analyzeUploadedObject(context);
    case "start_3d_generation":
      return controller.start3DGeneration(context);
    case "get_generation_status":
      return controller.refreshGenerationStatus(context);
    case "focus_hotspot":
      return controller.focusHotspot(input.hotspotId ?? "", context);
    case "request_human_observation":
      return controller.requestHumanObservation({ questionId: input.questionId ?? "" }, context);
    case "draft_repair_plan":
      return controller.draftRepairPlan(context);
    case "cancel_current_task":
      return controller.cancelCurrentTask(context);
    case "undo_agent_action":
      return controller.undoAgentAction(input.activityId ?? "", context);
  }
}

function userSafeRegistrationError(): string {
  return "WebMCP tools could not be registered.";
}

export function createAgentRuntime(
  controller: WorkspaceController,
  modelContext: WebMCP.ModelContext | undefined = typeof document === "undefined"
    ? undefined
    : document.modelContext,
): AgentRuntime {
  const activityStore = createAgentActivityStore();
  const mutableStore = activityStore as MutableAgentActivityStore;
  let registrationController: AbortController | null = null;
  let disposed = false;
  let refreshGeneration = 0;
  let observedStateVersion: number | null = null;
  let queue = Promise.resolve();

  const append = (event: AgentActivityEvent) => mutableStore.appendEvent(event);

  const invoke = async (
    name: AgentToolName,
    rawInput: unknown,
    source: AgentActivitySource,
    signal: AbortSignal,
  ): Promise<unknown> => {
    const metadata = agentToolMetadata[name];
    const classification = metadata.classification;
    const correlationId = id("invocation");
    const inputSummary = summarizeAgentToolInput(rawInput);
    const startedAt = performance.now();
    let before: WorkspaceSnapshot | undefined;
    let beforeVersion: number | undefined;
    let target: AgentVisibleTarget | undefined;
    const parsedInput = (agentToolInputSchemas[name] as ZodType<ParsedToolInput>).safeParse(
      rawInput,
    );
    try {
      before = controller.getSnapshot();
      beforeVersion = snapshotVersion(before);
      if (parsedInput.success) target = targetFor(name, parsedInput.data, before);
    } catch {
      before = undefined;
    }
    append(
      activityEvent(name, "requested", source, correlationId, inputSummary, classification, {
        ...(target ? { target } : {}),
        ...(beforeVersion === undefined ? {} : { stateVersionBefore: beforeVersion }),
      }),
    );
    append(
      activityEvent(name, "running", source, correlationId, inputSummary, classification, {
        ...(target ? { target } : {}),
        ...(beforeVersion === undefined ? {} : { stateVersionBefore: beforeVersion }),
      }),
    );

    const terminal = (
      phase: Extract<AgentActivityPhase, "succeeded" | "failed" | "cancelled">,
      result: unknown,
      afterVersion?: number,
    ) => {
      append(
        activityEvent(name, phase, source, correlationId, inputSummary, classification, {
          resultSummary: resultSummary(phase, result),
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          ...(target ? { target } : {}),
          ...(beforeVersion === undefined ? {} : { stateVersionBefore: beforeVersion }),
          ...(afterVersion === undefined ? {} : { stateVersionAfter: afterVersion }),
        }),
      );
      return result;
    };

    try {
      before = controller.getSnapshot();
      beforeVersion = snapshotVersion(before);
      if (disposed) {
        const result = errorResult("ACTION_NOT_AVAILABLE", beforeVersion, source);
        return terminal("failed", result, beforeVersion);
      }
      if (!parsedInput.success) {
        const result = errorResult("INVALID_INPUT", beforeVersion, source);
        return terminal("failed", result, beforeVersion);
      }
      const input = parsedInput.data;
      target = targetFor(name, input, before);
      if (signal.aborted) {
        const result = errorResult("CANCELLED", beforeVersion, source);
        return terminal("cancelled", result, beforeVersion);
      }
      const availableTools = new Set(selectAvailableAgentTools(before));
      if (!availableTools.has(name)) {
        const code = before.safetyStop ? "SAFETY_STOP" : "ACTION_NOT_AVAILABLE";
        const result = errorResult(code, beforeVersion, source);
        return terminal("failed", result, beforeVersion);
      }
      const requestedIdAvailable =
        (name !== "focus_hotspot" ||
          before.hotspots.some((hotspot) => hotspot.id === input.hotspotId)) &&
        (name !== "request_human_observation" ||
          before.unansweredHumanQuestions.some((question) => question.id === input.questionId)) &&
        (name !== "undo_agent_action" ||
          before.reversibleActivity?.activityId === input.activityId);
      if (!requestedIdAvailable) {
        const result = errorResult("ACTION_NOT_AVAILABLE", beforeVersion, source);
        return terminal("failed", result, beforeVersion);
      }
      if (name === "get_workspace_state") {
        const result = boundedToolResult(publicWorkspaceResult(before, source));
        return terminal(isFailedToolResult(result) ? "failed" : "succeeded", result, beforeVersion);
      }
      if (input.expectedStateVersion !== beforeVersion) {
        const result = errorResult("STALE_STATE", beforeVersion, source);
        return terminal("failed", result, beforeVersion);
      }

      const result = await runControllerAction(name, input, controller, {
        expectedStateVersion: beforeVersion,
        signal,
        correlationId,
        source,
      });
      const after = controller.getSnapshot();
      const afterVersion = snapshotVersion(after);
      if (!result.ok) {
        const toolResult = errorResult(result.code, afterVersion, source);
        return terminal(
          result.code === "CANCELLED" ? "cancelled" : "failed",
          toolResult,
          afterVersion,
        );
      }
      const toolResult = boundedToolResult({
        ok: true,
        source,
        stateVersion: afterVersion,
        summary: successMessages[name],
        ...(target ? { affectedTarget: target } : {}),
        availableTools: selectAvailableAgentTools(after),
      });
      return terminal(
        isFailedToolResult(toolResult) ? "failed" : "succeeded",
        toolResult,
        afterVersion,
      );
    } catch (error) {
      let currentVersion = beforeVersion ?? 0;
      try {
        currentVersion = snapshotVersion(controller.getSnapshot());
      } catch {
        currentVersion = beforeVersion ?? 0;
      }
      const cancelled = signal.aborted || isCancellationError(error);
      const result = cancelled
        ? errorResult("CANCELLED", currentVersion, source)
        : boundedToolResult({
            ok: false,
            source,
            code: "INTERNAL_ERROR",
            stateVersion: currentVersion,
            message: userSafeErrorMessage(error),
            allowedNext: ["get_workspace_state"],
          });
      return terminal(cancelled ? "cancelled" : "failed", result, currentVersion);
    }
  };

  const refresh = async (generation: number) => {
    if (disposed || !modelContext) return;
    mutableStore.setRegistration("registering", [], null);
    registrationController?.abort();
    const nextController = new AbortController();
    registrationController = nextController;
    try {
      const snapshot = controller.getSnapshot();
      snapshotVersion(snapshot);
      const names = selectAvailableAgentTools(snapshot);
      await Promise.all(
        names.map((name) => {
          const metadata = agentToolMetadata[name];
          return modelContext.registerTool(
            {
              name,
              title: metadata.title,
              description: metadata.description,
              inputSchema: agentInputJsonSchema(name),
              annotations: {
                readOnlyHint: metadata.classification === "read-only",
                untrustedContentHint: metadata.untrustedContent,
              },
              execute: (input, options) => invoke(name, input, "webmcp", options.signal),
            },
            { signal: nextController.signal },
          );
        }),
      );
      if (disposed || generation !== refreshGeneration) {
        nextController.abort();
        return;
      }
      const manifest: ToolManifestItem[] = names.map(agentToolManifestItem);
      mutableStore.setRegistration("ready", manifest, null);
    } catch {
      nextController.abort();
      if (!disposed && generation === refreshGeneration) {
        mutableStore.setRegistration("error", [], userSafeRegistrationError());
      }
    }
  };

  const scheduleRefresh = () => {
    refreshGeneration += 1;
    const generation = refreshGeneration;
    queue = queue.then(() => refresh(generation));
  };

  let unsubscribe: () => void = () => undefined;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    mutableStore.setRegistration("unsupported", [], null);
  } else {
    try {
      observedStateVersion = snapshotVersion(controller.getSnapshot());
      mutableStore.setRegistration("registering", [], null);
      unsubscribe = controller.subscribe(() => {
        if (disposed) return;
        try {
          const currentVersion = snapshotVersion(controller.getSnapshot());
          if (currentVersion === observedStateVersion) return;
          observedStateVersion = currentVersion;
          scheduleRefresh();
        } catch {
          mutableStore.setRegistration("error", [], userSafeRegistrationError());
        }
      });
      scheduleRefresh();
    } catch {
      mutableStore.setRegistration("error", [], userSafeRegistrationError());
    }
  }

  const ready = queue;
  return {
    activityStore,
    ready,
    invokeForDemo(name, input, options = {}) {
      if (!allToolNames.includes(name)) {
        return Promise.resolve({
          ok: false,
          source: "demo",
          code: "UNKNOWN_TOOL",
          message: "The demo tool name is not recognized.",
        });
      }
      return invoke(name, input, "demo", options.signal ?? new AbortController().signal);
    },
    flush: () => queue,
    async dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      registrationController?.abort();
      await queue;
      mutableStore.setRegistration("unsupported", [], null);
    },
  };
}
