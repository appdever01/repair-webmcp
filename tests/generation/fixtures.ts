import type { CompressedImage, ObjectAnalysis, RepairPlan } from "../../src/generation/contracts";

export function pngImage(width = 64, height = 48, appendedBytes = 0): CompressedImage {
  const bytes = Buffer.alloc(24 + appendedBytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return { mediaType: "image/png", base64: bytes.toString("base64") };
}

export function jpegImage(width = 64, height = 48): CompressedImage {
  const bytes = Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x07,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
  ]);
  return { mediaType: "image/jpeg", base64: bytes.toString("base64") };
}

export function webpImage(width = 64, height = 48): CompressedImage {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  const encodedWidth = width - 1;
  const encodedHeight = height - 1;
  bytes[24] = encodedWidth & 0xff;
  bytes[25] = (encodedWidth >>> 8) & 0xff;
  bytes[26] = (encodedWidth >>> 16) & 0xff;
  bytes[27] = encodedHeight & 0xff;
  bytes[28] = (encodedHeight >>> 8) & 0xff;
  bytes[29] = (encodedHeight >>> 16) & 0xff;
  return { mediaType: "image/webp", base64: bytes.toString("base64") };
}

export function objectAnalysis(overrides: Partial<ObjectAnalysis> = {}): ObjectAnalysis {
  return {
    objectName: "Desk lamp",
    category: "Lighting",
    description: "A small metal desk lamp with a visible loose shade.",
    identificationConfidence: "high",
    visibleCondition: ["The shade appears loose."],
    possibleIssues: [
      {
        hypothesis: "The shade fastener may be loose.",
        evidence: "A visible gap appears around the shade fastener.",
        confidence: "medium",
      },
    ],
    hotspots: [
      {
        id: "shade-fastener",
        label: "Shade fastener",
        description: "Visible connection between the shade and arm.",
        x: 0.5,
        y: 0.35,
        radius: 0.08,
      },
    ],
    clarifyingQuestions: ["Does the shade move when the lamp is unplugged?"],
    safety: {
      riskLevel: "caution",
      categories: ["ordinary"],
      rationale: "Only an external mechanical issue is visible.",
    },
    stopConditions: ["Stop if wiring or damaged insulation becomes visible."],
    providerSafeDescription:
      "One small metal desk lamp with its existing loose shade, labels, wear, and proportions preserved.",
    ...overrides,
  };
}

export function repairPlan(): RepairPlan {
  return {
    limitations: ["The internal fastener cannot be confirmed from the photo."],
    unknowns: ["The fastener type is unknown."],
    riskLevel: "moderate",
    hypotheses: [
      {
        cause: "A shade fastener may be loose.",
        confidence: "medium",
        evidenceFor: ["There is a visible gap."],
        evidenceAgainst: ["The connection has not been handled or inspected."],
      },
    ],
    safeNextChecks: [
      {
        title: "Check visible movement",
        instructions:
          "With the lamp unplugged, gently observe whether the shade moves at the joint.",
        caution: "Do not expose or touch any wiring.",
      },
    ],
    proposedRepairPlan: [],
    toolsAndMaterials: [],
    stopConditions: ["Stop if wiring or damaged insulation becomes visible."],
    professionalHelp: {
      required: false,
      reason: "No high-risk repair is proposed from the available evidence.",
    },
  };
}
