import {
  analyzeObject,
  askRepairAssistant,
  draftRepairPlan,
  generateDiagnosticView,
  generateRepairStepVisual,
  getModelGeneration,
  getNextQuestion,
  startModelGeneration,
} from "../generation/client";
import { loadImageFile, prepareImage } from "./image";

export interface WorkspaceServices {
  analyzeObject: typeof analyzeObject;
  askRepairAssistant: typeof askRepairAssistant;
  generateDiagnosticView: typeof generateDiagnosticView;
  generateRepairStepVisual: typeof generateRepairStepVisual;
  getNextQuestion: typeof getNextQuestion;
  startModelGeneration: typeof startModelGeneration;
  getModelGeneration: typeof getModelGeneration;
  draftRepairPlan: typeof draftRepairPlan;
  loadImageFile: typeof loadImageFile;
  prepareImage: typeof prepareImage;
  wait(milliseconds: number, signal: AbortSignal): Promise<void>;
}

export function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      window.clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export const defaultWorkspaceServices: WorkspaceServices = {
  analyzeObject,
  askRepairAssistant,
  generateDiagnosticView,
  generateRepairStepVisual,
  getNextQuestion,
  startModelGeneration,
  getModelGeneration,
  draftRepairPlan,
  loadImageFile,
  prepareImage,
  wait,
};
