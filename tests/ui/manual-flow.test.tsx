import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { repairStore } from "../../src/domain/repairStore";
import { selectStage } from "../../src/domain/selectors";

describe("manual repair flow", () => {
  beforeEach(() => {
    repairStore.getState().resetSession();
  });

  it("completes the canonical repair with human-only approval and steps", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Explore manually" }));
    await user.click(await screen.findByRole("button", { name: "Open power system" }));
    await user.click(await screen.findByRole("button", { name: "Record steady-green" }));
    await user.click(await screen.findByRole("button", { name: "Sleeve looks normal" }));
    await user.click(await screen.findByRole("button", { name: "Record 3.26 V" }));
    await user.click(await screen.findByRole("button", { name: "Record 2.31 V" }));
    await user.click(await screen.findByRole("button", { name: "Record 3.08 V" }));

    const stagePlan = await screen.findByRole("button", { name: "Stage plan" });
    expect(screen.getByText("Likely cause: battery cell wear.")).toBeInTheDocument();
    await user.click(stagePlan);
    await user.click(await screen.findByRole("button", { name: "Stage compatible part" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve plan as the person" }));

    for (let step = 0; step < 11; step += 1) {
      await user.click(
        await screen.findByRole("button", { name: "I completed this physical step" }),
      );
    }
    await user.click(await screen.findByRole("button", { name: "Confirm test passed" }));

    expect(await screen.findByText("The Aurelia S1 is lit again.")).toBeInTheDocument();
    expect(selectStage(repairStore.getState())).toBe("restored");
    expect(repairStore.getState().completedStepIds).toHaveLength(11);
  }, 15_000);

  it("stops the repair when the person reports battery swelling", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Explore manually" }));
    await user.click(await screen.findByRole("button", { name: "Open power system" }));
    await user.click(await screen.findByRole("button", { name: "Record steady-green" }));
    await user.click(await screen.findByRole("button", { name: "Report swelling and stop" }));

    expect(await screen.findByText("Do not continue this repair.")).toBeInTheDocument();
    expect(selectStage(repairStore.getState())).toBe("stopped");
  });
});
