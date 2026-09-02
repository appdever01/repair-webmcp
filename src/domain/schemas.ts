import { z } from "zod";

const idSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);
const transformSchema = z.strictObject({
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema,
});

export const conditionSchema = z.strictObject({
  observationId: idSchema,
  operator: z.enum(["equals", "not_equals", "lt", "lte", "gt", "gte", "between"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.tuple([z.number(), z.number()])]),
});

export const repairGraphSchema = z
  .strictObject({
    schemaVersion: z.literal("0.1.0"),
    device: z.strictObject({
      id: idSchema,
      name: z.string().min(1),
      category: z.string().min(1),
      description: z.string().min(1),
      simulated: z.literal(true),
      safetyClass: z.string().min(1),
      power: z.strictObject({
        chemistry: z.string().min(1),
        nominalVoltage: z.number().positive(),
        chargingInputs: z.array(z.string().min(1)).min(1),
      }),
    }),
    components: z
      .array(
        z.strictObject({
          id: idSchema,
          name: z.string().min(1),
          parentId: idSchema.nullable(),
          role: z.string().min(1),
          description: z.string().min(1),
          materialRole: z.enum([
            "shell",
            "base",
            "glass",
            "diffuser",
            "pcb",
            "battery",
            "metal",
            "wire",
          ]),
          selectable: z.boolean(),
          assembled: transformSchema,
          exploded: transformSchema,
          focus: z.strictObject({ center: vector3Schema, radius: z.number().positive() }),
        }),
      )
      .min(1),
    symptomPresets: z.array(
      z.strictObject({
        id: idSchema,
        label: z.string().min(1),
        description: z.string().min(1),
      }),
    ),
    safetyRules: z.array(
      z.strictObject({
        id: idSchema,
        title: z.string().min(1),
        instruction: z.string().min(1),
        severity: z.enum(["notice", "caution", "stop"]),
      }),
    ),
    checks: z.array(
      z.strictObject({
        id: idSchema,
        name: z.string().min(1),
        componentId: idSchema,
        instruction: z.string().min(1),
        requires: z.array(idSchema),
        safetyRuleIds: z.array(idSchema),
        stopConditions: z.array(conditionSchema),
      }),
    ),
    observationDefinitions: z.array(
      z.strictObject({
        id: idSchema,
        checkId: idSchema,
        label: z.string().min(1),
        kind: z.enum(["enum", "number", "boolean"]),
        unit: z.string().nullable(),
        options: z.array(z.string()).optional(),
        minimum: z.number().optional(),
        maximum: z.number().optional(),
      }),
    ),
    hypotheses: z.array(
      z.strictObject({
        id: idSchema,
        label: z.string().min(1),
        componentIds: z.array(idSchema).min(1),
        initialWeight: z.number().min(0),
        evidenceFor: z.array(z.string()),
        evidenceAgainst: z.array(z.string()),
      }),
    ),
    diagnosticRules: z.array(
      z.strictObject({
        id: idSchema,
        hypothesisId: idSchema,
        when: conditionSchema,
        scoreDelta: z.number(),
        evidence: z.string().min(1),
        direction: z.enum(["for", "against"]),
        explanationCode: z.string().regex(/^[A-Z0-9_]+$/),
      }),
    ),
    repairOptions: z.array(
      z.strictObject({
        id: idSchema,
        kind: z.enum(["repair", "reuse", "replace"]),
        title: z.string().min(1),
        cost: z.number().nonnegative(),
        currency: z.literal("USD"),
        minutes: z.number().positive(),
        risk: z.enum(["low", "medium", "high"]),
        wasteGrams: z.number().nonnegative(),
        result: z.string().min(1),
        hypothesisIds: z.array(idSchema),
        planTemplateId: idSchema.nullable(),
      }),
    ),
    parts: z.array(
      z.strictObject({
        id: idSchema,
        name: z.string().min(1),
        price: z.number().nonnegative(),
        currency: z.literal("USD"),
        compatibility: z.strictObject({
          deviceId: idSchema,
          voltage: z.number().positive(),
          chemistry: z.string().min(1),
          connector: z.string().min(1),
          polarity: z.string().min(1),
          sizeMm: vector3Schema,
        }),
      }),
    ),
    planTemplates: z.array(
      z.strictObject({
        id: idSchema,
        optionId: idSchema,
        title: z.string().min(1),
        partIds: z.array(idSchema),
        steps: z.array(
          z.strictObject({
            id: idSchema,
            order: z.number().int().positive(),
            title: z.string().min(1),
            instruction: z.string().min(1),
            componentIds: z.array(idSchema),
            safetyRuleIds: z.array(idSchema),
            humanOnly: z.literal(true),
          }),
        ),
      }),
    ),
    verificationRules: z.array(
      z.strictObject({
        id: idSchema,
        planTemplateId: idSchema,
        label: z.string().min(1),
        durationSeconds: z.number().int().positive(),
        successText: z.string().min(1),
      }),
    ),
    ordsMapping: z.strictObject({
      standard: z.literal("ORDS"),
      status: z.literal("mapping-only"),
      fields: z.record(z.string(), z.string()),
    }),
  })
  .superRefine((graph, context) => {
    const uniqueSections = [
      graph.components,
      graph.symptomPresets,
      graph.safetyRules,
      graph.checks,
      graph.observationDefinitions,
      graph.hypotheses,
      graph.diagnosticRules,
      graph.repairOptions,
      graph.parts,
      graph.planTemplates,
      graph.verificationRules,
    ];
    for (const section of uniqueSections) {
      const ids = section.map((item) => item.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: "custom", message: "IDs must be unique within each section." });
      }
    }
    const componentIds = new Set(graph.components.map((item) => item.id));
    const safetyIds = new Set(graph.safetyRules.map((item) => item.id));
    const checkIds = new Set(graph.checks.map((item) => item.id));
    const observationIds = new Set(graph.observationDefinitions.map((item) => item.id));
    const hypothesisIds = new Set(graph.hypotheses.map((item) => item.id));
    const optionIds = new Set(graph.repairOptions.map((item) => item.id));
    const partIds = new Set(graph.parts.map((item) => item.id));
    const planIds = new Set(graph.planTemplates.map((item) => item.id));
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    for (const component of graph.components) {
      if (component.parentId && !componentIds.has(component.parentId))
        issue("Unknown component parent.");
    }
    for (const check of graph.checks) {
      if (!componentIds.has(check.componentId)) issue("Unknown check component.");
      if (check.safetyRuleIds.some((id) => !safetyIds.has(id))) issue("Unknown check safety rule.");
      if (check.requires.some((id) => !observationIds.has(id))) issue("Unknown check requirement.");
    }
    for (const observation of graph.observationDefinitions) {
      if (!checkIds.has(observation.checkId)) issue("Unknown observation check.");
    }
    for (const hypothesis of graph.hypotheses) {
      if (hypothesis.componentIds.some((id) => !componentIds.has(id)))
        issue("Unknown hypothesis component.");
    }
    for (const rule of graph.diagnosticRules) {
      if (!hypothesisIds.has(rule.hypothesisId)) issue("Unknown rule hypothesis.");
      if (!observationIds.has(rule.when.observationId)) issue("Unknown rule observation.");
    }
    for (const option of graph.repairOptions) {
      if (option.hypothesisIds.some((id) => !hypothesisIds.has(id)))
        issue("Unknown option hypothesis.");
      if (option.planTemplateId && !planIds.has(option.planTemplateId))
        issue("Unknown option plan.");
    }
    for (const plan of graph.planTemplates) {
      if (!optionIds.has(plan.optionId)) issue("Unknown plan option.");
      if (plan.partIds.some((id) => !partIds.has(id))) issue("Unknown plan part.");
      for (const step of plan.steps) {
        if (step.componentIds.some((id) => !componentIds.has(id))) issue("Unknown step component.");
        if (step.safetyRuleIds.some((id) => !safetyIds.has(id))) issue("Unknown step safety rule.");
      }
    }
  });

export const observationValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const observationSchema = z.strictObject({
  id: idSchema,
  definitionId: idSchema,
  checkId: idSchema,
  value: observationValueSchema,
  unit: z.string().nullable(),
  source: z.enum(["reported", "simulator"]),
  recordedBy: z.enum(["human", "agent"]),
});

export type RepairGraph = z.infer<typeof repairGraphSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type ObservationValue = z.infer<typeof observationValueSchema>;
export type Condition = z.infer<typeof conditionSchema>;
