import graphData from "../content/aurelia-s1.repair-graph.json";
import { repairGraphSchema } from "./schemas";

export const repairGraph = repairGraphSchema.parse(graphData);

export type ComponentId = (typeof repairGraph.components)[number]["id"];

export function getComponent(componentId: string) {
  return repairGraph.components.find((component) => component.id === componentId) ?? null;
}

export function getCheck(checkId: string) {
  return repairGraph.checks.find((check) => check.id === checkId) ?? null;
}

export function getObservationDefinition(definitionId: string) {
  return (
    repairGraph.observationDefinitions.find((definition) => definition.id === definitionId) ?? null
  );
}

export function getPlan(planId: string) {
  return repairGraph.planTemplates.find((plan) => plan.id === planId) ?? null;
}

export function getPart(partId: string) {
  return repairGraph.parts.find((part) => part.id === partId) ?? null;
}
