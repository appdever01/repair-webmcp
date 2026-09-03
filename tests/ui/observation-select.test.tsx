import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepairGuidance } from "../../src/bench/RepairGuidance";
import type { ObjectAnalysis } from "../../src/generation/contracts";
import { workspaceStore } from "../../src/workspace";

const analysis: ObjectAnalysis = {
  objectName: "Cup",
  category: "Kitchenware",
  description: "A cup with visible damage.",
  identificationConfidence: "high",
  visibleCondition: ["The handle is detached."],
  possibleIssues: [],
  hotspots: [],
  safety: { riskLevel: "caution", categories: ["ordinary"], rationale: "Handle carefully." },
  stopConditions: ["Stop if a sharp edge is exposed."],
  providerSafeDescription: "One damaged cup.",
};

describe("observation type select", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    workspaceStore.getState().reset();
    workspaceStore.setState({
      analysis,
      stage: "analysis",
      questions: [
        {
          id: "question.1",
          prompt: "How did the damage occur?",
          why: "The answer helps separate impact damage from gradual wear.",
          suggestedKind: "visual",
          quickReplies: ["It happened suddenly", "It changed over time", "I’m not sure"],
          hotspotId: null,
        },
      ],
      questionStatus: "asking",
      activeQuestionId: "question.1",
    });
  });

  it("uses the shadcn combobox and records the selected observation kind", async () => {
    const user = userEvent.setup();
    const nextQuestion = vi
      .spyOn(workspaceStore.getState(), "loadNextQuestion")
      .mockResolvedValue({ ok: true });
    render(<RepairGuidance />);

    const trigger = screen.getByRole("combobox", { name: "Kind of detail" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    expect(trigger).toHaveTextContent("Something I can see");

    trigger.focus();
    await user.keyboard("[ArrowDown]");
    expect(screen.getByRole("option", { name: "Something I tested" })).toBeInTheDocument();
    await user.keyboard("[ArrowDown][Enter]");
    expect(trigger).toHaveTextContent("Something I tested");

    await user.type(screen.getByRole("textbox", { name: "What do you notice?" }), "It wobbles.");
    await user.click(screen.getByRole("button", { name: "Use this detail" }));

    expect(workspaceStore.getState().answers[0]?.observation).toEqual({
      kind: "functional",
      description: "It wobbles.",
    });
    nextQuestion.mockRestore();
  });

  it("turns an AI quick reply into a human-owned answer in one click", async () => {
    const user = userEvent.setup();
    const nextQuestion = vi
      .spyOn(workspaceStore.getState(), "loadNextQuestion")
      .mockResolvedValue({ ok: true });
    render(<RepairGuidance />);

    await user.click(screen.getByRole("button", { name: "It happened suddenly" }));

    expect(workspaceStore.getState().answers[0]).toMatchObject({
      questionId: "question.1",
      question: "How did the damage occur?",
      observation: { kind: "visual", description: "It happened suddenly" },
    });
    expect(nextQuestion).toHaveBeenCalledOnce();
    nextQuestion.mockRestore();
  });

  it("uses a direct fixing CTA when the photo check is complete", () => {
    workspaceStore.setState({
      questionStatus: "complete",
      activeQuestionId: null,
      questions: [],
      answers: [],
    });

    render(<RepairGuidance />);

    expect(screen.getByRole("heading", { name: "Let’s fix it step by step." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Let’s start fixing" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/interview/i);
  });
});
