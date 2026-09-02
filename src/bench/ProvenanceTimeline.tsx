import { RepairIcon } from "../design/RepairIcon";
import { useRepairStore } from "../domain/useRepairStore";

const eventLabels: Record<string, string> = {
  symptom_recorded: "Goal recorded",
  budget_set: "Budget set",
  observation_recorded: "Observation recorded",
  component_focused: "Component focused",
  repair_step_focused: "Step focused",
  plan_staged: "Plan staged",
  part_staged: "Part staged",
  plan_approved: "Plan approved",
  physical_step_completed: "Physical step completed",
  verification_recorded: "Result verified",
  agent_action_undone: "Agent action undone",
  session_reset: "Session reset",
};

export function ProvenanceTimeline() {
  const activity = useRepairStore((state) => state.activity);
  const open = useRepairStore((state) => state.provenanceOpen);
  const setOpen = useRepairStore((state) => state.setProvenanceOpen);
  const undoEntry = useRepairStore((state) => state.undoStack.at(-1) ?? null);
  const undoAgentAction = useRepairStore((state) => state.undoAgentAction);
  const visible = activity.slice(-4);

  return (
    <footer className="provenance">
      <span className="simulation-mark">Interactive repair simulation</span>
      <button
        type="button"
        className="provenance-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <RepairIcon name="history" />
        Provenance
        {activity.length > 0 && <span>{activity.length}</span>}
      </button>
      {undoEntry && (
        <button
          type="button"
          className="provenance-undo"
          onClick={() => undoAgentAction(undoEntry.activityId, { actor: "human", origin: "ui" })}
        >
          <RepairIcon name="undo" /> Undo agent action
        </button>
      )}
      <ol className="provenance-events" data-open={open}>
        {visible.length === 0 ? (
          <li className="empty-event">Actions will appear here with their source.</li>
        ) : (
          visible.map((event) => (
            <li key={event.id}>
              <span className="event-dot" data-actor={event.actor} aria-hidden="true" />
              <div>
                <strong>{eventLabels[event.type]}</strong>
                <small>
                  {event.actor} · {event.origin} · v{event.resultingVersion}
                </small>
              </div>
            </li>
          ))
        )}
      </ol>
    </footer>
  );
}
