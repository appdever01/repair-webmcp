import { act, render, screen, waitFor } from "@testing-library/react";
import { createAgentRuntime } from "../../src/agent-runtime";
import { IntakePanel } from "../../src/bench/IntakePanel";
import { ModelContextMock } from "../../src/test/modelContextMock";
import { createWorkspaceController, workspaceStore } from "../../src/workspace";

describe("WebMCP image uploader", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    workspaceStore.getState().reset();
  });

  it("focuses the uploader and requests the browser-required human gesture", async () => {
    const modelContext = new ModelContextMock();
    const runtime = createAgentRuntime(createWorkspaceController(workspaceStore), modelContext);
    render(<IntakePanel />);
    const imageInput = screen.getByLabelText("Choose a photo");
    const openPicker = vi.spyOn(imageInput, "click");

    await runtime.ready;
    let result: unknown;
    await act(async () => {
      result = await modelContext.execute("open_image_uploader", {
        expectedStateVersion: workspaceStore.getState().stateVersion,
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Drop or paste your photo/ })).toHaveFocus(),
    );
    expect(openPicker).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      source: "webmcp",
      code: "HUMAN_ACTION_REQUIRED",
      message: expect.stringContaining("press Enter or click"),
      affectedTarget: { id: "image-uploader" },
    });
    expect(screen.getByText(/The uploader is ready/)).toBeInTheDocument();
    expect(workspaceStore.getState().image).toBeNull();
    await runtime.dispose();
  });
});
