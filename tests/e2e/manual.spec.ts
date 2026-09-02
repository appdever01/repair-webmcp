import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("manual repair reaches restored state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore manually" }).click();
  await page.getByRole("button", { name: "Open power system" }).click();
  await page.getByRole("button", { name: "Record steady-green" }).click();
  await page.getByRole("button", { name: "Sleeve looks normal" }).click();
  await page.getByRole("button", { name: "Record 3.26 V" }).click();
  await page.getByRole("button", { name: "Record 2.31 V" }).click();
  await page.getByRole("button", { name: "Record 3.08 V" }).click();
  await page.getByRole("button", { name: "Stage plan" }).click();
  await page.getByRole("button", { name: "Stage compatible part" }).click();
  await page.getByRole("button", { name: "Approve plan as the person" }).click();
  for (let step = 0; step < 11; step += 1) {
    await page.getByRole("button", { name: "I completed this physical step" }).click();
  }
  await page.getByRole("button", { name: "Confirm test passed" }).click();
  await expect(page.getByRole("heading", { name: "The Aurelia S1 is lit again." })).toBeVisible();
});

test("intake has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
