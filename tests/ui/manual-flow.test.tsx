import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/app/App";
import { workspaceStore } from "../../src/workspace";

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
        name: /send this image to OpenAI and the configured 3D provider/i,
      }),
    );
    expect(screen.getByRole("button", { name: "Understand this object" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByAltText("Selected object preview")).not.toBeInTheDocument();
    expect(workspaceStore.getState().originalFile).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
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
