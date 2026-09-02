import type { ActionResult } from "../domain/events";
import { selectAllowedActions } from "../domain/selectors";
import type { RepairStore } from "../domain/state";

export interface ToolErrorResult {
  ok: false;
  code: string;
  stateVersion: number;
  message: string;
  allowedNext: string[];
}

export function actionToolResult(
  result: ActionResult,
  store: RepairStore,
  summary: string,
  focus?: { kind: "component" | "step"; id: string; label: string },
) {
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      stateVersion: result.stateVersion,
      message: result.message,
      allowedNext:
        result.code === "STALE_STATE"
          ? ["get_bench_state"]
          : selectAllowedActions(store.getState()),
    } satisfies ToolErrorResult;
  }
  return {
    ok: true,
    stateVersion: result.stateVersion,
    summary,
    changed: result.event.changes.map(({ field, to }) => ({ field, to })),
    ...(focus ? { focus } : {}),
    allowedNext: selectAllowedActions(store.getState()),
  };
}

export function cancelledResult(store: RepairStore): ToolErrorResult {
  return {
    ok: false,
    code: "CANCELLED",
    stateVersion: store.getState().stateVersion,
    message: "The tool was cancelled before the repair changed.",
    allowedNext: ["get_bench_state"],
  };
}

export function invalidResult(
  store: RepairStore,
  message = "The tool input is invalid.",
): ToolErrorResult {
  return {
    ok: false,
    code: "INVALID_INPUT",
    stateVersion: store.getState().stateVersion,
    message,
    allowedNext: ["get_bench_state"],
  };
}

export function unavailableResult(
  store: RepairStore,
  message = "This tool is not available at the current repair stage.",
): ToolErrorResult {
  return {
    ok: false,
    code: "ACTION_NOT_AVAILABLE",
    stateVersion: store.getState().stateVersion,
    message,
    allowedNext: selectAllowedActions(store.getState()),
  };
}

export function boundedResult(result: unknown) {
  const encoded = JSON.stringify(result);
  if (encoded.length <= 1500) return result;
  return {
    ok: false,
    code: "INTERNAL_ERROR",
    message: "The result exceeded the repair tool response budget.",
  };
}
