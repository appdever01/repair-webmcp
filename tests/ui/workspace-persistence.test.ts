import type { ObjectAnalysis, RepairPlan } from "../../src/generation/contracts";
import {
  createWorkspaceStore,
  type PersistedWorkspaceRecord,
  type WorkspacePersistence,
} from "../../src/workspace";
import type { WorkspaceServices } from "../../src/workspace/services";

const analysis: ObjectAnalysis = {
  objectName: "Plastic mug",
  category: "Kitchenware",
  description: "A plastic mug with a detached handle.",
  identificationConfidence: "high",
  visibleCondition: ["The handle is detached."],
  possibleIssues: [],
  hotspots: [],
  safety: { riskLevel: "low", categories: ["ordinary"], rationale: "No high-risk system." },
  stopConditions: ["Stop if a sharp edge is exposed."],
  providerSafeDescription: "One damaged plastic mug.",
};

const plan: RepairPlan = {
  limitations: ["Only visible condition is known."],
  unknowns: [],
  riskLevel: "low",
  hypotheses: [],
  safeNextChecks: [
    { title: "Check the break", instructions: "Inspect the visible break.", caution: null },
  ],
  proposedRepairPlan: [
    { title: "Align the handle", instructions: "Align the detached handle.", caution: null },
  ],
  toolsAndMaterials: [],
  stopConditions: ["Stop if an edge is sharp."],
  professionalHelp: { required: false, reason: "No high-risk work is proposed." },
};

function unusedServices(): WorkspaceServices {
  const unavailable = async () => {
    throw new Error("Not used in this test.");
  };
  return {
    analyzeObject: unavailable,
    askRepairAssistant: unavailable,
    generateDiagnosticView: unavailable,
    generateRepairStepVisual: unavailable,
    getNextQuestion: unavailable,
    startModelGeneration: unavailable,
    getModelGeneration: unavailable,
    draftRepairPlan: unavailable,
    loadImageFile: unavailable,
    prepareImage: unavailable,
    wait: unavailable,
  } as WorkspaceServices;
}

describe("workspace persistence", () => {
  it("restores the complete visual guide after refresh and clears it only on reset", async () => {
    let record: PersistedWorkspaceRecord | null = null;
    const persistence: WorkspacePersistence = {
      available: true,
      load: vi.fn(async () => record),
      save: vi.fn(async (next) => {
        record = next;
      }),
      clear: vi.fn(async () => {
        record = null;
      }),
    };
    const first = createWorkspaceStore(unusedServices(), persistence);
    await first.getState().hydrateWorkspace();
    first.setState({
      stage: "guidance",
      image: { name: "mug.jpg", previewUrl: "blob:mug", width: 640, height: 480 },
      compressedImage: { mediaType: "image/jpeg", base64: "YWJjZA==" },
      analysis,
      objectNameCorrection: "Plastic mug",
      sessionToken: "s".repeat(48),
      diagnosticImage: { mediaType: "image/webp", base64: "QUFBQQ==" },
      diagnosticStatus: "succeeded",
      questionStatus: "complete",
      plan,
      planToken: "p".repeat(48),
      repairStepVisuals: [
        {
          status: "succeeded",
          image: { mediaType: "image/webp", base64: "QkJCQg==" },
          error: null,
        },
        {
          status: "succeeded",
          image: { mediaType: "image/webp", base64: "Q0NDQw==" },
          error: null,
        },
      ],
      activeRepairStepIndex: 1,
      visualMode: "guide",
      guidePageOpen: true,
      uploaderFocusRequest: 1,
      uploaderPromptVisible: true,
      assistantMessages: [
        { role: "user", content: "Can I use this tool?" },
        { role: "assistant", content: "Use it only if it matches the visible fastener." },
      ],
    });
    await vi.waitFor(() => expect(persistence.save).toHaveBeenCalled());

    const refreshed = createWorkspaceStore(unusedServices(), persistence);
    expect(refreshed.getState().hasHydrated).toBe(false);
    await refreshed.getState().hydrateWorkspace();

    expect(refreshed.getState()).toMatchObject({
      hasHydrated: true,
      analysis: { objectName: "Plastic mug" },
      diagnosticStatus: "succeeded",
      diagnosticImage: { base64: "QUFBQQ==" },
      activeRepairStepIndex: 1,
      visualMode: "guide",
      guidePageOpen: true,
      uploaderFocusRequest: 0,
      uploaderPromptVisible: false,
      assistantMessages: [
        { role: "user", content: "Can I use this tool?" },
        { role: "assistant", content: "Use it only if it matches the visible fastener." },
      ],
    });
    expect(refreshed.getState().image?.previewUrl).toBe("data:image/jpeg;base64,YWJjZA==");
    expect(refreshed.getState().repairStepVisuals[1]?.image?.base64).toBe("Q0NDQw==");

    refreshed.getState().reset();
    await vi.waitFor(() => expect(persistence.clear).toHaveBeenCalled());
    expect(record).toBeNull();
  });
});
