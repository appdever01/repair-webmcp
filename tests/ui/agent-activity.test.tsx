import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgentRuntime } from "../../src/agent-runtime";
import { ActivityDock } from "../../src/bench/ActivityDock";
import { createWorkspaceController, createWorkspaceStore } from "../../src/workspace";
import type { WorkspaceServices } from "../../src/workspace/services";

function unusedServices(): WorkspaceServices {
  const unavailable = async () => {
    throw new Error("Not used in this test.");
  };
  return {
    analyzeObject: unavailable,
    generateDiagnosticView: unavailable,
    getNextQuestion: unavailable,
    startModelGeneration: unavailable,
    getModelGeneration: unavailable,
    draftRepairPlan: unavailable,
    prepareImage: unavailable,
    wait: unavailable,
  } as WorkspaceServices;
}

describe("visible agent invocation activity", () => {
  it("labels guided demo activity and shows its lifecycle without exposing raw inputs", async () => {
    const user = userEvent.setup();
    const store = createWorkspaceStore(unusedServices());
    const runtime = createAgentRuntime(createWorkspaceController(store), undefined);
    render(<ActivityDock runtime={runtime} />);

    await runtime.invokeForDemo("open_image_uploader", {
      expectedStateVersion: 0,
      token: "secret-value",
    });
    await user.click(screen.getByRole("button", { name: /Agent activity/ }));

    expect(screen.getByText("Guided demo")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("No workspace change was kept.")).toBeInTheDocument();
    expect(screen.queryByText("secret-value")).not.toBeInTheDocument();
    await runtime.dispose();
  });

  it("shows a successful visible change for a guided demo mutation", async () => {
    const store = createWorkspaceStore(unusedServices());
    const runtime = createAgentRuntime(createWorkspaceController(store), undefined);
    render(<ActivityDock runtime={runtime} />);

    await runtime.invokeForDemo("open_image_uploader", { expectedStateVersion: 0 });

    expect(await screen.findByText("Guided demo")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(
      screen.getByText("Image uploader was updated in the visible workspace."),
    ).toBeInTheDocument();
    expect(store.getState().uploaderPromptVisible).toBe(true);
    await runtime.dispose();
  });
});
