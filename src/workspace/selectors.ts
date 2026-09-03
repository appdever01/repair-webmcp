import type { WorkspaceStoreState } from "./store";

export const selectDisplayedObjectName = (state: WorkspaceStoreState) =>
  state.objectNameCorrection.trim() || state.analysis?.objectName || "Uploaded object";

export const selectUnansweredQuestions = (state: WorkspaceStoreState) =>
  state.questions.filter(
    (question) => !state.answers.some((answer) => answer.questionId === question.id),
  );

export const selectActiveQuestion = (state: WorkspaceStoreState) => {
  const questions = selectUnansweredQuestions(state);
  return (
    questions.find((question) => question.id === state.activeQuestionId) ?? questions[0] ?? null
  );
};

export const selectIsSafetyStop = (state: WorkspaceStoreState) =>
  state.analysis?.safety.riskLevel === "professional_help_only" ||
  state.plan?.professionalHelp.required === true;

export const selectHasWorkspace = (state: WorkspaceStoreState) => state.analysis !== null;
