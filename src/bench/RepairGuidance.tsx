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
import { repairGuideSteps } from "../generation/repairGuide";
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
      <div className="repair-check-heading">
        <p className="eyebrow">One quick check</p>
        <span>
          <RepairIcon name="inspect" size={15} /> Detail {answers.length + 1} for the repair guide
        </span>
      </div>
      <h2>{question.prompt}</h2>
      <div className="question-why">
        <RepairIcon name="inspect" size={18} />
        <p>
          <strong>Why it matters</strong>
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
        <span>or add a short note</span>
      </div>
      <div className="question-field">
        <span id="observation-type-label">Kind of detail</span>
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
        <span>What do you notice?</span>
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
        <RepairIcon name="forward" /> Use this detail
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
      <p className="authority-note">Choose only what matches your object.</p>
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
      <p className="eyebrow">Checking the photo</p>
      <h2>{latest ? "Updating the fix…" : "Making sure the first step is safe…"}</h2>
      {latest && (
        <blockquote>
          <small>Your detail</small>
          {latest.observation.description}
        </blockquote>
      )}
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
      <p className="eyebrow">Photo check paused</p>
      <h2>The quick check didn’t finish.</h2>
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

function ReadyToFix() {
  const state = useWorkspaceStore((current) => current);
  return (
    <div className="repair-ready">
      <span className="ready-check">
        <RepairIcon name="check" size={25} />
      </span>
      <p className="eyebrow">Ready</p>
      <h2>Let’s fix it step by step.</h2>
      <p>OpenAI will turn the repair into a short illustrated guide.</p>
      {state.answers.length > 0 && (
        <details className="repair-details-history">
          <summary>
            {state.answers.length} {state.answers.length === 1 ? "detail" : "details"} you added
          </summary>
          <ol>
            {state.answers.map((answer) => (
              <li key={answer.questionId}>
                <small>{answer.question}</small>
                <span>{answer.observation.description}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
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
        <RepairIcon name="repair" /> Let’s start fixing
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

function GuideReadyPanel() {
  const plan = useWorkspaceStore((state) => state.plan);
  const steps = plan ? repairGuideSteps(plan) : [];

  return (
    <div className="guide-ready-panel">
      <span className="ready-check">
        <RepairIcon name="repair" size={25} />
      </span>
      <p className="eyebrow">Visual guide ready</p>
      <h2>{steps.length} illustrated steps.</h2>
      <p>Each step shows exactly what to handle and where.</p>
      <button
        type="button"
        className="primary-button"
        onClick={() => workspaceStore.getState().setGuidePageOpen(true)}
      >
        <RepairIcon name="forward" /> Open repair guide
      </button>
    </div>
  );
}

function PlanView() {
  const state = useWorkspaceStore((current) => current);
  const plan = state.plan;
  if (!plan) return null;
  const steps = repairGuideSteps(plan);
  const activeIndex = Math.min(state.activeRepairStepIndex, Math.max(steps.length - 1, 0));
  const current = steps[activeIndex];
  const visual = state.repairStepVisuals[activeIndex];
  const [actionWord, ...titleWords] = current?.step.title.trim().split(/\s+/) ?? [];
  const titleRemainder = titleWords.join(" ");
  const setStep = (index: number) => workspaceStore.getState().setActiveRepairStep(index);

  return (
    <div className="plan-view" id="repair-plan">
      <p className="eyebrow">
        {plan.professionalHelp.required
          ? "Stop here"
          : `Step ${activeIndex + 1} of ${steps.length}`}
      </p>
      {plan.professionalHelp.required ? (
        <>
          <h2>Ask a qualified professional.</h2>
          <p>{plan.professionalHelp.reason}</p>
        </>
      ) : current ? (
        <>
          <h2 className="repair-step-title">
            {actionWord && <mark>{actionWord}</mark>}
            {titleRemainder && (
              <>
                {" "}
                <span>{titleRemainder}</span>
              </>
            )}
          </h2>
          <div className="guide-status" data-status={visual?.status ?? "idle"}>
            <span aria-hidden="true" />
            {visual?.status === "succeeded"
              ? "Visual ready"
              : visual?.status === "failed"
                ? "Photo fallback"
                : "Drawing visual"}
          </div>
          <div className="current-repair-step">
            <p className="step-instruction">
              <span>{current.step.instructions}</span>
            </p>
            {current.step.caution && (
              <p className="step-caution">
                <RepairIcon name="warning" />
                {current.step.caution}
              </p>
            )}
          </div>
          <div className="repair-step-actions">
            {activeIndex > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(activeIndex - 1)}
              >
                <RepairIcon name="back" /> Back
              </button>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={() => setStep(activeIndex === steps.length - 1 ? 0 : activeIndex + 1)}
            >
              {activeIndex === steps.length - 1 ? "Review from start" : "Show next step"}
              <RepairIcon name={activeIndex === steps.length - 1 ? "reset" : "forward"} />
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>No physical action yet.</h2>
          <p>The available evidence does not support a repair step.</p>
        </>
      )}
      {plan.stopConditions[0] && (
        <div className="safety-gate">
          <RepairIcon name="warning" />
          <div>
            <small>Stop if</small>
            <strong>{plan.stopConditions[0]}</strong>
          </div>
        </div>
      )}
      <details className="hypothesis-details compact-plan-details">
        <summary>Safety and evidence</summary>
        {plan.stopConditions.length > 1 && (
          <>
            <strong>Also stop if</strong>
            <ul>
              {plan.stopConditions.slice(1).map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </>
        )}
        {plan.unknowns.length > 0 && (
          <>
            <strong>Still unknown</strong>
            <ul>
              {plan.unknowns.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {plan.hypotheses.length > 0 && (
          <>
            <strong>Likely causes</strong>
            <ul>
              {plan.hypotheses.map((hypothesis) => (
                <li key={hypothesis.cause}>{hypothesis.cause}</li>
              ))}
            </ul>
          </>
        )}
        {plan.toolsAndMaterials.length > 0 && (
          <>
            <strong>You may need</strong>
            <ul>
              {plan.toolsAndMaterials.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </details>
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
        {state.guidePageOpen ||
        state.visualMode === "guide" ||
        state.plan.professionalHelp.required ? (
          <PlanView />
        ) : (
          <GuideReadyPanel />
        )}
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
        <h2>
          {state.stage === "planning" ? "Creating your visual guide" : "Preparing the repair"}
        </h2>
        <p>{state.generationMessage ?? "The current request is still running."}</p>
      </aside>
    );
  }
  if (state.questionStatus === "complete")
    return (
      <aside className="guidance-panel">
        <ReadyToFix />
      </aside>
    );
  return (
    <aside className="guidance-panel">
      <p className="eyebrow">Before we start</p>
      <h2>One quick photo check.</h2>
      <p>A small visible detail may make the repair steps clearer.</p>
      <button
        type="button"
        className="primary-button"
        onClick={() =>
          void workspaceStore.getState().loadNextQuestion(humanActionOptions(workspaceStore))
        }
      >
        <RepairIcon name="inspect" /> Check the photo
      </button>
    </aside>
  );
}
