import { z } from "zod";

export const actorSchema = z.enum(["human", "agent", "system"]);
export const originSchema = z.enum(["ui", "webmcp", "derived"]);
export const eventTypeSchema = z.enum([
  "symptom_recorded",
  "budget_set",
  "observation_recorded",
  "component_focused",
  "repair_step_focused",
  "plan_staged",
  "part_staged",
  "plan_approved",
  "physical_step_completed",
  "verification_recorded",
  "agent_action_undone",
  "session_reset",
]);

export const domainEventSchema = z.strictObject({
  id: z.string().min(1),
  type: eventTypeSchema,
  actor: actorSchema,
  origin: originSchema,
  timestamp: z.string().datetime(),
  previousVersion: z.number().int().nonnegative(),
  resultingVersion: z.number().int().positive(),
  changes: z.array(
    z.strictObject({
      field: z.string().min(1),
      from: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      to: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }),
  ),
  reversible: z.boolean(),
});

export type Actor = z.infer<typeof actorSchema>;
export type Origin = z.infer<typeof originSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;

export interface ActionContext {
  actor: Actor;
  origin: Origin;
  expectedStateVersion?: number;
}

export interface ActionError {
  ok: false;
  code:
    | "INVALID_INPUT"
    | "UNKNOWN_ID"
    | "ACTION_NOT_AVAILABLE"
    | "STALE_STATE"
    | "SAFETY_STOP"
    | "INCOMPATIBLE_PART"
    | "NOT_REVERSIBLE";
  stateVersion: number;
  message: string;
}

export interface ActionSuccess {
  ok: true;
  stateVersion: number;
  event: DomainEvent;
}

export type ActionResult = ActionSuccess | ActionError;
