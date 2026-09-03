import type {
  AdaptiveQuestion,
  CompressedImage,
  DiagnosticImage,
  GeneratedModel,
  GenerationError,
  QuestionAnswer as GenerationQuestionAnswer,
  ObjectAnalysis,
  RepairPlan,
} from "../generation/contracts";

export type WorkspaceStage =
  | "intake"
  | "image-ready"
  | "uploading"
  | "understanding"
  | "analysis"
  | "preparing"
  | "generating"
  | "finishing"
  | "workspace"
  | "planning"
  | "guidance"
  | "safety-stop"
  | "error";

export type WorkspaceVisualMode = "photo" | "diagnostic" | "model";
export type DiagnosticStatus = "idle" | "generating" | "succeeded" | "failed";
export type QuestionStatus = "idle" | "loading" | "asking" | "complete" | "failed";
export type WorkspaceActionSource = "human" | "webmcp" | "demo";

export interface SelectedImage {
  name: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

export type QuestionAnswer = GenerationQuestionAnswer;

export interface ReversibleWorkspaceActivity {
  activityId: string;
  title: string;
}

export interface WorkspaceState {
  stage: WorkspaceStage;
  stateVersion: number;
  image: SelectedImage | null;
  originalFile: File | null;
  compressedImage: CompressedImage | null;
  problemDescription: string;
  analysis: ObjectAnalysis | null;
  objectNameCorrection: string;
  sessionToken: string | null;
  diagnosticImage: DiagnosticImage | null;
  diagnosticStatus: DiagnosticStatus;
  diagnosticError: string | null;
  generationStatus: "idle" | "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  generationProgress: number | null;
  generationMessage: string | null;
  generationError: GenerationError | null;
  jobId: string | null;
  model: GeneratedModel | null;
  modelError: string | null;
  visualMode: WorkspaceVisualMode;
  exploded: boolean;
  focusedHotspotId: string | null;
  activeQuestionId: string | null;
  questions: readonly AdaptiveQuestion[];
  questionStatus: QuestionStatus;
  questionMessage: string | null;
  questionError: string | null;
  answers: readonly QuestionAnswer[];
  plan: RepairPlan | null;
  operationError: string | null;
  isBusy: boolean;
  uploaderFocusRequest: number;
  uploaderPromptVisible: boolean;
  activityOpen: boolean;
  announcement: string;
  reversibleActivity: ReversibleWorkspaceActivity | null;
}
