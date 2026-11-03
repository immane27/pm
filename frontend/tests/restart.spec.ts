import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { signInToBoard, signInWithFreshBoard, waitForSave } from "./helpers";

test("board survives a container restart", async ({ page }) => {
  await signInWithFreshBoard(page);
  const saved = waitForSave(page);
  await page.getByTestId("column-col-done").getByLabel("Column title").fill("Shipped");
  await saved;

  execSync("docker restart pm-app");
  await expect
    .poll(async () => (await page.request.get("/api/health").catch(() => null))?.status(), { timeout: 30_000 })
    .toBe(200);

  // The session key is regenerated on restart, so sign in again.
  await signInToBoard(page);
  await expect(page.getByTestId("column-col-done").getByLabel("Column title")).toHaveValue("Shipped");
});
