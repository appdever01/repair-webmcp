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

    expect(screen.getByRole("heading", { name: "One photo. A clearer fix." })).toBeInTheDocument();
    expect(screen.queryByText("Manual mode")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agent activity/ })).toHaveTextContent("0 actions");
    expect(screen.getByRole("button", { name: "broken cup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "desk lamp" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Four short steps. You stay in charge." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The same workspace, exposed as WebMCP tools." }),
    ).toBeInTheDocument();
    expect(screen.getByText("get_workspace_state")).toBeInTheDocument();
    expect(screen.getByText("draft_repair_plan")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "A live agent session in a few minutes." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/appdever01/repair-webmcp",
    );
    expect(screen.getByText(/Your photo stays on this device until you start/)).toBeInTheDocument();
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
    expect(screen.getByText("Powered by OpenAI")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Understand this object" })).toBeEnabled();
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

    const button = screen.getByRole("button", { name: "Understanding your photo" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".loading-spinner")).toBeInTheDocument();
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
