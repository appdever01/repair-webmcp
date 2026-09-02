import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import type { ObjectAnalysis, RepairPlan } from "../../src/generation/contracts";
import { workspaceStore } from "../../src/workspace";

function objectAnalysis(): ObjectAnalysis {
  return {
    objectName: "Desk lamp",
    category: "Lighting",
    description: "A small metal desk lamp with a visible loose shade.",
    identificationConfidence: "high",
    visibleCondition: ["The shade appears loose."],
    possibleIssues: [],
    hotspots: [],
    clarifyingQuestions: ["Does the shade move when the lamp is unplugged?"],
    safety: {
      riskLevel: "caution",
      categories: ["ordinary"],
      rationale: "Only an external mechanical issue is visible.",
    },
    stopConditions: ["Stop if wiring or damaged insulation becomes visible."],
    providerSafeDescription: "One small metal desk lamp with its visible wear preserved.",
  };
}

function repairPlan(): RepairPlan {
  return {
    limitations: ["The internal fastener cannot be confirmed from the photo."],
    unknowns: ["The fastener type is unknown."],
    riskLevel: "moderate",
    hypotheses: [],
    safeNextChecks: [],
    proposedRepairPlan: [],
    toolsAndMaterials: [],
    stopConditions: ["Stop if wiring or damaged insulation becomes visible."],
    professionalHelp: {
      required: false,
      reason: "No high-risk repair is proposed from the available evidence.",
    },
  };
}

describe("upload-first manual experience", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:local-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    workspaceStore.getState().reset();
  });

  it("explains the product and remains fully usable in manual mode", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Show us what needs fixing." })).toBeInTheDocument();
    expect(screen.getByText("Manual mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agent activity/ })).toHaveTextContent("0 actions");
    expect(screen.getByRole("button", { name: "Try the sample lamp" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("shows a local preview, gates analysis on consent, and removes image memory", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText(/Choose a photo/);

    await user.upload(input, new File(["photo"], "toaster.jpg", { type: "image/jpeg" }));

    expect(screen.getByAltText("Selected object preview")).toHaveAttribute(
      "src",
      "blob:local-preview",
    );
    expect(screen.getByRole("button", { name: "Understand this object" })).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /send this image to OpenAI for analysis/i,
      }),
    );
    expect(screen.getByRole("button", { name: "Understand this object" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByAltText("Selected object preview")).not.toBeInTheDocument();
    expect(workspaceStore.getState().originalFile).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
  });

  it("keeps repair questions ahead of optional 3D generation", async () => {
    const analysis = objectAnalysis();
    workspaceStore.setState({
      analysis,
      stage: "analysis",
      sessionToken: "s".repeat(48),
      compressedImage: { mediaType: "image/jpeg", base64: "YWJjZA==" },
      objectNameCorrection: analysis.objectName,
    });
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: analysis.clarifyingQuestions[0] ?? "Clarifying question",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Build optional 3D" })).not.toBeInTheDocument();

    workspaceStore.setState({ plan: repairPlan(), stage: "guidance" });

    expect(await screen.findByRole("button", { name: "Build optional 3D" })).toBeInTheDocument();
  });

  it("rejects unsupported files with an accessible message", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/Choose a photo/), {
      target: { files: [new File(["animation"], "object.gif", { type: "image/gif" })] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image.");
    expect(workspaceStore.getState().image).toBeNull();
  });
});
