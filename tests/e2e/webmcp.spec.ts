import { expect, type Page, test } from "@playwright/test";

const toolNames = (page: Page) =>
  page.evaluate(async () => {
    const tools = await document.modelContext?.getTools();
    return tools?.map((tool) => tool.name) ?? [];
  });

const execute = (page: Page, name: string, input: Record<string, unknown>) =>
  page.evaluate(
    async ([toolName, toolInput]) => {
      const context = document.modelContext as
        | (WebMCP.ModelContext & {
            executeTool(tool: WebMCP.RegisteredTool, input: string): Promise<string>;
          })
        | undefined;
      if (!context) throw new Error("WebMCP is not available in this browser.");
      const tools = await context.getTools();
      const tool = tools.find((item) => item.name === toolName);
      if (!tool) throw new Error(`Tool ${toolName} is not registered.`);
      return JSON.parse(await context.executeTool(tool, JSON.stringify(toolInput))) as Record<
        string,
        unknown
      >;
    },
    [name, input] as const,
  );

test("registers stage-aware tools on document.modelContext and executes them", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Assistant/ })).toHaveText(/2 actions/);
  expect(await toolNames(page)).toEqual(["get_workspace_state", "open_image_uploader"]);

  const state = await execute(page, "get_workspace_state", {});
  expect(state).toMatchObject({ ok: true, source: "webmcp", stateVersion: 0 });

  const opened = await execute(page, "open_image_uploader", { expectedStateVersion: 0 });
  expect(opened).toMatchObject({
    ok: false,
    code: "HUMAN_ACTION_REQUIRED",
    stateVersion: 1,
    affectedTarget: { id: "image-uploader" },
  });
  await expect(page.getByRole("button", { name: /Assistant/ })).toHaveText(/3 actions/);
  await expect(page.getByText("Assistant ready.", { exact: false })).toBeVisible();
  await expect(
    page.getByText("The uploader is ready on the page. Press Enter or click it to choose a photo."),
  ).toBeVisible();
  expect(await toolNames(page)).toEqual([
    "get_workspace_state",
    "open_image_uploader",
    "undo_agent_action",
  ]);

  const stale = await execute(page, "open_image_uploader", { expectedStateVersion: 0 });
  expect(stale).toMatchObject({ ok: false, code: "STALE_STATE", stateVersion: 1 });

  const undone = await execute(page, "undo_agent_action", {
    activityId: "activity.1",
    expectedStateVersion: 1,
  });
  expect(undone).toMatchObject({ ok: true, stateVersion: 2 });
  await expect(page.getByRole("button", { name: /Assistant/ })).toHaveText(/2 actions/);
  expect(await toolNames(page)).toEqual(["get_workspace_state", "open_image_uploader"]);
  expect(pageErrors).toEqual([]);
});
