import { z } from "zod";
import { repairGraph } from "../domain/repairGraph";

const stateVersion = z.number().int().nonnegative().meta({
  description: "State version returned by get_bench_state.",
});
const componentId = z.enum(repairGraph.components.map((item) => item.id)).meta({
  description: "Stable component ID from the Aurelia S1 repair graph.",
});
const checkId = z.enum(repairGraph.checks.map((item) => item.id)).meta({
  description: "Safe check ID currently offered by list_safe_checks.",
});
const optionId = z.enum(repairGraph.repairOptions.map((item) => item.id)).meta({
  description: "Repair option ID returned by compare_repair_options.",
});
const partId = z.enum(repairGraph.parts.map((item) => item.id)).meta({
  description: "Compatible part ID from the repair graph.",
});
const stepIds = repairGraph.planTemplates.flatMap((plan) => plan.steps.map((step) => step.id));
const stepId = z.enum(stepIds).meta({ description: "Repair step ID from the staged plan." });

export const toolInputSchemas = {
  get_bench_state: z.strictObject({
    detail: z.enum(["summary", "full"]).optional().meta({
      description: "Use summary by default or full for recorded observations.",
    }),
  }),
  set_repair_goal: z.strictObject({
    symptomPresetId: z.enum(repairGraph.symptomPresets.map((item) => item.id)).meta({
      description: "Known symptom preset. Free-form instructions are not accepted.",
    }),
    maximumBudget: z.number().min(0).max(1000).meta({ description: "Maximum repair budget." }),
    currency: z.literal("USD").meta({ description: "Budget currency. Only USD is supported." }),
    expectedStateVersion: stateVersion,
  }),
  inspect_component: z.strictObject({ componentId }),
  focus_component: z.strictObject({ componentId, expectedStateVersion: stateVersion }),
  list_safe_checks: z.strictObject({ componentId: componentId.optional() }),
  record_observation: z.strictObject({
    checkId,
    value: z.union([z.string().max(40), z.number().finite(), z.boolean()]).meta({
      description: "Reported enum, voltage in V, or boolean value required by the check.",
    }),
    unit: z.literal("V").optional().meta({ description: "Use V for numeric voltage readings." }),
    source: z.enum(["reported", "simulator"]).meta({
      description: "Whether the person reported the value or used the simulator.",
    }),
    expectedStateVersion: stateVersion,
  }),
  diagnose_faults: z.strictObject({}),
  compare_repair_options: z.strictObject({
    priority: z.enum(["cost", "time", "risk", "waste"]).optional().meta({
      description: "Optional comparison priority. Stored budget is always applied.",
    }),
  }),
  stage_repair_plan: z.strictObject({ optionId, expectedStateVersion: stateVersion }),
  focus_repair_step: z.strictObject({ stepId, expectedStateVersion: stateVersion }),
  stage_part_cart: z.strictObject({
    partId,
    quantity: z
      .number()
      .int()
      .min(1)
      .max(4)
      .meta({ description: "Local staged quantity, from 1 to 4." }),
    expectedStateVersion: stateVersion,
  }),
  undo_agent_action: z.strictObject({
    activityId: z.string().min(1).max(100).meta({
      description: "ID of the latest reversible agent activity.",
    }),
    expectedStateVersion: stateVersion,
  }),
} as const;

export type ToolName = keyof typeof toolInputSchemas;

export const toolMetadata: Record<
  ToolName,
  { title: string; description: string; readOnly: boolean; untrusted: boolean }
> = {
  get_bench_state: {
    title: "Read repair bench",
    description:
      "Read the current Aurelia S1 repair state, version, progress, and allowed next actions.",
    readOnly: true,
    untrusted: true,
  },
  set_repair_goal: {
    title: "Set repair goal",
    description:
      "Record the known short-runtime symptom and a maximum USD budget on the visible bench.",
    readOnly: false,
    untrusted: false,
  },
  inspect_component: {
    title: "Inspect component",
    description:
      "Read a component's purpose, current diagnostic state, evidence, and related checks.",
    readOnly: true,
    untrusted: false,
  },
  focus_component: {
    title: "Focus component",
    description: "Visibly select a known component and move the repair bench focus to it.",
    readOnly: false,
    untrusted: false,
  },
  list_safe_checks: {
    title: "List safe checks",
    description:
      "List only checks whose prerequisites are met, including relevant stop conditions.",
    readOnly: true,
    untrusted: false,
  },
  record_observation: {
    title: "Record observation",
    description: "Record a person's structured result for a currently safe check with provenance.",
    readOnly: false,
    untrusted: true,
  },
  diagnose_faults: {
    title: "Diagnose faults",
    description: "Run the deterministic repair rules and return ranked causes with evidence codes.",
    readOnly: true,
    untrusted: false,
  },
  compare_repair_options: {
    title: "Compare outcomes",
    description: "Compare repair, wired reuse, and replacement against the stored budget.",
    readOnly: true,
    untrusted: false,
  },
  stage_repair_plan: {
    title: "Stage repair plan",
    description: "Stage a reversible repair plan for human review without approving physical work.",
    readOnly: false,
    untrusted: false,
  },
  focus_repair_step: {
    title: "Focus repair step",
    description: "Visibly focus one staged instruction and its components without completing it.",
    readOnly: false,
    untrusted: false,
  },
  stage_part_cart: {
    title: "Stage compatible part",
    description: "Stage a compatible fictional part locally without purchasing or reserving it.",
    readOnly: false,
    untrusted: false,
  },
  undo_agent_action: {
    title: "Undo agent action",
    description: "Reverse the latest eligible agent write and append the reversal to provenance.",
    readOnly: false,
    untrusted: false,
  },
};

export function inputJsonSchema(name: ToolName) {
  return z.toJSONSchema(toolInputSchemas[name], { target: "draft-07" });
}
