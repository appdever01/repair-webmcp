import { z } from "zod";
import type { AgentToolClassification, ToolManifestItem } from "./types";

const stateVersionSchema = z.number().int().nonnegative().meta({
  description: "Current state version returned by get_workspace_state.",
});

const publicIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

export const agentToolInputSchemas = {
  get_workspace_state: z.strictObject({}),
  open_image_uploader: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  analyze_uploaded_object: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  start_3d_generation: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  get_generation_status: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  focus_hotspot: z.strictObject({
    hotspotId: publicIdSchema.meta({ description: "Visible hotspot ID from workspace state." }),
    expectedStateVersion: stateVersionSchema,
  }),
  explode_model: z.strictObject({
    exploded: z.boolean().meta({
      description: "True separates visible 3D parts. False reassembles them.",
    }),
    expectedStateVersion: stateVersionSchema,
  }),
  request_human_observation: z.strictObject({
    questionId: publicIdSchema.meta({
      description: "Unanswered question ID to present in the human-facing UI.",
    }),
    expectedStateVersion: stateVersionSchema,
  }),
  draft_repair_plan: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  cancel_current_task: z.strictObject({ expectedStateVersion: stateVersionSchema }),
  undo_agent_action: z.strictObject({
    activityId: publicIdSchema.meta({
      description: "ID of the currently reversible visible activity.",
    }),
    expectedStateVersion: stateVersionSchema,
  }),
} as const;

export type AgentToolName = keyof typeof agentToolInputSchemas;

interface AgentToolMetadata {
  title: string;
  description: string;
  classification: AgentToolClassification;
  untrustedContent: boolean;
}

export const agentToolMetadata: Record<AgentToolName, AgentToolMetadata> = {
  get_workspace_state: {
    title: "Read workspace state",
    description: "Read the visible RE:PAIR stage, generation progress, and available next actions.",
    classification: "read-only",
    untrustedContent: true,
  },
  open_image_uploader: {
    title: "Open image uploader",
    description: "Open the image picker so the person can choose a local image.",
    classification: "mutation",
    untrustedContent: false,
  },
  analyze_uploaded_object: {
    title: "Analyze uploaded object",
    description: "Start analysis of the image the person selected in the visible workspace.",
    classification: "mutation",
    untrustedContent: false,
  },
  start_3d_generation: {
    title: "Start 3D generation",
    description: "Start a cancellable 3D generation task from the current analysis.",
    classification: "mutation",
    untrustedContent: false,
  },
  get_generation_status: {
    title: "Refresh generation status",
    description: "Refresh the visible status of the active 3D generation task.",
    classification: "mutation",
    untrustedContent: false,
  },
  focus_hotspot: {
    title: "Focus repair hotspot",
    description: "Focus one currently available hotspot in the visible workspace.",
    classification: "mutation",
    untrustedContent: true,
  },
  explode_model: {
    title: "Explode model parts",
    description: "Separate or reassemble the visible 3D model parts.",
    classification: "mutation",
    untrustedContent: false,
  },
  request_human_observation: {
    title: "Request human observation",
    description: "Show a question for the person to answer in the UI without recording an answer.",
    classification: "mutation",
    untrustedContent: true,
  },
  draft_repair_plan: {
    title: "Draft repair plan",
    description: "Draft a visible plan for review without claiming any physical work is complete.",
    classification: "mutation",
    untrustedContent: false,
  },
  cancel_current_task: {
    title: "Cancel current task",
    description: "Request cancellation of the active generation or analysis task.",
    classification: "mutation",
    untrustedContent: false,
  },
  undo_agent_action: {
    title: "Undo agent action",
    description: "Undo the currently reversible agent action and keep the reversal visible.",
    classification: "mutation",
    untrustedContent: true,
  },
};

export function agentInputJsonSchema(name: AgentToolName): object {
  return z.toJSONSchema(agentToolInputSchemas[name], { target: "draft-07" });
}

export function agentToolManifestItem(name: AgentToolName): ToolManifestItem {
  const metadata = agentToolMetadata[name];
  return {
    name,
    title: metadata.title,
    description: metadata.description,
    classification: metadata.classification,
    readOnly: metadata.classification === "read-only",
    untrustedContent: metadata.untrustedContent,
  };
}
