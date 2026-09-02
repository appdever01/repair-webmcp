import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { workspaceStore } from "../../src/workspace";

vi.mock("../../src/scene/quality", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/scene/quality")>();
  return { ...original, supportsWebGL: () => true };
});

vi.mock("../../src/scene/RepairScene", () => ({
  RepairScene: ({ exploded }: { exploded: boolean }) => (
    <div data-testid="generated-model">{exploded ? "exploded" : "assembled"}</div>
  ),
}));

import { VisualWorkspace } from "../../src/bench/VisualWorkspace";

describe("generated model exploded view", () => {
  beforeEach(() => {
    workspaceStore.getState().reset();
    workspaceStore.setState({
      model: { glbUrl: "https://assets.example/model.glb", posterUrl: null },
      generationStatus: "succeeded",
      visualMode: "model",
    });
  });

  it("lets a person explode and reassemble generated model parts", async () => {
    const user = userEvent.setup();
    render(<VisualWorkspace />);

    expect(await screen.findByTestId("generated-model")).toHaveTextContent("assembled");
    const explode = screen.getByRole("button", { name: "Explode model parts" });
    expect(explode).toHaveAttribute("aria-pressed", "false");

    await user.click(explode);

    expect(screen.getByTestId("generated-model")).toHaveTextContent("exploded");
    const assemble = screen.getByRole("button", { name: "Assemble model parts" });
    expect(assemble).toHaveAttribute("aria-pressed", "true");

    await user.click(assemble);

    expect(screen.getByTestId("generated-model")).toHaveTextContent("assembled");
  });
});
