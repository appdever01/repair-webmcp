import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ObjectAnalysis, RepairPlan } from "../../src/generation/contracts";
import { workspaceStore } from "../../src/workspace";

vi.mock("../../src/scene/quality", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/scene/quality")>();
  return { ...original, supportsWebGL: () => true };
});

vi.mock("../../src/scene/RepairScene", () => ({
  clearRepairSceneModel: vi.fn(),
  RepairScene: () => {
    throw new Error("Remote model blocked by CORS");
  },
}));

import { RepairGuidance } from "../../src/bench/RepairGuidance";
import { VisualWorkspace } from "../../src/bench/VisualWorkspace";
import { clearRepairSceneModel } from "../../src/scene/RepairScene";

const analysis: ObjectAnalysis = {
  objectName: "Desk fan",
  category: "Appliance",
  description: "A desk fan.",
  identificationConfidence: "high",
  visibleCondition: ["The guard is loose."],
  possibleIssues: [],
  hotspots: [
    {
      id: "guard",
      label: "Front guard",
      description: "The visible front guard.",
      x: 0.5,
      y: 0.4,
      radius: 0.1,
    },
  ],
  safety: { riskLevel: "caution", categories: ["ordinary"], rationale: "Keep it unplugged." },
  stopConditions: ["Stop if wiring is visible."],
  providerSafeDescription: "One desk fan.",
};

const guidePlan: RepairPlan = {
  limitations: ["The fastener type is not visible."],
  unknowns: ["Internal damage is unknown."],
  riskLevel: "moderate",
  hypotheses: [],
  safeNextChecks: [
    {
      title: "Check the guard",
      instructions: "With the fan unplugged, check the visible guard alignment.",
      caution: "Do not reach through the guard.",
    },
  ],
  proposedRepairPlan: [
    {
      title: "Tighten the fastener",
      instructions: "Support the guard and tighten only the visible fastener.",
      caution: null,
    },
  ],
  toolsAndMaterials: ["Matching hand tool"],
  stopConditions: ["Stop if damaged wiring is visible."],
  professionalHelp: { required: false, reason: "No high-risk work is proposed." },
};

describe("3D model fallback", () => {
  beforeEach(() => {
    vi.mocked(clearRepairSceneModel).mockClear();
    workspaceStore.getState().reset();
    workspaceStore.setState({
      analysis,
      objectNameCorrection: "Desk fan",
      image: { name: "fan.jpg", previewUrl: "blob:fan", width: 640, height: 480 },
      model: { glbUrl: "https://assets.example/model.glb", posterUrl: null },
      generationStatus: "succeeded",
      visualMode: "model",
      focusedHotspotId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on the damage map without a photo tab and starts enabled AI views", async () => {
    const user = userEvent.setup();
    workspaceStore.setState({
      model: null,
      modelError: null,
      generationStatus: "idle",
      diagnosticStatus: "idle",
      visualMode: "diagnostic",
      isBusy: false,
    });
    const diagnostic = vi
      .spyOn(workspaceStore.getState(), "generateDiagnosticView")
      .mockResolvedValue({ ok: true });
    const model = vi
      .spyOn(workspaceStore.getState(), "start3DGeneration")
      .mockResolvedValue({ ok: true });
    render(<VisualWorkspace />);

    expect(screen.queryByText("Visual diagnosis")).not.toBeInTheDocument();
    expect(screen.queryByText("See the damage clearly.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Choose a view, then select a numbered area."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Damage map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Damage map" }));
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(workspaceStore.getState().visualMode).toBe("diagnostic");

    await user.click(screen.getByRole("button", { name: "3D model" }));
    expect(model).toHaveBeenCalledOnce();
    expect(workspaceStore.getState().visualMode).toBe("model");

    diagnostic.mockRestore();
    model.mockRestore();
  });

  it("keeps the completed model and reloads it without regenerating after a viewer failure", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const regenerate = vi
      .spyOn(workspaceStore.getState(), "start3DGeneration")
      .mockResolvedValue({ ok: true });
    render(<VisualWorkspace />);

    await waitFor(() =>
      expect(
        screen.getByText("Your model is ready, but the viewer could not load it"),
      ).toBeInTheDocument(),
    );
    expect(workspaceStore.getState()).toMatchObject({
      visualMode: "model",
      model: { glbUrl: "https://assets.example/model.glb" },
      generationStatus: "succeeded",
    });
    expect(screen.getByRole("button", { name: "Retry loading model" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3D model" }));
    await waitFor(() =>
      expect(
        screen.getByText("Your model is ready, but the viewer could not load it"),
      ).toBeInTheDocument(),
    );
    expect(regenerate).not.toHaveBeenCalled();
    expect(clearRepairSceneModel).toHaveBeenCalledWith("https://assets.example/model.glb");
    expect(workspaceStore.getState().model).not.toBeNull();

    regenerate.mockRestore();
    consoleError.mockRestore();
  });

  it("continues to human questions and offers an in-place retry when 3D generation fails", () => {
    workspaceStore.setState({
      analysis,
      questions: [
        {
          id: "question.1",
          prompt: "Does the guard move while the fan is unplugged?",
          why: "Movement helps distinguish a loose guard from visual misalignment.",
          suggestedKind: "visual",
          quickReplies: ["Yes, it moves", "No, it stays fixed", "I’m not sure"],
          hotspotId: "guard",
        },
      ],
      questionStatus: "asking",
      activeQuestionId: "question.1",
      model: null,
      generationStatus: "failed",
      generationError: {
        code: "MODEL_GENERATION_FAILED",
        message: "The 3D reconstruction could not build this model.",
        recoverable: true,
      },
      visualMode: "model",
    });

    render(
      <>
        <VisualWorkspace />
        <RepairGuidance />
      </>,
    );

    expect(
      screen.getByText("The 3D reconstruction could not build this model."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /does the guard move/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry 3D model" })).toBeInTheDocument();
  });

  it("keeps the 3D tab enabled and renders AI progress in the visual canvas", () => {
    workspaceStore.setState({
      model: null,
      modelError: null,
      generationStatus: "processing",
      generationProgress: 47,
      generationMessage: "Building geometry.",
      stage: "generating",
      isBusy: true,
      visualMode: "model",
    });

    const { container } = render(<VisualWorkspace />);

    expect(screen.getByRole("button", { name: /3D model/i })).toBeEnabled();
    expect(
      screen.getByRole("progressbar", { name: "3D model generation progress" }),
    ).toHaveAttribute("aria-valuenow", "47");
    expect(screen.getByText("47% complete")).toBeInTheDocument();
    expect(screen.getByText("Building geometry.")).toBeInTheDocument();
    expect(screen.getByText("3D reconstruction")).toBeInTheDocument();
    expect(screen.getByText("You can keep reviewing the damage map")).toBeInTheDocument();
    expect(container.querySelectorAll(".loading-cube")).toHaveLength(3);
  });

  it("renders the original and generated damage map as a synchronized comparison", () => {
    workspaceStore.setState({
      diagnosticImage: { mediaType: "image/webp", base64: "QUFBQQ==" },
      diagnosticStatus: "succeeded",
      visualMode: "diagnostic",
    });

    render(<VisualWorkspace />);

    expect(screen.getByAltText("Original view of Desk fan")).toHaveAttribute("src", "blob:fan");
    expect(screen.getByAltText("AI diagnostic damage map of Desk fan")).toHaveAttribute(
      "src",
      "data:image/webp;base64,QUFBQQ==",
    );
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("AI map")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /areas that may need attention/i })).toBeNull();
  });

  it("keeps each generated wireframe aligned with its interactive repair step", async () => {
    const user = userEvent.setup();
    workspaceStore.setState({
      plan: guidePlan,
      planToken: "p".repeat(48),
      repairStepVisuals: [
        {
          status: "succeeded",
          image: { mediaType: "image/webp", base64: "QUFBQQ==" },
          error: null,
        },
        {
          status: "succeeded",
          image: { mediaType: "image/webp", base64: "QkJCQg==" },
          error: null,
        },
      ],
      activeRepairStepIndex: 0,
      visualMode: "guide",
    });

    const { container } = render(
      <>
        <VisualWorkspace />
        <RepairGuidance />
      </>,
    );

    expect(screen.getByAltText("Wireframe for step 1: Check the guard")).toHaveAttribute(
      "src",
      "data:image/webp;base64,QUFBQQ==",
    );
    expect(container.querySelector(".repair-step-title mark")).toHaveTextContent("Check");
    expect(container.querySelector(".step-instruction > span")).toHaveTextContent(
      "With the fan unplugged, check the visible guard alignment.",
    );
    await user.click(screen.getByRole("button", { name: "Show next step" }));
    expect(screen.getByRole("heading", { name: "Tighten the fastener" })).toBeInTheDocument();
    expect(container.querySelector(".repair-step-title mark")).toHaveTextContent("Tighten");
    expect(screen.getByAltText("Wireframe for step 2: Tighten the fastener")).toHaveAttribute(
      "src",
      "data:image/webp;base64,QkJCQg==",
    );
    expect(screen.getByRole("button", { name: "Review from start" })).toBeInTheDocument();
  });

  it("shows animated indeterminate progress while a repair visual is being drawn", () => {
    workspaceStore.setState({
      plan: guidePlan,
      repairStepVisuals: [{ status: "generating", image: null, error: null }],
      activeRepairStepIndex: 0,
      visualMode: "guide",
    });

    const { container } = render(<VisualWorkspace />);

    expect(screen.getByText("Drawing step 1")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Generating visual for step 1" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".guide-scan-line")).toBeInTheDocument();
    expect(container.querySelector(".guide-drawing-mark")).toBeInTheDocument();
  });

  it("does not overlay approximate analysis coordinates on the source photo", () => {
    workspaceStore.setState({
      diagnosticStatus: "succeeded",
      diagnosticImage: { mediaType: "image/webp", base64: "QUFBQQ==" },
      visualMode: "diagnostic",
    });
    render(<VisualWorkspace />);

    expect(screen.getByAltText("Original view of Desk fan")).toHaveAttribute("src", "blob:fan");
    expect(screen.queryByRole("group", { name: /areas that may need attention/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /inspect area/i })).toBeNull();
  });
});
