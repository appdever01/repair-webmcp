import { type AgentActivityStore, useAgentActivityStore } from "../agent-runtime";
import { RepairIcon } from "../design/RepairIcon";
import { workspaceStore } from "../workspace";

export function TopRail({ activityStore }: { activityStore: AgentActivityStore }) {
  const activity = useAgentActivityStore(activityStore);
  const latest = new Map<string, (typeof activity.events)[number]>();
  for (const event of activity.events) latest.set(event.correlationId, event);
  const running = [...latest.values()].filter(
    (event) => event.phase === "requested" || event.phase === "running",
  );
  const agentActive = running.some((event) => event.source === "webmcp");
  const demoActive = running.some((event) => event.source === "demo");
  const status = agentActive
    ? "Browser agent active"
    : demoActive
      ? "Guided demo active"
      : activity.connectionState === "ready"
        ? "Browser agent ready"
        : "Manual mode";

  return (
    <header className="top-rail">
      <a className="wordmark" href="#main-content" aria-label="RE:PAIR home">
        RE<span aria-hidden="true">:</span>PAIR
      </a>
      <p>Understand the object. Choose a safer next step.</p>
      <div className="agent-status" data-active={agentActive || demoActive}>
        <span aria-hidden="true" />
        {status}
      </div>
      <button
        type="button"
        className="quiet-icon-button"
        aria-label="Reset workspace"
        onClick={() => {
          if (window.confirm("Reset this workspace and remove the selected photo from memory?")) {
            workspaceStore.getState().reset();
          }
        }}
      >
        <RepairIcon name="reset" />
      </button>
    </header>
  );
}
