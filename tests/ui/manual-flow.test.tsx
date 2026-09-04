import { act, fireEvent, render, screen } from "@testing-library/react";
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
    safeNextChecks: [
      {
        title: "Check visible movement",
        instructions: "With the lamp unplugged, observe whether the shade moves at the joint.",
        caution: "Do not expose or touch any wiring.",
      },
    ],
    proposedRepairPlan: [
      {
        title: "Identify the fastener",
        instructions: "Match the visible fastener to the correct hand tool.",
        caution: null,
      },
      {
        title: "Support the shade",
        instructions: "Hold the shade in its aligned position without pulling the cable.",
        caution: null,
      },
      {
        title: "Tighten gently",
        instructions: "Turn the visible fastener only until the joint is snug.",
        caution: "Stop if the fastener binds or the wire moves.",
      },
      {
        title: "Check the alignment",
        instructions: "Confirm the shade stays in position while the lamp remains unplugged.",
        caution: null,
      },
    ],
    toolsAndMaterials: ["Matching hand tool"],
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

    const heroHeading = screen.getByRole("heading", { name: "One photo. A clearer fix." });
    expect(heroHeading).toBeInTheDocument();
    expect(heroHeading.querySelector(".hero-title-block")).toHaveTextContent("A clearer fix.");
    expect(screen.queryByText("Manual mode")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open repair assistant" })).toHaveTextContent(
      "Ask RE:PAIR",
    );
    expect(screen.getByRole("button", { name: "Try a broken cup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try a desk lamp" })).toBeInTheDocument();
    const stepsHeading = screen.getByRole("heading", {
      name: "Four short steps. You stay in charge.",
    });
    expect(stepsHeading.querySelector("span")).toHaveTextContent("You stay in charge.");
    const capabilitiesHeading = screen.getByRole("heading", { name: "From photo to next step." });
    expect(capabilitiesHeading.querySelector("span")).toHaveTextContent("to next step.");
    expect(screen.getByRole("heading", { name: "Focused diagnosis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interactive context" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Step-by-step guidance" })).toBeInTheDocument();
    expect(screen.queryByText("Sent to OpenAI only when you start.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The things you actually use." }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("A phone with a cracked screen and loose charging port highlighted."),
    ).toHaveAttribute("src", "/repair-phone.png");
    expect(
      screen.getByAltText("A sneaker with a peeling sole highlighted and its layers separated."),
    ).toHaveAttribute("src", "/repair-sneaker.png");
    expect(
      screen.getByAltText("A bicycle with its slipped chain and rear gear highlighted."),
    ).toHaveAttribute("src", "/repair-bike.png");
    expect(screen.queryByRole("navigation", { name: "Page" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RE:PAIR home" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(document.body).not.toHaveTextContent(
      /OpenAI|Meshy|GitHub|ChatGPT|Claude|Codex|WebMCP|MCP/,
    );
    expect(screen.queryByRole("button", { name: "Reset workspace" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Understand the object. Choose a safer next step."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Choose a photo/)).toHaveAttribute("hidden");
  });

  it("accepts an image pasted from the clipboard", () => {
    render(<App />);

    fireEvent.paste(window, {
      clipboardData: {
        files: [new File(["pasted photo"], "clipboard.png", { type: "image/png" })],
        items: [],
      },
    });

    expect(screen.getByAltText("Selected object preview")).toHaveAttribute(
      "src",
      "blob:local-preview",
    );
    expect(screen.queryByText("clipboard.png")).not.toBeInTheDocument();
    expect(
      screen.queryByText("The image stays in this session until you choose to send it."),
    ).not.toBeInTheDocument();
  });

  it("shows a local preview with clear photo actions and removes image memory", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText(/Choose a photo/);

    await user.upload(input, new File(["photo"], "toaster.jpg", { type: "image/jpeg" }));

    expect(screen.getByAltText("Selected object preview")).toHaveAttribute(
      "src",
      "blob:local-preview",
    );
    expect(screen.getByRole("button", { name: "Start analysis" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace photo" })).toHaveClass(
      "replace-image-action",
    );
    expect(screen.getByRole("button", { name: "Remove" })).toHaveClass("remove-image-action");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByAltText("Selected object preview")).not.toBeInTheDocument();
    expect(workspaceStore.getState().originalFile).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
  });

  it("shows a loading spinner while the photo is being understood", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText(/Choose a photo/),
      new File(["photo"], "toaster.jpg", { type: "image/jpeg" }),
    );

    act(() => workspaceStore.setState({ isBusy: true, stage: "uploading" }));

    const button = screen.getByRole("button", { name: "Analyzing" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".loading-spinner")).toBeInTheDocument();
  });

  it("moves from findings into a dedicated illustrated repair guide", async () => {
    const user = userEvent.setup();
    const analysis = objectAnalysis();
    const question = {
      id: "question.1",
      prompt: "Does the shade move when the lamp is unplugged?",
      why: "Movement would help distinguish a loose connection from visible misalignment.",
      suggestedKind: "visual" as const,
      quickReplies: ["Yes, it moves", "No, it stays fixed", "I’m not sure"],
      hotspotId: null,
    };
    workspaceStore.setState({
      analysis,
      stage: "analysis",
      sessionToken: "s".repeat(48),
      compressedImage: { mediaType: "image/jpeg", base64: "YWJjZA==" },
      image: { name: "lamp.jpg", previewUrl: "blob:lamp", width: 640, height: 480 },
      objectNameCorrection: analysis.objectName,
      diagnosticStatus: "succeeded",
      diagnosticImage: { mediaType: "image/webp", base64: "QUFBQQ==" },
      questions: [question],
      questionStatus: "asking",
      activeQuestionId: question.id,
    });
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Desk lamp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start new" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Page" })).not.toBeInTheDocument();
    expect(screen.queryByText("Object workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Workspace live")).not.toBeInTheDocument();
    expect(screen.getAllByText("Desk lamp")).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        name: question.prompt,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3D model" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Build optional 3D" })).not.toBeInTheDocument();

    act(() =>
      workspaceStore.setState({
        plan: repairPlan(),
        planToken: "p".repeat(48),
        stage: "guidance",
        visualMode: "guide",
        guidePageOpen: true,
        repairStepVisuals: [
          {
            status: "succeeded",
            image: { mediaType: "image/webp", base64: "QUFBQQ==" },
            error: null,
          },
        ],
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Check visible movement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Desk lamp" })).toHaveClass(
      "repair-guide-title",
    );
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Do not expose or touch any wiring.")).toHaveClass("step-caution");
    expect(
      screen
        .getByText("Stop if wiring or damaged insulation becomes visible.")
        .closest(".safety-gate"),
    ).toHaveClass("safety-gate");
    expect(screen.getByRole("button", { name: "Show next step" })).toBeInTheDocument();
    expect(screen.queryByText("Visual repair guide")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to findings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View in 3D" })).toBeInTheDocument();
    expect(screen.getByAltText("Wireframe for step 1: Check visible movement")).toHaveAttribute(
      "src",
      "data:image/webp;base64,QUFBQQ==",
    );
    expect(
      screen.getByText("Check visible movement", { selector: ".repair-guide-frame strong" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3D model" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View in 3D" }));
    expect(screen.getByRole("button", { name: "Back to steps" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Back to findings" })).toBeInTheDocument();
    expect(screen.getByText("3D is not supported in this browser")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to steps" }));
    expect(screen.getByAltText("Wireframe for step 1: Check visible movement")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to findings" }));
    expect(screen.getByRole("button", { name: "Repair guide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open repair guide" })).toBeInTheDocument();
  });

  it("keeps the fixing sidebar hidden until the damage map is ready", () => {
    const analysis = objectAnalysis();
    workspaceStore.setState({
      analysis,
      stage: "analysis",
      image: { name: "lamp.jpg", previewUrl: "blob:lamp", width: 640, height: 480 },
      objectNameCorrection: analysis.objectName,
      diagnosticStatus: "generating",
      questionStatus: "complete",
    });

    const { container } = render(<App />);

    expect(screen.queryByRole("button", { name: "Let’s start fixing" })).not.toBeInTheDocument();
    expect(container.querySelector(".workspace-layout")).toHaveAttribute("data-guidance", "hidden");

    act(() => workspaceStore.setState({ diagnosticStatus: "succeeded" }));

    expect(screen.getByRole("button", { name: "Let’s start fixing" })).toBeInTheDocument();
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
