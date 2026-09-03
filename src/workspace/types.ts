import type {
  CompressedImage,
  GeneratedModel,
  GenerationError,
  HumanObservation,
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

export type WorkspaceVisualMode = "photo" | "model";
export type WorkspaceActionSource = "human" | "webmcp" | "demo";

export interface SelectedImage {
  name: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

export interface QuestionAnswer {
  questionId: string;
  question: string;
  observation: HumanObservation;
}

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
  generationStatus: "idle" | "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  generationMessage: string | null;
  generationError: GenerationError | null;
  jobId: string | null;
  model: GeneratedModel | null;
  modelError: string | null;
  visualMode: WorkspaceVisualMode;
  exploded: boolean;
  focusedHotspotId: string | null;
  activeQuestionId: string | null;
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
