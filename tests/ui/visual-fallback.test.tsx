import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ObjectAnalysis } from "../../src/generation/contracts";
import { workspaceStore } from "../../src/workspace";

vi.mock("../../src/scene/quality", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/scene/quality")>();
  return { ...original, supportsWebGL: () => true };
});

vi.mock("../../src/scene/RepairScene", () => ({
  RepairScene: () => {
    throw new Error("Remote model blocked by CORS");
  },
}));

import { RepairGuidance } from "../../src/bench/RepairGuidance";
import { VisualWorkspace } from "../../src/bench/VisualWorkspace";

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

describe("3D model fallback", () => {
  beforeEach(() => {
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

  it("starts the selected OpenAI and Meshy views from enabled tabs", async () => {
    const user = userEvent.setup();
    workspaceStore.setState({
      model: null,
      modelError: null,
      generationStatus: "idle",
      diagnosticStatus: "idle",
      visualMode: "photo",
      isBusy: false,
    });
    const diagnostic = vi
      .spyOn(workspaceStore.getState(), "generateDiagnosticView")
      .mockResolvedValue({ ok: true });
    const model = vi
      .spyOn(workspaceStore.getState(), "start3DGeneration")
      .mockResolvedValue({ ok: true });
    render(<VisualWorkspace />);

    await user.click(screen.getByRole("button", { name: "Damage map" }));
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(workspaceStore.getState().visualMode).toBe("diagnostic");

    await user.click(screen.getByRole("button", { name: "3D model" }));
    expect(model).toHaveBeenCalledOnce();
    expect(workspaceStore.getState().visualMode).toBe("model");

    diagnostic.mockRestore();
    model.mockRestore();
  });

  it("returns to the interactive photo when the remote GLB cannot load", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<VisualWorkspace />);

    await waitFor(() =>
      expect(screen.getByAltText("Uploaded view of Desk fan")).toHaveAttribute("src", "blob:fan"),
    );
    expect(screen.getByText(/remote model blocked access/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Inspect area 1: Front guard" }));
    expect(workspaceStore.getState().focusedHotspotId).toBe("guard");
    expect(screen.getByText("Selected area")).toBeInTheDocument();
    expect(screen.getByText("The visible front guard.")).toBeInTheDocument();
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
        message: "The provider could not build this model.",
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

    expect(screen.getByText("The provider could not build this model.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /does the guard move/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry 3D model" })).toBeInTheDocument();
  });

  it("keeps the 3D tab enabled and renders Meshy progress in the visual canvas", () => {
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

    render(<VisualWorkspace />);

    expect(screen.getByRole("button", { name: /3D model/i })).toBeEnabled();
    expect(
      screen.getByRole("progressbar", { name: "3D model generation progress" }),
    ).toHaveAttribute("aria-valuenow", "47");
    expect(screen.getByText("47% complete")).toBeInTheDocument();
    expect(screen.getByText("Building geometry.")).toBeInTheDocument();
  });

  it("renders the original and generated damage map as a synchronized comparison", async () => {
    const user = userEvent.setup();
    workspaceStore.setState({
      diagnosticImage: { mediaType: "image/webp", base64: "QUFBQQ==" },
      diagnosticStatus: "succeeded",
      visualMode: "diagnostic",
    });

    render(<VisualWorkspace />);

    expect(screen.getByAltText("Original view of Desk fan")).toHaveAttribute("src", "blob:fan");
    expect(screen.getByAltText("OpenAI diagnostic damage map of Desk fan")).toHaveAttribute(
      "src",
      "data:image/webp;base64,QUFBQQ==",
    );
    await user.click(screen.getByRole("button", { name: "Inspect area 1: Front guard" }));
    expect(screen.getByText("The visible front guard.")).toBeInTheDocument();
  });
});
