import { expect, test, type Page } from "@playwright/test";

import { createInitialState } from "../../src/core/game";

function watchRuntime(page: Page) {
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

  return { consoleErrors, pageErrors, externalRequests };
}

function findReachableCoffeeSeed(): number {
  for (let seed = 1; seed < 50_000; seed += 1) {
    const state = createInitialState(seed);
    const head = state.snake[0]!;
    if (
      state.food.kind === "infinite-coffee" &&
      state.food.position.y === head.y &&
      state.food.position.x > head.x &&
      state.food.position.x <= head.x + 5
    ) {
      return seed;
    }
  }
  throw new Error("No se encontró una semilla de prueba para Café infinito.");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const resetMarker = "meme-evolution-snake:e2e-reset";
    if (sessionStorage.getItem(resetMarker) === null) {
      localStorage.clear();
      sessionStorage.setItem(resetMarker, "done");
    }
  });
});

test("completa, comparte y conserva una partida local", async ({
  page,
}, testInfo) => {
  const runtime = watchRuntime(page);
  await page.goto("/");

  const startScreen = page.getByTestId("start-screen");
  const startButton = page.getByTestId("start-button");
  await expect(startScreen).toBeVisible();
  await expect(startButton).toBeVisible();
  await expect(page.getByTestId("evolution-meter")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(page.getByTestId("stats-games")).toHaveText("0");
  expect(
    await page.evaluate("document.documentElement.scrollWidth <= innerWidth"),
  ).toBe(true);

  const startBounds = await startButton.boundingBox();
  const viewport = page.viewportSize();
  expect(startBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(startBounds!.y).toBeGreaterThanOrEqual(0);
  expect(startBounds!.y + startBounds!.height).toBeLessThanOrEqual(
    viewport!.height,
  );

  await startButton.click();
  await expect(page.getByTestId("hud")).toBeVisible();

  if (testInfo.project.name === "chromium-mobile") {
    const touchUp = page.getByRole("button", { name: "Mover arriba" });
    await expect(touchUp).toBeVisible();
    await touchUp.click();
  } else {
    await page.keyboard.press("ArrowUp");
  }

  const gameOver = page.getByTestId("game-over");
  await expect(gameOver).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("share-button").click();
  await expect(page.getByTestId("share-result")).toBeVisible();
  await expect(page.locator("#share-text")).toHaveValue(
    /He creado un .* nivel \d+ 😂/,
  );

  await page.getByTestId("restart-button").click();
  await expect(gameOver).toBeHidden();
  await page.reload();
  await expect(startScreen).toBeVisible();
  await expect(page.getByTestId("stats-games")).toHaveText("1");

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("muestra feedback inmediato y activa el turbo de Café infinito", async ({
  page,
}) => {
  const runtime = watchRuntime(page);
  await page.goto(`/?seed=${findReachableCoffeeSeed()}`);
  await page.getByTestId("start-button").click();

  await expect(page.locator(".effect-chip--speed-boost")).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId("game-toast")).toContainText("CAFÉ INFINITO");

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});
