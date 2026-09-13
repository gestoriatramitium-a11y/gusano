import { expect, test } from "@playwright/test";

test("permite completar y reiniciar una partida", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const externalRequests = new Set<string>();

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4173")
      externalRequests.add(url.origin);
  });

  await page.goto("/");

  await expect(page.getByTestId("start-screen")).toBeVisible();
  await page.getByTestId("start-button").click();

  await expect(page.getByTestId("hud")).toBeVisible();
  if (testInfo.project.name === "chromium-mobile") {
    const touchUp = page.getByRole("button", { name: "Mover arriba" });
    await expect(touchUp).toBeVisible();
    await touchUp.click();
  } else {
    await page.keyboard.press("ArrowUp");
  }

  await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("restart-button").click();

  await expect(page.getByTestId("hud")).toBeVisible();
  await expect(page.getByTestId("game-over")).toBeHidden();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect([...externalRequests]).toEqual([]);
});
