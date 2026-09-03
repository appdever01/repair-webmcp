import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  type AgentActivityEvent,
  type AgentRuntime,
  useAgentActivityStore,
} from "../agent-runtime";
import { RepairIcon } from "../design/RepairIcon";
import { humanActionOptions, useWorkspaceStore, workspaceStore } from "../workspace";

function terminalEvents(events: readonly AgentActivityEvent[]) {
  const latest = new Map<string, AgentActivityEvent>();
  for (const event of events) latest.set(event.correlationId, event);
  return [...latest.values()].reverse();
}

function summaryEntries(summary: AgentActivityEvent["inputSummary"] | undefined) {
  return summary ? Object.entries(summary).slice(0, 4) : [];
}

function chatMessageKey(messages: readonly { role: string; content: string }[], index: number) {
  const message = messages[index];
  if (!message) return String(index);
  const occurrence = messages
    .slice(0, index)
    .filter(
      (candidate) => candidate.role === message.role && candidate.content === message.content,
    ).length;
  return `${message.role}-${message.content}-${occurrence}`;
}

function connectionStatus(activity: ReturnType<typeof useAgentActivityStore>) {
  if (activity.connectionState === "ready") {
    return `Assistant ready. ${activity.registeredToolCount} actions are available for this step.`;
  }
  if (activity.connectionState === "registering") return "Connecting assistance.";
  if (activity.connectionState === "error") {
    return activity.lastRegistrationError ?? "Assistance could not be connected.";
  }
  return "Manual controls are ready.";
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
  const planReady = useWorkspaceStore((state) => state.plan !== null);
  const messages = useWorkspaceStore((state) => state.assistantMessages);
  const chatStatus = useWorkspaceStore((state) => state.assistantChatStatus);
  const chatError = useWorkspaceStore((state) => state.assistantChatError);
  const [tab, setTab] = useState<"chat" | "activity">("chat");
  const [draft, setDraft] = useState("");
  const events = useMemo(() => terminalEvents(activity.events), [activity.events]);
  const running = events.some((event) => event.phase === "requested" || event.phase === "running");

  useEffect(() => {
    if (running) {
      setTab("activity");
      workspaceStore.getState().setActivityOpen(true);
    }
  }, [running]);

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || !planReady || chatStatus === "sending") return;
    setDraft("");
    void workspaceStore.getState().askRepairAssistant(question, humanActionOptions(workspaceStore));
  };

  return (
    <aside
      className="activity-dock"
      data-open={open}
      data-active={running}
      aria-label="Repair assistant"
    >
      <button
        type="button"
        className="activity-toggle"
        aria-label="Open repair assistant"
        aria-expanded={open}
        aria-controls="agent-activity-panel"
        onClick={() => {
          if (!open) setTab("chat");
          workspaceStore.getState().setActivityOpen(!open);
        }}
      >
        <RepairIcon name="agent" />
        <span>Ask RE:PAIR</span>
        <span className="activity-count">AI chat</span>
      </button>
      <div id="agent-activity-panel" className="activity-panel" hidden={!open}>
        <div className="activity-heading">
          <div>
            <span>Repair assistant</span>
            <h2>What do you need?</h2>
          </div>
          {tab === "chat" && messages.length > 0 && (
            <button type="button" onClick={() => workspaceStore.getState().clearAssistantChat()}>
              Clear chat
            </button>
          )}
          {tab === "activity" && activity.events.length > 0 && (
            <button type="button" onClick={runtime.activityStore.clearEvents}>
              Clear
            </button>
          )}
        </div>
        <div className="assistant-tabs" role="tablist" aria-label="Assistant panel">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            onClick={() => setTab("activity")}
          >
            Activity {events.length > 0 && <span>{events.length}</span>}
          </button>
        </div>
        {tab === "chat" ? (
          <div className="assistant-chat" role="tabpanel">
            <div className="assistant-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="assistant-welcome">
                  <RepairIcon name="agent" size={24} />
                  <strong>Ask about this repair</strong>
                  <p>Tools, materials, this step, or when you should stop.</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  className="assistant-message"
                  data-role={message.role}
                  key={chatMessageKey(messages, index)}
                >
                  <span>{message.role === "assistant" ? "RE:PAIR" : "You"}</span>
                  <p>{message.content}</p>
                </div>
              ))}
              {chatStatus === "sending" && (
                <div className="assistant-typing" role="status" aria-label="RE:PAIR is answering">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
            {chatError && <p className="assistant-chat-error">{chatError}</p>}
            <form className="assistant-composer" onSubmit={submitQuestion}>
              <textarea
                aria-label="Ask a repair question"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 1_200))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={planReady ? "Ask about this step…" : "Your guide will unlock chat…"}
                disabled={!planReady || chatStatus === "sending"}
                rows={2}
              />
              <button
                type="submit"
                aria-label="Send question"
                disabled={!draft.trim() || !planReady || chatStatus === "sending"}
              >
                <RepairIcon name="forward" size={18} />
              </button>
            </form>
            {!planReady && (
              <p className="assistant-locked">Create the repair guide to start chatting.</p>
            )}
          </div>
        ) : (
          <div role="tabpanel">
            <p className="activity-status" data-state={activity.connectionState}>
              {connectionStatus(activity)}
            </p>
            <p className="activity-intro">Requested actions appear here. Previews are labeled.</p>
            {events.length === 0 ? (
              <div className="activity-empty">
                <RepairIcon name="activity" />
                <p>No activity yet.</p>
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
                  Preview
                </button>
              </div>
            ) : (
              <ol className="activity-list" aria-live="polite">
                {events.map((event) => (
                  <li key={event.correlationId} data-phase={event.phase}>
                    <div className="activity-title-row">
                      <strong>{event.title}</strong>
                      <span>{event.source === "webmcp" ? "Assistant" : "Preview"}</span>
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
                        <dt>Input</dt>
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
                          <dt>Result</dt>
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
        )}
      </div>
    </aside>
  );
}
