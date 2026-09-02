import type { Condition, Observation, ObservationValue, RepairGraph } from "./schemas";

export interface RankedHypothesis {
  id: string;
  label: string;
  score: number;
  rank: number;
  evidenceFor: string[];
  evidenceAgainst: string[];
  explanationCodes: string[];
}

export interface SafetyStop {
  checkId: string;
  ruleId: string;
  title: string;
  instruction: string;
}

export interface DiagnosisResult {
  ranked: RankedHypothesis[];
  missingChecks: string[];
  safetyStop: SafetyStop | null;
  status: "insufficient" | "likely";
}

function isNumeric(value: ObservationValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function conditionMatches(value: ObservationValue, condition: Condition): boolean {
  const expected = condition.value;
  switch (condition.operator) {
    case "equals":
      return value === expected;
    case "not_equals":
      return value !== expected;
    case "lt":
      return isNumeric(value) && typeof expected === "number" && value < expected;
    case "lte":
      return isNumeric(value) && typeof expected === "number" && value <= expected;
    case "gt":
      return isNumeric(value) && typeof expected === "number" && value > expected;
    case "gte":
      return isNumeric(value) && typeof expected === "number" && value >= expected;
    case "between":
      return (
        isNumeric(value) &&
        Array.isArray(expected) &&
        typeof expected[0] === "number" &&
        typeof expected[1] === "number" &&
        value >= expected[0] &&
        value <= expected[1]
      );
  }
}

function findSafetyStop(graph: RepairGraph, observations: Observation[]): SafetyStop | null {
  const values = new Map(
    observations.map((observation) => [observation.definitionId, observation.value]),
  );
  for (const check of graph.checks) {
    for (const stopCondition of check.stopConditions) {
      const value = values.get(stopCondition.observationId);
      if (value === undefined || !conditionMatches(value, stopCondition)) continue;
      const rule = check.safetyRuleIds
        .map((id) => graph.safetyRules.find((item) => item.id === id))
        .find((item) => item?.severity === "stop");
      if (rule) {
        return {
          checkId: check.id,
          ruleId: rule.id,
          title: rule.title,
          instruction: rule.instruction,
        };
      }
    }
  }
  return null;
}

export function diagnose(graph: RepairGraph, observations: Observation[]): DiagnosisResult {
  const values = new Map(
    observations.map((observation) => [observation.definitionId, observation.value]),
  );
  const ranked = graph.hypotheses
    .map((hypothesis) => {
      const matchingRules = graph.diagnosticRules.filter((rule) => {
        if (rule.hypothesisId !== hypothesis.id) return false;
        const value = values.get(rule.when.observationId);
        return value !== undefined && conditionMatches(value, rule.when);
      });
      return {
        id: hypothesis.id,
        label: hypothesis.label,
        score: Math.max(
          0,
          hypothesis.initialWeight + matchingRules.reduce((sum, rule) => sum + rule.scoreDelta, 0),
        ),
        rank: 0,
        evidenceFor: matchingRules
          .filter((rule) => rule.direction === "for")
          .map((rule) => rule.evidence),
        evidenceAgainst: matchingRules
          .filter((rule) => rule.direction === "against")
          .map((rule) => rule.evidence),
        explanationCodes: matchingRules.map((rule) => rule.explanationCode),
      } satisfies RankedHypothesis;
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map((hypothesis, index) => ({ ...hypothesis, rank: index + 1 }));

  const observedDefinitions = new Set(observations.map((observation) => observation.definitionId));
  const relevantDefinitionIds = new Set(
    graph.diagnosticRules.map((rule) => rule.when.observationId),
  );
  const missingChecks = graph.observationDefinitions
    .filter(
      (definition) =>
        relevantDefinitionIds.has(definition.id) && !observedDefinitions.has(definition.id),
    )
    .map((definition) => definition.checkId);

  const top = ranked[0];
  const runnerUp = ranked[1];
  const status =
    top &&
    top.score >= 70 &&
    top.evidenceFor.length >= 2 &&
    top.score - (runnerUp?.score ?? 0) >= 20
      ? "likely"
      : "insufficient";

  return {
    ranked,
    missingChecks: [...new Set(missingChecks)],
    safetyStop: findSafetyStop(graph, observations),
    status,
  };
}
