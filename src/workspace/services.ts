import {
  analyzeObject,
  draftRepairPlan,
  getModelGeneration,
  startModelGeneration,
} from "../generation/client";
import { prepareImage } from "./image";

export interface WorkspaceServices {
  analyzeObject: typeof analyzeObject;
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
  startModelGeneration,
  getModelGeneration,
  draftRepairPlan,
  prepareImage,
  wait,
};
