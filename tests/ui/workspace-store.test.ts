import type {
  GetModelGenerationResponse,
  ObjectAnalysis,
  RepairPlan,
} from "../../src/generation/contracts";
import { createWorkspaceStore, humanActionOptions } from "../../src/workspace";
import type { WorkspaceServices } from "../../src/workspace/services";

const image = { mediaType: "image/jpeg" as const, base64: "YWJjZA==" };
const sessionToken = "s".repeat(48);
const jobId = "j".repeat(48);

function analysis(overrides: Partial<ObjectAnalysis> = {}): ObjectAnalysis {
  return {
    objectName: "Desk fan",
    category: "Appliance",
    description: "A desk fan with a loose front guard.",
    identificationConfidence: "high",
    visibleCondition: ["The front guard appears displaced."],
    possibleIssues: [
      {
        hypothesis: "The guard fastener may be loose.",
        evidence: "A gap is visible near the fastener.",
        confidence: "medium",
      },
    ],
    hotspots: [
      {
        id: "guard-fastener",
        label: "Guard fastener",
        description: "Visible fastener on the front guard.",
        x: 0.55,
        y: 0.34,
        radius: 0.08,
      },
    ],
    clarifyingQuestions: ["Does the guard move while the fan is unplugged?"],
    safety: { riskLevel: "caution", categories: ["ordinary"], rationale: "Keep it unplugged." },
    stopConditions: ["Stop if damaged wiring is visible."],
    providerSafeDescription: "One desk fan with its existing proportions and visible wear.",
    ...overrides,
  };
}

function plan(): RepairPlan {
  return {
    limitations: ["The fastener type is not visible."],
    unknowns: ["Internal damage is unknown."],
    riskLevel: "moderate",
    hypotheses: [
      {
        cause: "A guard fastener may be loose.",
        confidence: "medium",
        evidenceFor: ["A visible gap is present."],
        evidenceAgainst: ["The guard has not been handled."],
      },
    ],
    safeNextChecks: [
      {
        title: "Check guard movement",
        instructions: "With the fan unplugged, observe whether the guard moves.",
        caution: "Do not reach through the guard.",
      },
    ],
    proposedRepairPlan: [],
    toolsAndMaterials: [],
    stopConditions: ["Stop if damaged wiring is visible."],
    professionalHelp: { required: false, reason: "No high-risk work is proposed." },
  };
}

function services(
  values: {
    analyzed?: ObjectAnalysis;
    analyzeError?: Error;
    polls?: GetModelGenerationResponse[];
    wait?: WorkspaceServices["wait"];
  } = {},
): WorkspaceServices {
  const polls = [...(values.polls ?? [])];
  return {
    prepareImage: vi.fn(async () => ({
      blob: new Blob(["compressed"], { type: "image/jpeg" }),
      image,
      width: 640,
      height: 480,
    })),
    analyzeObject: vi.fn(async () => {
      if (values.analyzeError) throw values.analyzeError;
      return { sessionToken, analysis: values.analyzed ?? analysis() };
    }),
    startModelGeneration: vi.fn(async () => ({
      jobId,
      status: "queued" as const,
      message: "Queued.",
    })),
    getModelGeneration: vi.fn(async () => {
      const next = polls.shift();
      if (!next) throw new Error("No poll response configured.");
      return next;
    }),
    draftRepairPlan: vi.fn(async () => ({ plan: plan() })),
    wait: values.wait ?? vi.fn(async () => undefined),
  };
}

function photo(type = "image/jpeg") {
  return new File(["photo"], "fan.jpg", { type });
}

describe("dynamic workspace action layer", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:preview-${Math.random()}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("validates selection, previews locally, and revokes it on removal", () => {
    const store = createWorkspaceStore(services());

    expect(store.getState().selectImage(photo("image/gif"))).toContain("JPEG");
    expect(store.getState().image).toBeNull();
    store.getState().setProblemDescription("The guard rattles.");
    expect(store.getState().selectImage(photo())).toBeNull();
    expect(store.getState().image).toMatchObject({ name: "fan.jpg" });
    expect(store.getState().originalFile).toBeInstanceOf(File);
    expect(store.getState().problemDescription).toBe("The guard rattles.");

    store.getState().removeImage();

    expect(store.getState().image).toBeNull();
    expect(store.getState().originalFile).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("analyzes a selected image and preserves the signed analysis after a name correction", async () => {
    const mocked = services();
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());

    await expect(
      store.getState().analyzeUploadedObject(humanActionOptions(store)),
    ).resolves.toEqual({ ok: true });
    store.getState().setObjectNameCorrection("Circulation fan");
    await store.getState().start3DGeneration(humanActionOptions(store));

    expect(mocked.startModelGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ analysis: expect.objectContaining({ objectName: "Desk fan" }) }),
      expect.any(AbortSignal),
    );
    expect(store.getState().objectNameCorrection).toBe("Circulation fan");
  });

  it("surfaces analysis failure while keeping the photo recoverable", async () => {
    const store = createWorkspaceStore(
      services({ analyzeError: new Error("Analysis is unavailable.") }),
    );
    store.getState().selectImage(photo());

    await expect(
      store.getState().analyzeUploadedObject(humanActionOptions(store)),
    ).resolves.toEqual({ ok: false, code: "ACTION_NOT_AVAILABLE" });

    expect(store.getState()).toMatchObject({ stage: "image-ready", image: expect.any(Object) });
    expect(store.getState().announcement).toBe("Analysis is unavailable.");
  });

  it("polls with bounded workspace states and keeps the 2D fallback after model failure", async () => {
    const mocked = services({
      polls: [
        {
          jobId,
          status: "processing",
          progress: 40,
          message: "Processing.",
          model: null,
          error: null,
        },
        {
          jobId,
          status: "failed",
          progress: null,
          message: "Failed.",
          model: null,
          error: {
            code: "MODEL_GENERATION_FAILED",
            message: "Could not build model.",
            recoverable: true,
          },
        },
      ],
    });
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));
    await store.getState().start3DGeneration(humanActionOptions(store));
    await vi.waitFor(() => expect(store.getState().generationStatus).toBe("failed"));

    expect(mocked.getModelGeneration).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({
      visualMode: "photo",
      image: expect.any(Object),
      originalFile: null,
    });
  });

  it("cancels active polling without losing the photo workspace", async () => {
    const wait = vi.fn(
      (_milliseconds: number, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          ),
        ),
    );
    const store = createWorkspaceStore(services({ wait }));
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));
    await store.getState().start3DGeneration(humanActionOptions(store));

    expect(store.getState().cancelCurrentTask(humanActionOptions(store))).toEqual({ ok: true });
    expect(store.getState()).toMatchObject({
      generationStatus: "cancelled",
      isBusy: false,
      image: expect.any(Object),
    });
  });

  it("synchronizes hotspot focus, records explicit human observations, and drafts a plan manually", async () => {
    const mocked = services({
      polls: [
        {
          jobId,
          status: "succeeded",
          progress: 100,
          message: "Ready.",
          model: { glbUrl: "https://assets.example/model.glb", posterUrl: null },
          error: null,
        },
      ],
    });
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));
    expect(store.getState().focusHotspot("guard-fastener", humanActionOptions(store))).toEqual({
      ok: true,
    });
    expect(store.getState().focusedHotspotId).toBe("guard-fastener");

    expect(
      store.getState().requestHumanObservation("question.1", humanActionOptions(store)),
    ).toEqual({ ok: true });
    store
      .getState()
      .answerQuestion("question.1", { kind: "visual", description: "The guard moves slightly." });
    await expect(store.getState().draftRepairPlan(humanActionOptions(store))).resolves.toEqual({
      ok: true,
    });

    expect(mocked.draftRepairPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        observations: [{ kind: "visual", description: "The guard moves slightly." }],
      }),
      expect.any(AbortSignal),
    );
    expect(store.getState().plan).not.toBeNull();
  });

  it("explodes and reassembles a generated model through the same reversible action", async () => {
    const store = createWorkspaceStore();
    store.setState({
      model: { glbUrl: "https://assets.example/model.glb", posterUrl: null },
      generationStatus: "succeeded",
      visualMode: "model",
      exploded: false,
    });

    expect(store.getState().setExplodedView(true, humanActionOptions(store))).toEqual({ ok: true });
    expect(store.getState()).toMatchObject({
      exploded: true,
      visualMode: "model",
    });
    const activityId = store.getState().reversibleActivity?.activityId;
    expect(activityId).toBeTruthy();
    expect(store.getState().undoAgentAction(activityId ?? "", humanActionOptions(store))).toEqual({
      ok: true,
    });
    expect(store.getState().exploded).toBe(false);

    expect(store.getState().setExplodedView(true, humanActionOptions(store))).toEqual({ ok: true });
    expect(store.getState().setExplodedView(false, humanActionOptions(store))).toEqual({
      ok: true,
    });
    expect(store.getState().exploded).toBe(false);
  });

  it("enforces a professional-help safety stop", async () => {
    const store = createWorkspaceStore(
      services({
        analyzed: analysis({
          safety: {
            riskLevel: "professional_help_only",
            categories: ["mains_electricity"],
            rationale: "Damaged mains wiring may be visible.",
          },
        }),
      }),
    );
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));

    expect(store.getState().stage).toBe("safety-stop");
    await expect(store.getState().start3DGeneration(humanActionOptions(store))).resolves.toEqual({
      ok: false,
      code: "SAFETY_STOP",
    });
    expect(store.getState().model).toBeNull();
  });
});
