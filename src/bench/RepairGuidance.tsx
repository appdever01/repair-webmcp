import { type FormEvent, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  const answers = useWorkspaceStore((state) => state.answers);
  const [kind, setKind] = useState<ObservationKind>("visual");
  const [description, setDescription] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!question) return;
    setKind(question.suggestedKind);
    setDescription("");
    textareaRef.current?.focus();
  }, [question]);
  if (!question) return null;

  const answer = (value: string, answerKind = kind) => {
    if (!value.trim()) return;
    workspaceStore
      .getState()
      .answerQuestion(question.id, { kind: answerKind, description: value.trim() });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    answer(description);
  };

  return (
    <form className="question-form" onSubmit={submit} id={`human-${question.id}`}>
      <div className="interview-heading">
        <p className="eyebrow">AI visual interview</p>
        <span>
          <RepairIcon name="agent" size={15} /> Question {answers.length + 1} · adapts to every
          answer
        </span>
      </div>
      <h2>{question.prompt}</h2>
      <div className="question-why">
        <RepairIcon name="inspect" size={18} />
        <p>
          <strong>Why I’m asking</strong>
          {question.why}
        </p>
      </div>
      <fieldset className="quick-replies">
        <legend className="sr-only">Quick answers</legend>
        {question.quickReplies.map((reply) => (
          <button key={reply} type="button" onClick={() => answer(reply, question.suggestedKind)}>
            {reply}
          </button>
        ))}
      </fieldset>
      <div className="answer-divider">
        <span>or describe it yourself</span>
      </div>
      <div className="question-field">
        <span id="observation-type-label">Observation type</span>
        <Select value={kind} onValueChange={(value) => setKind(value as ObservationKind)}>
          <SelectTrigger aria-labelledby="observation-type-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {observationKinds.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
        <RepairIcon name="forward" /> Send answer to AI
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          answer(
            "The person could not determine this safely from the available object.",
            "user_report",
          )
        }
      >
        I can’t tell safely
      </button>
      <p className="authority-note">
        Quick replies are suggestions, not conclusions. Choose only what is true for your object.
      </p>
    </form>
  );
}

function QuestionThinking() {
  const answers = useWorkspaceStore((state) => state.answers);
  const latest = answers.at(-1);
  return (
    <div className="question-thinking" role="status" aria-live="polite">
      <div className="thinking-orbit" aria-hidden="true">
        <RepairIcon name="agent" size={26} />
        <span className="thinking-orbit-ring" />
      </div>
      <p className="eyebrow">AI visual interview</p>
      <h2>{latest ? "Adapting to your answer…" : "Looking for the best first question…"}</h2>
      {latest && (
        <blockquote>
          <small>You answered</small>
          {latest.observation.description}
        </blockquote>
      )}
      <p>Comparing your observation with the uploaded image and visible damage.</p>
      <div className="indeterminate-progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

function QuestionFailure() {
  const error = useWorkspaceStore((state) => state.questionError);
  return (
    <div className="question-failure">
      <RepairIcon name="warning" size={28} />
      <p className="eyebrow">Interview paused</p>
      <h2>I couldn’t choose the next question.</h2>
      <p className="inline-error" role="alert">
        {error}
      </p>
      <button
        type="button"
        className="primary-button"
        onClick={() =>
          void workspaceStore.getState().loadNextQuestion(humanActionOptions(workspaceStore))
        }
      >
        <RepairIcon name="reset" /> Try again
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => workspaceStore.getState().finishQuestioning()}
      >
        Continue with what we have
      </button>
    </div>
  );
}

function InterviewReady() {
  const state = useWorkspaceStore((current) => current);
  return (
    <div className="interview-ready">
      <span className="ready-check">
        <RepairIcon name="check" size={25} />
      </span>
      <p className="eyebrow">Interview complete</p>
      <h2>I have enough context.</h2>
      <p>
        {state.questionMessage ??
          `${state.answers.length} observations are ready to combine with the image evidence.`}
      </p>
      <details className="interview-history">
        <summary>{state.answers.length} human observations collected</summary>
        <ol>
          {state.answers.map((answer) => (
            <li key={answer.questionId}>
              <small>{answer.question}</small>
              <span>{answer.observation.description}</span>
            </li>
          ))}
        </ol>
      </details>
      {state.operationError && (
        <p className="inline-error" role="alert">
          {state.operationError}
        </p>
      )}
      <button
        type="button"
        className="primary-button"
        disabled={state.isBusy}
        onClick={() =>
          void workspaceStore.getState().draftRepairPlan(humanActionOptions(workspaceStore))
        }
      >
        <RepairIcon name="repair" /> Build my guidance
      </button>
    </div>
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
  if (state.questionStatus === "loading")
    return (
      <aside className="guidance-panel">
        <QuestionThinking />
      </aside>
    );
  if (state.activeQuestionId || state.questionStatus === "asking")
    return (
      <aside className="guidance-panel">
        <QuestionForm />
      </aside>
    );
  if (state.questionStatus === "failed")
    return (
      <aside className="guidance-panel">
        <QuestionFailure />
      </aside>
    );
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
  if (state.questionStatus === "complete")
    return (
      <aside className="guidance-panel">
        <InterviewReady />
      </aside>
    );
  return (
    <aside className="guidance-panel">
      <p className="eyebrow">AI visual interview</p>
      <h2>Let’s ask a useful question.</h2>
      <p>The next question will be chosen from the uploaded image and will adapt to each answer.</p>
      <button
        type="button"
        className="primary-button"
        onClick={() =>
          void workspaceStore.getState().loadNextQuestion(humanActionOptions(workspaceStore))
        }
      >
        <RepairIcon name="agent" /> Start AI interview
      </button>
    </aside>
  );
}
