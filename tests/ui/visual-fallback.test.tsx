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
  clarifyingQuestions: [],
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

  it("returns to the interactive photo when the remote GLB cannot load", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<VisualWorkspace />);

    await waitFor(() =>
      expect(screen.getByAltText("Uploaded view of Desk fan")).toHaveAttribute("src", "blob:fan"),
    );
    expect(screen.getByText(/remote model blocked access/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Focus hotspot 1: Front guard" }));
    expect(workspaceStore.getState().focusedHotspotId).toBe("guard");
    consoleError.mockRestore();
  });

  it("continues to human questions when 3D generation fails", () => {
    workspaceStore.setState({
      analysis: {
        ...analysis,
        clarifyingQuestions: ["Does the guard move while the fan is unplugged?"],
      },
      model: null,
      generationStatus: "failed",
      generationError: {
        code: "MODEL_GENERATION_FAILED",
        message: "The provider could not build this model.",
        recoverable: true,
      },
      visualMode: "photo",
    });

    render(
      <>
        <VisualWorkspace />
        <RepairGuidance />
      </>,
    );

    expect(screen.getByText(/continue with the interactive photo/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /does the guard move/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry 3D model" })).not.toBeInTheDocument();
  });
});
