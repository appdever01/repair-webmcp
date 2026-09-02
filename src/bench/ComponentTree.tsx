import { RepairIcon } from "../design/RepairIcon";
import type { DiagnosisResult } from "../domain/diagnosis";
import { repairGraph } from "../domain/repairGraph";
import { selectDiagnosis } from "../domain/selectors";
import { useRepairStore } from "../domain/useRepairStore";

function componentStatus(componentId: string, diagnosis: DiagnosisResult) {
  const hypothesis = diagnosis.ranked.find((item) =>
    repairGraph.hypotheses
      .find((entry) => entry.id === item.id)
      ?.componentIds.includes(componentId),
  );
  if (hypothesis?.rank === 1 && diagnosis.status === "likely") return "Fault likely";
  if (hypothesis) return "Candidate";
  return "Available";
}

function ComponentBranch({
  parentId,
  diagnosis,
  selectedId,
  onSelect,
}: {
  parentId: string | null;
  diagnosis: DiagnosisResult;
  selectedId: string | null;
  onSelect: (componentId: string) => void;
}) {
  const components = repairGraph.components.filter((component) => component.parentId === parentId);
  if (components.length === 0) return null;
  return (
    <ul>
      {components.map((component) => (
        <li key={component.id} data-selected={selectedId === component.id}>
          <button
            type="button"
            onClick={() => onSelect(component.id)}
            aria-pressed={selectedId === component.id}
          >
            <span>
              <strong>{component.name}</strong>
              <small>{component.description}</small>
            </span>
            <em>{componentStatus(component.id, diagnosis)}</em>
          </button>
          <ComponentBranch
            parentId={component.id}
            diagnosis={diagnosis}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

export function ComponentTree() {
  const state = useRepairStore((current) => current);
  const open = state.componentIndexOpen;
  const diagnosis = selectDiagnosis(state);

  if (!state.symptomPresetId) return null;

  return (
    <aside className="component-index" aria-label="Aurelia S1 component hierarchy">
      <button
        className="index-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => state.setComponentIndexOpen(!open)}
      >
        <RepairIcon name="inspect" />
        {open ? "Hide components" : "Components"}
      </button>
      <div className="component-list" data-open={open} hidden={!open}>
        <div className="component-list-heading">
          <span>Semantic assembly</span>
          <span>Status</span>
        </div>
        <ComponentBranch
          parentId={null}
          diagnosis={diagnosis}
          selectedId={state.focusedComponentId}
          onSelect={(componentId) =>
            state.focusComponent(componentId, { actor: "human", origin: "ui" })
          }
        />
      </div>
    </aside>
  );
}
