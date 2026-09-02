import { useMemo } from "react";
import { diagnose } from "./diagnosis";
import { repairGraph } from "./repairGraph";
import { selectOptions, selectSafeChecks } from "./selectors";
import { useRepairStore } from "./useRepairStore";

export function useDiagnosis() {
  const observations = useRepairStore((state) => state.observations);
  return useMemo(() => diagnose(repairGraph, observations), [observations]);
}

export function useSafeChecks() {
  const state = useRepairStore((current) => current);
  return useMemo(() => selectSafeChecks(state), [state]);
}

export function useRepairOptions() {
  const state = useRepairStore((current) => current);
  return useMemo(() => selectOptions(state), [state]);
}

export function useTopHypothesis() {
  return useDiagnosis().ranked[0] ?? null;
}
