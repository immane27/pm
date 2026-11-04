import { expect, test } from "@playwright/test";
import { boardFixture } from "../src/test/boardFixture";
import { signInWithFreshBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

test("sends a chat message and shows the reply", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "Hi! How can I help?", board: null }),
    });
  });

  await page.getByLabel("Chat message").fill("Hello");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Hi! How can I help?")).toBeVisible();
});

test("AI board change refreshes the board without a reload", async ({ page }) => {
  const changedBoard = {
    ...boardFixture,
    cards: {
      ...boardFixture.cards,
      "card-1": { ...boardFixture.cards["card-1"], title: "Renamed by AI" },
    },
  };

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reply: "Renamed it.", board: changedBoard }),
    });
  });

  await page.getByLabel("Chat message").fill("Rename the first card");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Renamed it.")).toBeVisible();
  await expect(page.getByText("Renamed by AI")).toBeVisible();
  await expect(page.getByText("Align roadmap themes")).toHaveCount(0);
});

test("collapses and expands the chat sidebar", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse AI chat" }).click();
  await expect(page.getByLabel("Chat message")).toHaveCount(0);

  await page.getByRole("button", { name: "Open AI chat" }).click();
  await expect(page.getByLabel("Chat message")).toBeVisible();
});
