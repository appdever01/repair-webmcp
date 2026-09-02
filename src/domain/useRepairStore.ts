import { useStore } from "zustand";
import { repairStore } from "./repairStore";
import type { RepairStoreState } from "./state";

export function useRepairStore<T>(selector: (state: RepairStoreState) => T) {
  return useStore(repairStore, selector);
}
