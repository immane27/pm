import { expect, test, type Page } from "@playwright/test";
import { expectBoard, signInWithFreshBoard, waitForSave } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signInWithFreshBoard(page);
});

const reload = async (page: Page) => {
  await page.reload();
  await expectBoard(page);
};

test("adds a card and it persists", async ({ page }) => {
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  const saved = waitForSave(page);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  await saved;

  await reload(page);
  await expect(page.locator('[data-testid^="column-"]').first().getByText("Playwright card")).toBeVisible();
});

test("edits a card and it persists", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: "Edit Align roadmap themes", exact: true }).click();
  await card.getByLabel("Edit card title").fill("Edited in e2e");
  await card.getByLabel("Edit card details").fill("New details");
  const saved = waitForSave(page);
  await card.getByRole("button", { name: /save/i }).click();
  await expect(card.getByText("Edited in e2e")).toBeVisible();
  await saved;

  await reload(page);
  await expect(page.getByTestId("card-card-1").getByText("Edited in e2e")).toBeVisible();
  await expect(page.getByTestId("card-card-1").getByText("New details")).toBeVisible();
});

test("deletes a card and it persists", async ({ page }) => {
  const saved = waitForSave(page);
  await page.getByRole("button", { name: "Delete Align roadmap themes", exact: true }).click();
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
  await saved;

  await reload(page);
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
});

test("renames a column and it persists", async ({ page }) => {
  const title = page.getByTestId("column-col-backlog").getByLabel("Column title");
  const saved = waitForSave(page);
  await title.fill("Ideas");
  await expect(title).toHaveValue("Ideas");
  await saved;

  await reload(page);
  await expect(page.getByTestId("column-col-backlog").getByLabel("Column title")).toHaveValue("Ideas");
});

test("moves a card between columns and it persists", async ({ page }) => {
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const saved = waitForSave(page);
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await saved;

  await reload(page);
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1")).toBeVisible();
});
