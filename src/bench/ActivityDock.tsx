import { useEffect, useMemo } from "react";
import {
  type AgentActivityEvent,
  type AgentRuntime,
  useAgentActivityStore,
} from "../agent-runtime";
import { RepairIcon } from "../design/RepairIcon";
import { useWorkspaceStore, workspaceStore } from "../workspace";

function terminalEvents(events: readonly AgentActivityEvent[]) {
  const latest = new Map<string, AgentActivityEvent>();
  for (const event of events) latest.set(event.correlationId, event);
  return [...latest.values()].reverse();
}

function summaryEntries(summary: AgentActivityEvent["inputSummary"] | undefined) {
  return summary ? Object.entries(summary).slice(0, 4) : [];
}

function connectionStatus(activity: ReturnType<typeof useAgentActivityStore>) {
  if (activity.connectionState === "ready") {
    const entry = activity.entryPoint ? `${activity.entryPoint}.modelContext` : "WebMCP";
    return `Browser agent connected through ${entry}. ${activity.registeredToolCount} tools match the current step.`;
  }
  if (activity.connectionState === "registering") return "Registering WebMCP tools.";
  if (activity.connectionState === "error") {
    return activity.lastRegistrationError ?? "WebMCP tools could not be registered.";
  }
  return "This browser has no WebMCP. Every control here works by hand, and the guided preview shows what an agent would do.";
}

function visibleChange(event: AgentActivityEvent) {
  if (event.phase === "failed" || event.phase === "cancelled")
    return "No workspace change was kept.";
  if (event.phase !== "succeeded") return "The requested change is in progress.";
  if (!event.affectedTarget) return "The visible workspace state was read.";
  return `${event.affectedTarget.title} was updated in the visible workspace.`;
}

export function ActivityDock({ runtime }: { runtime: AgentRuntime }) {
  const activity = useAgentActivityStore(runtime.activityStore);
  const open = useWorkspaceStore((state) => state.activityOpen);
  const imageSelected = useWorkspaceStore((state) => state.image !== null);
  const events = useMemo(() => terminalEvents(activity.events), [activity.events]);
  const running = events.some((event) => event.phase === "requested" || event.phase === "running");

  useEffect(() => {
    if (running) workspaceStore.getState().setActivityOpen(true);
  }, [running]);

  return (
    <aside
      className="activity-dock"
      data-open={open}
      data-active={running}
      aria-label="Agent activity"
    >
      <button
        type="button"
        className="activity-toggle"
        aria-expanded={open}
        aria-controls="agent-activity-panel"
        onClick={() => workspaceStore.getState().setActivityOpen(!open)}
      >
        <RepairIcon name="activity" />
        <span>Agent activity</span>
        <span className="activity-count">{activity.registeredToolCount} actions</span>
      </button>
      <div id="agent-activity-panel" className="activity-panel" hidden={!open}>
        <div className="activity-heading">
          <div>
            <span>Visible automation</span>
            <h2>Agent activity</h2>
          </div>
          {activity.events.length > 0 && (
            <button type="button" onClick={runtime.activityStore.clearEvents}>
              Clear
            </button>
          )}
        </div>
        <p className="activity-status" data-state={activity.connectionState}>
          {connectionStatus(activity)}
        </p>
        <p className="activity-intro">
          Browser-agent requests appear here. Guided demo actions are labeled separately.
        </p>
        {events.length === 0 ? (
          <div className="activity-empty">
            <RepairIcon name="agent" />
            <p>No agent calls yet. Manual controls remain fully available.</p>
            <button
              type="button"
              className="demo-activity-button"
              onClick={() =>
                void runtime.invokeForDemo(
                  imageSelected ? "get_workspace_state" : "open_image_uploader",
                  {
                    ...(imageSelected
                      ? {}
                      : { expectedStateVersion: workspaceStore.getState().stateVersion }),
                  },
                )
              }
            >
              Preview guided activity
            </button>
          </div>
        ) : (
          <ol className="activity-list" aria-live="polite">
            {events.map((event) => (
              <li key={event.correlationId} data-phase={event.phase}>
                <div className="activity-title-row">
                  <strong>{event.title}</strong>
                  <span>{event.source === "webmcp" ? "Browser agent" : "Guided demo"}</span>
                </div>
                <div className="activity-meta">
                  <span>{event.phase}</span>
                  <time dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                  {event.durationMs !== undefined && <span>{event.durationMs} ms</span>}
                </div>
                <dl className="activity-summary">
                  <div>
                    <dt>Safe input</dt>
                    <dd>
                      {summaryEntries(event.inputSummary).length > 0
                        ? summaryEntries(event.inputSummary)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(" · ")
                        : "No parameters"}
                    </dd>
                  </div>
                  {event.resultSummary && (
                    <div>
                      <dt>Safe result</dt>
                      <dd>
                        {summaryEntries(event.resultSummary)
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(" · ")}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="visible-change">{visibleChange(event)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
