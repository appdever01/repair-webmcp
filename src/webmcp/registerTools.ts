import { selectAllowedActions } from "../domain/selectors";
import type { RepairStore } from "../domain/state";
import { inputJsonSchema, type ToolName, toolMetadata } from "./toolDefinitions";
import { createToolHandler } from "./toolHandlers";

const readTools: ToolName[] = [
  "get_bench_state",
  "inspect_component",
  "list_safe_checks",
  "diagnose_faults",
  "compare_repair_options",
];

const writeTools: ToolName[] = [
  "set_repair_goal",
  "focus_component",
  "record_observation",
  "stage_repair_plan",
  "focus_repair_step",
  "stage_part_cart",
  "undo_agent_action",
];

function toolDefinition(name: ToolName, store: RepairStore): WebMCP.ModelContextTool {
  const metadata = toolMetadata[name];
  return {
    name,
    title: metadata.title,
    description: metadata.description,
    inputSchema: inputJsonSchema(name),
    annotations: {
      readOnlyHint: metadata.readOnly,
      untrustedContentHint: metadata.untrusted,
    },
    execute: createToolHandler(name, store),
  };
}

function reportRegistrationError(error: unknown) {
  if (import.meta.env.DEV) console.error("WebMCP registration failed", error);
}

export interface ToolRegistrationHandle {
  supported: boolean;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
}

export async function registerRepairTools(
  store: RepairStore,
  modelContext: WebMCP.ModelContext | undefined = typeof document === "undefined"
    ? undefined
    : document.modelContext,
): Promise<ToolRegistrationHandle> {
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    store.getState().setWebmcpAvailable(false);
    return { supported: false, flush: async () => undefined, dispose: async () => undefined };
  }

  const staticController = new AbortController();
  let dynamicController = new AbortController();
  let generation = 0;
  let disposed = false;
  let queue = Promise.resolve();

  await Promise.all(
    readTools.map((name) =>
      modelContext.registerTool(toolDefinition(name, store), { signal: staticController.signal }),
    ),
  );

  const refresh = async () => {
    const currentGeneration = ++generation;
    dynamicController.abort();
    dynamicController = new AbortController();
    const allowed = new Set(selectAllowedActions(store.getState()));
    const activeWrites = writeTools.filter((name) => allowed.has(name));
    await Promise.all(
      activeWrites.map((name) =>
        modelContext.registerTool(toolDefinition(name, store), {
          signal: dynamicController.signal,
        }),
      ),
    );
    if (disposed || currentGeneration !== generation) dynamicController.abort();
  };

  await refresh();
  store.getState().setWebmcpAvailable(true);
  const unsubscribe = store.subscribe((state, previousState) => {
    if (state.stateVersion === previousState.stateVersion) return;
    queue = queue.then(refresh).catch(reportRegistrationError);
  });

  return {
    supported: true,
    flush: () => queue,
    async dispose() {
      disposed = true;
      unsubscribe();
      await queue;
      staticController.abort();
      dynamicController.abort();
      store.getState().setWebmcpAvailable(false);
    },
  };
}
