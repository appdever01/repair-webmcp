import {
  analyzeObject,
  draftRepairPlan,
  generateDiagnosticView,
  getModelGeneration,
  getNextQuestion,
  startModelGeneration,
} from "../generation/client";
import { prepareImage } from "./image";

export interface WorkspaceServices {
  analyzeObject: typeof analyzeObject;
  generateDiagnosticView: typeof generateDiagnosticView;
  getNextQuestion: typeof getNextQuestion;
  startModelGeneration: typeof startModelGeneration;
  getModelGeneration: typeof getModelGeneration;
  draftRepairPlan: typeof draftRepairPlan;
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
  generateDiagnosticView,
  getNextQuestion,
  startModelGeneration,
  getModelGeneration,
  draftRepairPlan,
  prepareImage,
  wait,
};
