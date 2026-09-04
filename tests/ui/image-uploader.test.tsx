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

  it("opens the native image picker when the site tool is called", async () => {
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

    await waitFor(() => expect(openPicker).toHaveBeenCalledOnce());
    expect(result).toMatchObject({
      ok: true,
      source: "webmcp",
      summary: expect.stringContaining("Opened the image picker"),
    });
    expect(screen.getByText(/Assistance opened the image picker/)).toBeInTheDocument();
    expect(workspaceStore.getState().image).toBeNull();
    await runtime.dispose();
  });
});
