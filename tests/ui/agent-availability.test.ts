import { selectAvailableAgentTools, type WorkspaceSnapshot } from "../../src/agent-runtime";

function snapshot(values: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    stage: "intake",
    imageSelected: false,
    analysisExists: false,
    generationStatus: "idle",
    hotspots: [],
    unansweredHumanQuestions: [],
    planExists: false,
    stateVersion: 0,
    reversibleActivity: null,
    safetyStop: null,
    ...values,
  };
}

describe("workspace-aware agent availability", () => {
  it("offers cancellation but not duplicate analysis or model polling while analysis is active", () => {
    expect(
      selectAvailableAgentTools(
        snapshot({ stage: "understanding", imageSelected: true, analysisExists: false }),
      ),
    ).toEqual(["get_workspace_state", "cancel_current_task"]);
  });

  it("does not offer a second plan or generation task while planning is active", () => {
    const tools = selectAvailableAgentTools(
      snapshot({ stage: "planning", imageSelected: true, analysisExists: true }),
    );

    expect(tools).toEqual(["get_workspace_state", "cancel_current_task"]);
    expect(tools).not.toContain("draft_repair_plan");
    expect(tools).not.toContain("start_3d_generation");
  });
});
