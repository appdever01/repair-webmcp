import { z } from "zod";

export const imageMediaTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const compressedImageSchema = z
  .object({
    mediaType: imageMediaTypeSchema,
    base64: z.string().min(4).max(4_300_000),
  })
  .strict();

export const identificationConfidenceSchema = z.enum(["low", "medium", "high"]);

export const safetyCategorySchema = z.enum([
  "ordinary",
  "mains_electricity",
  "damaged_battery",
  "gas_system",
  "medical_device",
  "weapon",
  "structural_system",
  "vehicle_safety_system",
  "unknown_chemical",
]);

export const safetyRiskLevelSchema = z.enum(["low", "caution", "professional_help_only"]);

export const safetyClassificationSchema = z
  .object({
    riskLevel: safetyRiskLevelSchema,
    categories: z.array(safetyCategorySchema).min(1).max(9),
    rationale: z.string().min(1).max(800),
  })
  .strict();

export const analysisHotspotSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    radius: z.number().min(0.01).max(0.5),
  })
  .strict();

export const possibleIssueSchema = z
  .object({
    hypothesis: z.string().min(1).max(300),
    evidence: z.string().min(1).max(600),
    confidence: identificationConfidenceSchema,
  })
  .strict();

export const objectAnalysisSchema = z
  .object({
    objectName: z.string().min(1).max(160),
    category: z.string().min(1).max(120),
    description: z.string().min(1).max(1_000),
    identificationConfidence: identificationConfidenceSchema,
    visibleCondition: z.array(z.string().min(1).max(400)).max(20),
    possibleIssues: z.array(possibleIssueSchema).max(12),
    hotspots: z.array(analysisHotspotSchema).max(20),
    clarifyingQuestions: z.array(z.string().min(1).max(300)).max(12),
    safety: safetyClassificationSchema,
    stopConditions: z.array(z.string().min(1).max(400)).min(1).max(20),
    providerSafeDescription: z.string().min(1).max(800),
  })
  .strict();

export const analyzeObjectRequestSchema = z
  .object({
    image: compressedImageSchema,
    problemDescription: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const analyzeObjectResponseSchema = z
  .object({
    sessionToken: z.string().min(32).max(4_096),
    analysis: objectAnalysisSchema,
  })
  .strict();

export const startModelGenerationRequestSchema = z
  .object({
    sessionToken: z.string().min(32).max(4_096),
    image: compressedImageSchema,
    analysis: objectAnalysisSchema,
    normalizeImage: z.boolean().optional(),
  })
  .strict();

export const startModelGenerationBodySchema = startModelGenerationRequestSchema.omit({
  sessionToken: true,
});

export const generationStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
]);

export const startModelGenerationResponseSchema = z
  .object({
    jobId: z.string().min(32).max(4_096),
    status: z.enum(["queued", "processing"]),
    message: z.string().min(1).max(300),
  })
  .strict();

export const getModelGenerationRequestSchema = z
  .object({
    sessionToken: z.string().min(32).max(4_096),
    jobId: z.string().min(32).max(4_096),
  })
  .strict();

export const generationErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "IMAGE_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "MIME_MISMATCH",
  "INVALID_IMAGE",
  "ORIGIN_NOT_ALLOWED",
  "UNAUTHORIZED",
  "SESSION_EXPIRED",
  "CONFIGURATION_ERROR",
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_RESPONSE_INVALID",
  "MODEL_GENERATION_FAILED",
  "CANCELLED",
  "INVALID_RESPONSE",
  "INTERNAL_ERROR",
]);

export const generationErrorSchema = z
  .object({
    code: generationErrorCodeSchema,
    message: z.string().min(1).max(500),
    recoverable: z.boolean(),
  })
  .strict();

const httpsUrlSchema = z.url().refine((value) => value.startsWith("https://"));

const glbUrlSchema = z.union([
  httpsUrlSchema,
  z.string().regex(/^data:model\/gltf-binary;base64,[A-Za-z0-9+/]+={0,2}$/),
]);

export const generatedModelSchema = z
  .object({
    glbUrl: glbUrlSchema,
    posterUrl: httpsUrlSchema.nullable(),
  })
  .strict();

const modelResponseCommon = {
  jobId: z.string().min(32).max(4_096),
  progress: z.number().int().min(0).max(100).nullable(),
  message: z.string().min(1).max(300),
};

export const getModelGenerationResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...modelResponseCommon,
      status: z.literal("queued"),
      model: z.null(),
      error: z.null(),
    })
    .strict(),
  z
    .object({
      ...modelResponseCommon,
      status: z.literal("processing"),
      model: z.null(),
      error: z.null(),
    })
    .strict(),
  z
    .object({
      ...modelResponseCommon,
      status: z.literal("succeeded"),
      model: generatedModelSchema,
      error: z.null(),
    })
    .strict(),
  z
    .object({
      ...modelResponseCommon,
      status: z.literal("failed"),
      model: z.null(),
      error: generationErrorSchema,
    })
    .strict(),
  z
    .object({
      ...modelResponseCommon,
      status: z.literal("cancelled"),
      model: z.null(),
      error: generationErrorSchema,
    })
    .strict(),
]);

export const observationKindSchema = z.enum([
  "visual",
  "functional",
  "sound",
  "smell",
  "measurement",
  "user_report",
]);

export const humanObservationSchema = z
  .object({
    kind: observationKindSchema,
    description: z.string().min(1).max(800),
    value: z.string().max(200).optional(),
    unit: z.string().max(80).optional(),
  })
  .strict();

export const repairRiskLevelSchema = z.enum(["low", "moderate", "high", "professional_only"]);

export const repairHypothesisSchema = z
  .object({
    cause: z.string().min(1).max(400),
    confidence: identificationConfidenceSchema,
    evidenceFor: z.array(z.string().min(1).max(400)).max(12),
    evidenceAgainst: z.array(z.string().min(1).max(400)).max(12),
  })
  .strict();

export const repairPlanStepSchema = z
  .object({
    title: z.string().min(1).max(200),
    instructions: z.string().min(1).max(800),
    caution: z.string().max(400).nullable(),
  })
  .strict();

export const professionalHelpSchema = z
  .object({
    required: z.boolean(),
    reason: z.string().min(1).max(800),
  })
  .strict();

export const repairPlanSchema = z
  .object({
    limitations: z.array(z.string().min(1).max(500)).min(1).max(20),
    unknowns: z.array(z.string().min(1).max(500)).max(20),
    riskLevel: repairRiskLevelSchema,
    hypotheses: z.array(repairHypothesisSchema).max(12),
    safeNextChecks: z.array(repairPlanStepSchema).max(12),
    proposedRepairPlan: z.array(repairPlanStepSchema).max(20),
    toolsAndMaterials: z.array(z.string().min(1).max(200)).max(30),
    stopConditions: z.array(z.string().min(1).max(500)).min(1).max(20),
    professionalHelp: professionalHelpSchema,
  })
  .strict();

export const draftRepairPlanRequestSchema = z
  .object({
    sessionToken: z.string().min(32).max(4_096),
    analysis: objectAnalysisSchema,
    problemDescription: z.string().trim().max(2_000),
    observations: z.array(humanObservationSchema).max(40),
  })
  .strict();

export const draftRepairPlanBodySchema = draftRepairPlanRequestSchema.omit({ sessionToken: true });

export const draftRepairPlanResponseSchema = z
  .object({
    plan: repairPlanSchema,
  })
  .strict();

export const apiErrorResponseSchema = z
  .object({
    error: generationErrorSchema,
  })
  .strict();

export type ImageMediaType = z.infer<typeof imageMediaTypeSchema>;
export type CompressedImage = z.infer<typeof compressedImageSchema>;
export type IdentificationConfidence = z.infer<typeof identificationConfidenceSchema>;
export type SafetyCategory = z.infer<typeof safetyCategorySchema>;
export type SafetyRiskLevel = z.infer<typeof safetyRiskLevelSchema>;
export type SafetyClassification = z.infer<typeof safetyClassificationSchema>;
export type AnalysisHotspot = z.infer<typeof analysisHotspotSchema>;
export type PossibleIssue = z.infer<typeof possibleIssueSchema>;
export type ObjectAnalysis = z.infer<typeof objectAnalysisSchema>;
export type AnalyzeObjectRequest = z.infer<typeof analyzeObjectRequestSchema>;
export type AnalyzeObjectResponse = z.infer<typeof analyzeObjectResponseSchema>;
export type StartModelGenerationRequest = z.infer<typeof startModelGenerationRequestSchema>;
export type StartModelGenerationBody = z.infer<typeof startModelGenerationBodySchema>;
export type GenerationStatus = z.infer<typeof generationStatusSchema>;
export type StartModelGenerationResponse = z.infer<typeof startModelGenerationResponseSchema>;
export type GetModelGenerationRequest = z.infer<typeof getModelGenerationRequestSchema>;
export type GenerationErrorCode = z.infer<typeof generationErrorCodeSchema>;
export type GenerationError = z.infer<typeof generationErrorSchema>;
export type GeneratedModel = z.infer<typeof generatedModelSchema>;
export type GetModelGenerationResponse = z.infer<typeof getModelGenerationResponseSchema>;
export type ObservationKind = z.infer<typeof observationKindSchema>;
export type HumanObservation = z.infer<typeof humanObservationSchema>;
export type RepairRiskLevel = z.infer<typeof repairRiskLevelSchema>;
export type RepairHypothesis = z.infer<typeof repairHypothesisSchema>;
export type RepairPlanStep = z.infer<typeof repairPlanStepSchema>;
export type ProfessionalHelp = z.infer<typeof professionalHelpSchema>;
export type RepairPlan = z.infer<typeof repairPlanSchema>;
export type DraftRepairPlanRequest = z.infer<typeof draftRepairPlanRequestSchema>;
export type DraftRepairPlanBody = z.infer<typeof draftRepairPlanBodySchema>;
export type DraftRepairPlanResponse = z.infer<typeof draftRepairPlanResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
