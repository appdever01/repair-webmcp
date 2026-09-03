import { useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import {
  humanActionOptions,
  selectDisplayedObjectName,
  useWorkspaceStore,
  workspaceStore,
} from "../workspace";

export function AnalysisPanel() {
  const analysis = useWorkspaceStore((state) => state.analysis);
  const displayedName = useWorkspaceStore(selectDisplayedObjectName);
  const focusedHotspotId = useWorkspaceStore((state) => state.focusedHotspotId);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(displayedName);
  if (!analysis) return null;

  const areaCount = analysis.hotspots.length;

  return (
    <section className="analysis-panel" id="object-analysis" aria-labelledby="analysis-title">
      <details className="analysis-disclosure">
        <summary>
          <div>
            <p className="eyebrow">AI assessment</p>
            <h2 id="analysis-title">{displayedName}</h2>
          </div>
          <div className="analysis-summary-facts">
            <span>
              {areaCount} {areaCount === 1 ? "area" : "areas"} marked
            </span>
            <span data-risk={analysis.safety.riskLevel}>
              {analysis.safety.riskLevel.replaceAll("_", " ")}
            </span>
            <b>
              Review findings <RepairIcon name="down" size={16} />
            </b>
          </div>
        </summary>
        <div className="analysis-body">
          <div className="analysis-heading">
            {editingName ? (
              <form
                className="name-edit"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draftName.trim()) {
                    workspaceStore.getState().setObjectNameCorrection(draftName.trim());
                  }
                  setEditingName(false);
                }}
              >
                <label htmlFor="object-name">Correct the object name</label>
                <div>
                  <input
                    id="object-name"
                    maxLength={160}
                    value={draftName}
                    onChange={(event) => setDraftName(event.currentTarget.value)}
                  />
                  <button type="submit">Save</button>
                </div>
              </form>
            ) : (
              <p className="analysis-description">{analysis.description}</p>
            )}
            {!editingName && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setDraftName(displayedName);
                  setEditingName(true);
                }}
              >
                <RepairIcon name="edit" /> Correct name
              </button>
            )}
          </div>
          <dl className="analysis-facts">
            <div>
              <dt>Identification</dt>
              <dd>{analysis.identificationConfidence} confidence</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{analysis.category}</dd>
            </div>
            <div data-risk={analysis.safety.riskLevel}>
              <dt>Safety status</dt>
              <dd>{analysis.safety.riskLevel.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <div className="analysis-columns">
            <div>
              <h3>Visible condition</h3>
              {analysis.visibleCondition.length > 0 ? (
                <ul>
                  {analysis.visibleCondition.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              ) : (
                <p>No visible condition was confidently identified.</p>
              )}
            </div>
            <div>
              <h3>Possible issues</h3>
              {analysis.possibleIssues.length > 0 ? (
                <ul className="issue-list">
                  {analysis.possibleIssues.map((issue) => (
                    <li key={`${issue.hypothesis}-${issue.evidence}`}>
                      <strong>{issue.hypothesis}</strong>
                      <span>{issue.evidence}</span>
                      <small>{issue.confidence} confidence · hypothesis</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No issue can be inferred confidently from this view.</p>
              )}
            </div>
          </div>
          <div className="uncertainty-note">
            <RepairIcon name="info" />
            <p>
              These are hypotheses from one image, not a diagnosis. Hidden damage and internal
              condition remain unknown until a person checks them safely.
            </p>
          </div>
          {analysis.hotspots.length > 0 && (
            <div className="hotspot-index">
              <h3>Areas to inspect</h3>
              <ol>
                {analysis.hotspots.map((hotspot, index) => (
                  <li key={hotspot.id} data-focused={focusedHotspotId === hotspot.id}>
                    <button
                      type="button"
                      aria-pressed={focusedHotspotId === hotspot.id}
                      onClick={() =>
                        workspaceStore
                          .getState()
                          .focusHotspot(hotspot.id, humanActionOptions(workspaceStore))
                      }
                    >
                      <b>{index + 1}</b>
                      <span>
                        <strong>{hotspot.label}</strong>
                        <small>{hotspot.description}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
