import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgentRuntime } from "../../src/agent-runtime";
import { ActivityDock } from "../../src/bench/ActivityDock";
import type { ObjectAnalysis, RepairPlan } from "../../src/generation/contracts";
import {
  createWorkspaceController,
  createWorkspaceStore,
  workspaceStore,
} from "../../src/workspace";
import type { WorkspaceServices } from "../../src/workspace/services";

const chatAnalysis: ObjectAnalysis = {
  objectName: "Desk lamp",
  category: "Lighting",
  description: "A lamp with a loose shade.",
  identificationConfidence: "high",
  visibleCondition: ["The shade appears loose."],
  possibleIssues: [],
  hotspots: [],
  safety: { riskLevel: "caution", categories: ["ordinary"], rationale: "Keep it unplugged." },
  stopConditions: ["Stop if damaged wiring is visible."],
  providerSafeDescription: "One desk lamp with a visibly loose shade.",
};

const chatPlan: RepairPlan = {
  limitations: ["Internal condition is unknown."],
  unknowns: [],
  riskLevel: "moderate",
  hypotheses: [],
  safeNextChecks: [
    {
      title: "Check the joint",
      instructions: "Keep the lamp unplugged and inspect the visible joint.",
      caution: null,
    },
  ],
  proposedRepairPlan: [],
  toolsAndMaterials: [],
  stopConditions: ["Stop if damaged wiring is visible."],
  professionalHelp: { required: false, reason: "No high-risk action is proposed." },
};

function chatImage() {
  return { mediaType: "image/png" as const, base64: "YWJjZA==" };
}

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
    prepareImage: unavailable,
    wait: unavailable,
  } as WorkspaceServices;
}

describe("visible agent invocation activity", () => {
  beforeEach(() => {
    workspaceStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("labels guided demo activity and shows its lifecycle without exposing raw inputs", async () => {
    const user = userEvent.setup();
    const store = createWorkspaceStore(unusedServices());
    const runtime = createAgentRuntime(createWorkspaceController(store), undefined);
    render(<ActivityDock runtime={runtime} />);

    await act(async () => {
      await runtime.invokeForDemo("open_image_uploader", {
        expectedStateVersion: 0,
        token: "secret-value",
      });
    });
    await user.click(screen.getByRole("button", { name: "Open repair assistant" }));
    await user.click(screen.getByRole("tab", { name: /Activity/ }));

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("No workspace change was kept.")).toBeInTheDocument();
    expect(screen.queryByText("secret-value")).not.toBeInTheDocument();
    await runtime.dispose();
  });

  it("shows a successful visible change for a guided demo mutation", async () => {
    const user = userEvent.setup();
    const store = createWorkspaceStore(unusedServices());
    const runtime = createAgentRuntime(createWorkspaceController(store), undefined);
    render(<ActivityDock runtime={runtime} />);

    await act(async () => {
      await runtime.invokeForDemo("open_image_uploader", { expectedStateVersion: 0 });
    });

    if (!workspaceStore.getState().activityOpen) {
      await user.click(screen.getByRole("button", { name: "Open repair assistant" }));
    }
    await user.click(screen.getByRole("tab", { name: /Activity/ }));

    expect(await screen.findByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(
      screen.getByText("Image uploader was updated in the visible workspace."),
    ).toBeInTheDocument();
    expect(store.getState().uploaderPromptVisible).toBe(true);
    await runtime.dispose();
  });

  it("opens a working contextual repair chat", async () => {
    const user = userEvent.setup();
    const store = createWorkspaceStore(unusedServices());
    const runtime = createAgentRuntime(createWorkspaceController(store), undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ answer: "Use the matching hand tool and keep the lamp unplugged." }),
      );
    vi.stubGlobal("fetch", fetchMock);
    workspaceStore.setState({
      image: { name: "lamp.png", previewUrl: "blob:lamp", width: 1, height: 1 },
      compressedImage: chatImage(),
      analysis: chatAnalysis,
      sessionToken: "s".repeat(48),
      plan: chatPlan,
      planToken: "p".repeat(48),
      activeRepairStepIndex: 0,
    });
    render(<ActivityDock runtime={runtime} />);

    await user.click(screen.getByRole("button", { name: "Open repair assistant" }));
    await user.type(screen.getByRole("textbox", { name: "Ask a repair question" }), "Which tool?");
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(
      await screen.findByText("Use the matching hand tool and keep the lamp unplugged."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.at(0)?.[0]).toBe("/api/object/chat");
    expect(screen.getByText("Which tool?")).toBeInTheDocument();
    await runtime.dispose();
  });
});
