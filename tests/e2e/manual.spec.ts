import { Buffer } from "node:buffer";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("manual upload shows a local preview and stays removable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Analyze this object" })).toBeDisabled();
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "object.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Selected object preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze this object" })).toBeEnabled();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByAltText("Selected object preview")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze this object" })).toBeDisabled();
});

test("upload-first intake has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "One photo. A clearer fix." })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
