import { expect, type Page } from "@playwright/test";
import { boardFixture } from "../src/test/boardFixture";

export const signIn = async (page: Page, username = "user", password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
};

export const expectBoard = async (page: Page) => {
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
};

export const signInToBoard = async (page: Page) => {
  await signIn(page);
  await expectBoard(page);
};

// Board data persists, so each test starts from the default board.
export const signInWithFreshBoard = async (page: Page) => {
  await signIn(page);
  await expectBoard(page);
  const response = await page.request.put("/api/board", { data: boardFixture });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expectBoard(page);
};

// Wait for the pending board save to reach the server before reloading.
export const waitForSave = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith("/api/board") && r.request().method() === "PUT");
