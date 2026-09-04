import type {
  GetModelGenerationResponse,
  NextQuestionResponse,
  ObjectAnalysis,
  RepairPlan,
} from "../../src/generation/contracts";
import { repairGuideSteps } from "../../src/generation/repairGuide";
import { createWorkspaceStore, humanActionOptions } from "../../src/workspace";
import type { WorkspaceServices } from "../../src/workspace/services";

const image = { mediaType: "image/jpeg" as const, base64: "YWJjZA==" };
const sessionToken = "s".repeat(48);
const planToken = "p".repeat(48);
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
    proposedRepairPlan: [
      {
        title: "Choose the hand tool",
        instructions: "Match the visible fastener before applying force.",
        caution: null,
      },
      {
        title: "Support the guard",
        instructions: "Hold the guard in alignment without reaching through it.",
        caution: null,
      },
      {
        title: "Tighten the fastener",
        instructions: "Turn the fastener only until the guard is snug.",
        caution: "Stop if the fastener binds.",
      },
      {
        title: "Verify the guard",
        instructions: "Confirm the guard remains aligned while the fan stays unplugged.",
        caution: null,
      },
    ],
    toolsAndMaterials: ["Matching hand tool"],
    stopConditions: ["Stop if damaged wiring is visible."],
    professionalHelp: { required: false, reason: "No high-risk work is proposed." },
  };
}

function services(
  values: {
    analyzed?: ObjectAnalysis;
    analyzeError?: Error;
    analyze?: WorkspaceServices["analyzeObject"];
    polls?: GetModelGenerationResponse[];
    questions?: NextQuestionResponse[];
    diagnostic?: WorkspaceServices["generateDiagnosticView"];
    guide?: WorkspaceServices["generateRepairStepVisual"];
    assistant?: WorkspaceServices["askRepairAssistant"];
    startModel?: WorkspaceServices["startModelGeneration"];
    wait?: WorkspaceServices["wait"];
  } = {},
): WorkspaceServices {
  const polls = [...(values.polls ?? [])];
  const questions = [...(values.questions ?? [])];
  return {
    loadImageFile: vi.fn(async (_url, name) =>
      photo(name?.endsWith(".webp") ? "image/webp" : "image/jpeg"),
    ),
    prepareImage: vi.fn(async () => ({
      blob: new Blob(["compressed"], { type: "image/jpeg" }),
      image,
      width: 640,
      height: 480,
    })),
    analyzeObject:
      values.analyze ??
      vi.fn(async () => {
        if (values.analyzeError) throw values.analyzeError;
        return { sessionToken, analysis: values.analyzed ?? analysis() };
      }),
    askRepairAssistant:
      values.assistant ??
      vi.fn(async () => ({
        answer: "Use the current step and stop if the condition changes.",
      })),
    generateDiagnosticView: values.diagnostic ?? vi.fn(async () => ({ image })),
    generateRepairStepVisual:
      values.guide ?? vi.fn(async ({ stepIndex }) => ({ stepIndex, image })),
    getNextQuestion: vi.fn(
      async ({ answers }) =>
        questions.shift() ??
        (answers.length === 0
          ? {
              status: "ask" as const,
              question: {
                id: "question.1",
                prompt: "Does the guard move while the fan is unplugged?",
                why: "Movement helps distinguish a loose fastener from visible misalignment.",
                suggestedKind: "visual" as const,
                quickReplies: ["Yes, it moves", "No, it stays fixed", "I’m not sure"],
                hotspotId: "guard-fastener",
              },
              message: "One safe observation would help.",
            }
          : {
              status: "ready" as const,
              question: null,
              message: "I have enough observations to prepare guidance.",
            }),
    ),
    startModelGeneration:
      values.startModel ??
      vi.fn(async () => ({
        jobId,
        status: "queued" as const,
        message: "Queued.",
      })),
    getModelGeneration: vi.fn(async () => {
      const next = polls.shift();
      if (!next) throw new Error("No poll response configured.");
      return next;
    }),
    draftRepairPlan: vi.fn(async () => ({ plan: plan(), planToken })),
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

  it("selects bundled demos and imports public image URLs through the shared action layer", async () => {
    const mocked = services();
    const store = createWorkspaceStore(mocked);

    await expect(
      store.getState().selectDemoObject("broken-cup", humanActionOptions(store)),
    ).resolves.toEqual({ ok: true });
    expect(mocked.loadImageFile).toHaveBeenCalledWith(
      "/sample-broken-cup.jpg",
      "sample-broken-cup.jpg",
      expect.any(AbortSignal),
    );
    expect(store.getState()).toMatchObject({
      stage: "image-ready",
      image: expect.any(Object),
      originalFile: expect.any(File),
    });

    store.getState().removeImage();
    await expect(
      store
        .getState()
        .importImageFromUrl("https://images.example/lamp.webp", humanActionOptions(store)),
    ).resolves.toEqual({ ok: true });
    expect(mocked.loadImageFile).toHaveBeenLastCalledWith(
      "https://images.example/lamp.webp",
      undefined,
      expect.any(AbortSignal),
    );
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

  it("opens and generates the signed damage map immediately after analysis", async () => {
    const mocked = services();
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));
    await vi.waitFor(() => expect(store.getState().diagnosticStatus).toBe("succeeded"));

    expect(mocked.generateDiagnosticView).toHaveBeenCalledOnce();
    expect(mocked.generateDiagnosticView).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionToken,
        analysis: expect.objectContaining({ objectName: "Desk fan" }),
      }),
      expect.any(AbortSignal),
    );
    expect(store.getState()).toMatchObject({
      diagnosticStatus: "succeeded",
      diagnosticImage: image,
      visualMode: "diagnostic",
      isBusy: false,
    });
  });

  it("waits for the damage map before requesting a repair detail", async () => {
    let finishDiagnostic: ((value: { image: typeof image }) => void) | undefined;
    const diagnostic = vi.fn(
      () =>
        new Promise<{ image: typeof image }>((resolve) => {
          finishDiagnostic = resolve;
        }),
    );
    const mocked = services({ diagnostic });
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());

    await store.getState().analyzeUploadedObject(humanActionOptions(store));

    expect(store.getState().diagnosticStatus).toBe("generating");
    expect(mocked.getNextQuestion).not.toHaveBeenCalled();

    finishDiagnostic?.({ image });
    await vi.waitFor(() => expect(store.getState().questionStatus).toBe("asking"));

    expect(mocked.getNextQuestion).toHaveBeenCalledOnce();
  });

  it("preserves Meshy progress and offers an in-place retry after model failure", async () => {
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
    const progressValues: Array<number | null> = [];
    const unsubscribe = store.subscribe((state) => progressValues.push(state.generationProgress));
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));
    await store.getState().start3DGeneration(humanActionOptions(store));
    await vi.waitFor(() => expect(store.getState().generationStatus).toBe("failed"));
    unsubscribe();

    expect(mocked.getModelGeneration).toHaveBeenCalledTimes(2);
    expect(progressValues).toContain(40);
    expect(store.getState()).toMatchObject({
      visualMode: "model",
      image: expect.any(Object),
      originalFile: null,
    });
  });

  it("refreshes an expired analysis session before retrying 3D generation", async () => {
    const refreshedSessionToken = "r".repeat(48);
    const analyze = vi
      .fn<WorkspaceServices["analyzeObject"]>()
      .mockResolvedValueOnce({ sessionToken, analysis: analysis() })
      .mockResolvedValueOnce({ sessionToken: refreshedSessionToken, analysis: analysis() });
    const expired = Object.assign(new Error("The generation session has expired."), {
      code: "SESSION_EXPIRED",
    });
    const startModel = vi
      .fn<WorkspaceServices["startModelGeneration"]>()
      .mockRejectedValueOnce(expired)
      .mockResolvedValueOnce({ jobId, status: "queued", message: "Queued." });
    const mocked = services({
      analyze,
      startModel,
      wait: vi.fn(() => new Promise<void>(() => undefined)),
    });
    const store = createWorkspaceStore(mocked);
    store.getState().selectImage(photo());
    await store.getState().analyzeUploadedObject(humanActionOptions(store));

    await expect(store.getState().start3DGeneration(humanActionOptions(store))).resolves.toEqual({
      ok: true,
    });

    expect(analyze).toHaveBeenCalledTimes(2);
    expect(startModel).toHaveBeenCalledTimes(2);
    expect(startModel).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionToken: refreshedSessionToken }),
      expect.any(AbortSignal),
    );
    expect(store.getState()).toMatchObject({
      sessionToken: refreshedSessionToken,
      generationStatus: "queued",
      generationError: null,
      isBusy: true,
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
    await vi.waitFor(() => expect(store.getState().questionStatus).toBe("asking"));
    expect(mocked.getNextQuestion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ answers: [], problemDescription: "" }),
      expect.any(AbortSignal),
    );
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
    await vi.waitFor(() => expect(store.getState().questionStatus).toBe("complete"));
    expect(mocked.getNextQuestion).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        answers: [
          expect.objectContaining({
            question: "Does the guard move while the fan is unplugged?",
            observation: { kind: "visual", description: "The guard moves slightly." },
          }),
        ],
      }),
      expect.any(AbortSignal),
    );
    await expect(store.getState().draftRepairPlan(humanActionOptions(store))).resolves.toEqual({
      ok: true,
    });

    expect(mocked.draftRepairPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: [
          {
            questionId: "question.1",
            question: "Does the guard move while the fan is unplugged?",
            observation: { kind: "visual", description: "The guard moves slightly." },
          },
        ],
      }),
      expect.any(AbortSignal),
    );
    expect(store.getState().plan).not.toBeNull();
    await vi.waitFor(() =>
      expect(
        store.getState().repairStepVisuals.every((visual) => visual.status === "succeeded"),
      ).toBe(true),
    );
    expect(mocked.generateRepairStepVisual).toHaveBeenCalledTimes(5);
    expect(store.getState()).toMatchObject({
      activeRepairStepIndex: 0,
      visualMode: "guide",
      guidePageOpen: true,
      planToken,
    });
  });

  it("shows step one while the remaining repair visuals continue in the background", async () => {
    let finishSecond: ((value: { stepIndex: number; image: typeof image }) => void) | undefined;
    const guide = vi.fn(async ({ stepIndex }: { stepIndex: number }) => {
      if (stepIndex !== 1) return { stepIndex, image };
      return new Promise<{ stepIndex: number; image: typeof image }>((resolve) => {
        finishSecond = resolve;
      });
    });
    const store = createWorkspaceStore(services({ guide }));
    const repairPlan = plan();
    store.setState({
      image: { name: "fan.jpg", previewUrl: "blob:fan", width: 640, height: 480 },
      compressedImage: image,
      analysis: analysis(),
      sessionToken,
      plan: repairPlan,
      planToken,
      guidePageOpen: true,
      visualMode: "guide",
      repairStepVisuals: repairGuideSteps(repairPlan).map(() => ({
        status: "idle",
        image: null,
        error: null,
      })),
    });

    const generation = store.getState().generateRepairStepVisuals(humanActionOptions(store));
    await vi.waitFor(() =>
      expect(store.getState().repairStepVisuals[1]?.status).toBe("generating"),
    );

    expect(store.getState().repairStepVisuals[0]?.status).toBe("succeeded");
    expect(store.getState().activeRepairStepIndex).toBe(0);
    expect(guide).toHaveBeenCalledTimes(2);

    finishSecond?.({ stepIndex: 1, image });
    await expect(generation).resolves.toEqual({ ok: true });
    expect(
      store.getState().repairStepVisuals.every((visual) => visual.status === "succeeded"),
    ).toBe(true);
  });

  it("regenerates every repair visual when the existing set already succeeded", async () => {
    const guide = vi.fn(async ({ stepIndex }: { stepIndex: number }) => ({ stepIndex, image }));
    const store = createWorkspaceStore(services({ guide }));
    const repairPlan = plan();
    const steps = repairGuideSteps(repairPlan);
    store.setState({
      image: { name: "fan.jpg", previewUrl: "blob:fan", width: 640, height: 480 },
      compressedImage: image,
      analysis: analysis(),
      sessionToken,
      plan: repairPlan,
      planToken,
      guidePageOpen: true,
      visualMode: "guide",
      repairStepVisuals: steps.map(() => ({ status: "succeeded", image, error: null })),
    });

    await expect(
      store.getState().generateRepairStepVisuals(humanActionOptions(store)),
    ).resolves.toEqual({ ok: true });

    expect(guide).toHaveBeenCalledTimes(steps.length);
    expect(guide.mock.calls.map(([request]) => request.stepIndex)).toEqual(
      steps.map((_, index) => index),
    );
  });

  it("keeps a contextual repair conversation in workspace state", async () => {
    const assistant = vi.fn(async () => ({
      answer: "Use the matching hand tool shown in step 2.",
    }));
    const store = createWorkspaceStore(services({ assistant }));
    store.setState({
      image: { name: "fan.jpg", previewUrl: "blob:fan", width: 640, height: 480 },
      compressedImage: image,
      analysis: analysis(),
      sessionToken,
      plan: plan(),
      planToken,
      activeRepairStepIndex: 1,
    });

    await expect(
      store.getState().askRepairAssistant("Which tool do I need?", humanActionOptions(store)),
    ).resolves.toEqual({ ok: true });

    expect(assistant).toHaveBeenCalledWith(
      expect.objectContaining({
        activeStepIndex: 1,
        messages: [{ role: "user", content: "Which tool do I need?" }],
      }),
      expect.any(AbortSignal),
    );
    expect(store.getState().assistantMessages).toEqual([
      { role: "user", content: "Which tool do I need?" },
      { role: "assistant", content: "Use the matching hand tool shown in step 2." },
    ]);
    expect(store.getState().assistantChatStatus).toBe("idle");
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
