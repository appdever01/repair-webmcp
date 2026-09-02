import { type FormEvent, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { RepairIcon } from "../design/RepairIcon";
import type { ObservationKind } from "../generation/contracts";
import {
  humanActionOptions,
  selectActiveQuestion,
  selectIsSafetyStop,
  useWorkspaceStore,
  workspaceStore,
} from "../workspace";

const observationKinds: Array<{ value: ObservationKind; label: string }> = [
  { value: "visual", label: "Something I can see" },
  { value: "functional", label: "Something I tested" },
  { value: "sound", label: "A sound I heard" },
  { value: "smell", label: "A smell I noticed" },
  { value: "measurement", label: "A measurement I took" },
  { value: "user_report", label: "Something I already know" },
];

function QuestionForm() {
  const question = useWorkspaceStore(useShallow(selectActiveQuestion));
  const [kind, setKind] = useState<ObservationKind>("visual");
  const [description, setDescription] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusRequest = useWorkspaceStore((state) => state.activeQuestionId);
  useEffect(() => {
    if (focusRequest) textareaRef.current?.focus();
  }, [focusRequest]);
  if (!question) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    workspaceStore
      .getState()
      .answerQuestion(question.id, { kind, description: description.trim() });
    setDescription("");
  };

  return (
    <form className="question-form" onSubmit={submit} id={`human-${question.id}`}>
      <p className="eyebrow">A question only you can answer</p>
      <h2>{question.prompt}</h2>
      <label>
        <span>Observation type</span>
        <select
          value={kind}
          onChange={(event) => setKind(event.currentTarget.value as ObservationKind)}
        >
          {observationKinds.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>What do you observe?</span>
        <textarea
          ref={textareaRef}
          rows={4}
          maxLength={800}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          placeholder="Describe only what you can directly observe"
        />
      </label>
      <button type="submit" className="primary-button" disabled={!description.trim()}>
        <RepairIcon name="check" /> Record my observation
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          workspaceStore.getState().answerQuestion(question.id, {
            kind: "user_report",
            description: "The person could not determine this safely from the available object.",
          })
        }
      >
        I can’t determine this safely
      </button>
      <p className="authority-note">
        A browser agent can open this question, but it cannot answer for you.
      </p>
    </form>
  );
}

function SafetyStop() {
  const analysis = useWorkspaceStore((state) => state.analysis);
  if (!analysis) return null;
  return (
    <div className="safety-stop">
      <span className="stop-icon">
        <RepairIcon name="warning" size={26} />
      </span>
      <p className="eyebrow">Stop here</p>
      <h2>Qualified help is the safer next step.</h2>
      <p>{analysis.safety.rationale}</p>
      <h3>Stop conditions</h3>
      <ul>
        {analysis.stopConditions.map((condition) => (
          <li key={condition}>{condition}</li>
        ))}
      </ul>
      <p className="authority-note">
        RE:PAIR will not provide actionable steps for this risk category.
      </p>
    </div>
  );
}

function PlanView() {
  const plan = useWorkspaceStore((state) => state.plan);
  if (!plan) return null;
  const nextStep = plan.safeNextChecks[0] ?? plan.proposedRepairPlan[0] ?? null;
  return (
    <div className="plan-view" id="repair-plan">
      <p className="eyebrow">Cautious guidance</p>
      <h2>
        {plan.professionalHelp.required ? "Ask a qualified professional." : "Your next safe action"}
      </h2>
      <div className="stop-conditions">
        <strong>Stop before starting if</strong>
        <ul>
          {plan.stopConditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </div>
      {plan.professionalHelp.required ? (
        <p>{plan.professionalHelp.reason}</p>
      ) : nextStep ? (
        <div className="next-step">
          <span>1</span>
          <div>
            <h3>{nextStep.title}</h3>
            <p>{nextStep.instructions}</p>
            {nextStep.caution && (
              <p className="step-caution">
                <RepairIcon name="warning" />
                {nextStep.caution}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p>No physical action is supported by the available evidence.</p>
      )}
      <details className="hypothesis-details">
        <summary>Review hypotheses and uncertainty</summary>
        {plan.hypotheses.map((hypothesis) => (
          <article key={hypothesis.cause}>
            <h3>{hypothesis.cause}</h3>
            <span>{hypothesis.confidence} confidence</span>
            <strong>Evidence for</strong>
            <ul>
              {hypothesis.evidenceFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <strong>Evidence against</strong>
            {hypothesis.evidenceAgainst.length > 0 ? (
              <ul>
                {hypothesis.evidenceAgainst.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>None recorded.</p>
            )}
          </article>
        ))}
        <strong>Unknowns</strong>
        {plan.unknowns.length > 0 ? (
          <ul>
            {plan.unknowns.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No additional unknowns were listed.</p>
        )}
      </details>
      <p className="authority-note">
        Only a person can perform, approve, or confirm physical work.
      </p>
    </div>
  );
}

export function RepairGuidance() {
  const state = useWorkspaceStore((current) => current);
  const unansweredCount = useWorkspaceStore(
    (current) => (current.analysis?.clarifyingQuestions.length ?? 0) - current.answers.length,
  );
  const safetyStop = useWorkspaceStore(selectIsSafetyStop);
  if (safetyStop)
    return (
      <aside className="guidance-panel">
        <SafetyStop />
      </aside>
    );
  if (state.plan)
    return (
      <aside className="guidance-panel">
        <PlanView />
      </aside>
    );
  if (state.activeQuestionId)
    return (
      <aside className="guidance-panel">
        <QuestionForm />
      </aside>
    );
  if (state.generationStatus === "idle") {
    return (
      <aside className="guidance-panel" id="3d-generation">
        <p className="eyebrow">Next action</p>
        <h2>Build an interactive view.</h2>
        <p>
          A 3D provider will process the prepared photo. If it cannot build or load the model, the
          photo and hotspot controls stay available.
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={() =>
            void workspaceStore.getState().start3DGeneration(humanActionOptions(workspaceStore))
          }
        >
          <RepairIcon name="cube" /> Build 3D model
        </button>
        <p className="authority-note">
          No percentage is shown because provider estimates are not reliable progress.
        </p>
      </aside>
    );
  }
  if (state.isBusy) {
    return (
      <aside className="guidance-panel busy-guidance">
        <span className="progress-pulse" aria-hidden="true" />
        <p className="eyebrow">In progress</p>
        <h2>{state.stage === "planning" ? "Preparing guidance" : "Building your workspace"}</h2>
        <p>{state.generationMessage ?? "The current request is still running."}</p>
      </aside>
    );
  }
  if (unansweredCount > 0)
    return (
      <aside className="guidance-panel">
        <QuestionForm />
      </aside>
    );
  return (
    <aside className="guidance-panel">
      <p className="eyebrow">Next action</p>
      <h2>Review a cautious plan.</h2>
      <p>
        Your observations will be combined with the visible evidence. The result remains a
        hypothesis.
      </p>
      {state.operationError && (
        <p className="inline-error" role="alert">
          {state.operationError}
        </p>
      )}
      <button
        type="button"
        className="primary-button"
        onClick={() =>
          void workspaceStore.getState().draftRepairPlan(humanActionOptions(workspaceStore))
        }
      >
        <RepairIcon name="repair" /> Draft repair guidance
      </button>
    </aside>
  );
}
