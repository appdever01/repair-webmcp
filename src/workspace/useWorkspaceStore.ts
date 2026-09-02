import { useStore } from "zustand";
import { type WorkspaceStoreState, workspaceStore } from "./store";

export function useWorkspaceStore<T>(selector: (state: WorkspaceStoreState) => T): T {
  return useStore(workspaceStore, selector);
}
