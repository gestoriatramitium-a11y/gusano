import { expect, test, type Page } from "@playwright/test";

import { createInitialState, type FoodKind } from "../../src/core/game";

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

function findReachableFoodSeed(kind: FoodKind): number {
  // El mapa persistente es más grande que el viewport; dejamos una docena
  // de pasos de margen para que el alimento siga siendo alcanzable sin
  // convertir esta búsqueda determinista en un caso frágil.
  for (let seed = 1; seed < 100_000; seed += 1) {
    const state = createInitialState(seed);
    const head = state.snake[0]!;
    if (
      state.food.kind === kind &&
      state.food.position.y === head.y &&
      state.food.position.x > head.x &&
      state.food.position.x <= head.x + 12
    ) {
      return seed;
    }
  }
  throw new Error(`No se encontró una semilla de prueba para ${kind}.`);
}

async function turnUp(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    const touchUp = page.getByRole("button", { name: "Mover arriba" });
    await expect(touchUp).toBeVisible();
    await touchUp.click();
  } else {
    await page.keyboard.press("ArrowUp");
  }
}

async function turn(
  page: Page,
  direction: "up" | "down" | "left" | "right",
  isMobile: boolean,
): Promise<void> {
  if (isMobile) {
    const labels = {
      up: "Mover arriba",
      down: "Mover abajo",
      left: "Mover a la izquierda",
      right: "Mover a la derecha",
    } as const;
    await page.getByRole("button", { name: labels[direction] }).click();
    return;
  }
  const keys = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  } as const;
  await page.keyboard.press(keys[direction]);
}

async function startGame(page: Page): Promise<void> {
  await page.getByTestId("start-button").click();
  const countrySelector = page.getByTestId("country-selector");
  if (await countrySelector.isVisible()) {
    await page.getByTestId("country-ES").click();
    await page.getByTestId("confirm-country").click();
  }
  const onboarding = page.getByTestId("onboarding");
  if (await onboarding.isVisible()) {
    await expect(onboarding).toContainText("Come memes");
    await page.getByTestId("onboarding-start").click();
  }
  await expect(page.getByTestId("start-screen")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const resetMarker = "meme-evolution-snake:e2e-reset";
    if (sessionStorage.getItem(resetMarker) === null) {
      localStorage.clear();
      sessionStorage.setItem(resetMarker, "done");
    }
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });
});

test("elige y conserva país antes de cargar el mundo local", async ({
  page,
}) => {
  const runtime = watchRuntime(page);
  await page.goto("/");

  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("country-selector")).toBeVisible();
  await expect(page.getByTestId("country-preview")).toBeVisible();
  await page.getByTestId("country-JP").click();
  await page.getByTestId("confirm-country").click();
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await page.getByTestId("onboarding-start").click();
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(1);
  await expect(page.getByTestId("quality-indicator")).toContainText("Caos");

  await page.getByTestId("home-button").click();
  await page.getByTestId("confirm-exit-button").click();
  await page.reload();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.getByTestId("quality-indicator")).toContainText("🇯🇵");
  await expect(page.getByText(/Japón/)).toBeVisible();

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
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
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("phaser-")),
    ),
  ).toBe(false);
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

  await startGame(page);
  await expect(page.getByTestId("hud")).toBeVisible();

  const isMobile = testInfo.project.name === "chromium-mobile";
  if (isMobile) {
    const touchTargets = await page.locator(".touch-button").all();
    for (const target of touchTargets) {
      const bounds = await target.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  }
  await turnUp(page, isMobile);

  const gameOver = page.getByTestId("game-over");
  await expect(gameOver).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("final-score")).toContainText("0");
  await expect(page.getByTestId("result-phrase")).toBeVisible();
  await page.getByTestId("share-button").click();
  await expect(page.getByTestId("share-result")).toBeVisible();
  await expect(page.locator("#share-text")).toHaveValue(
    /He conseguido \d+ puntos en Meme Evolution Snake.*Evolución: Mini Bicho Meme.*¿Puedes superar mi resultado\?/s,
  );

  await page.getByTestId("restart-button").click();
  await expect(gameOver).toBeHidden();
  await turnUp(page, isMobile);
  await expect(gameOver).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("restart-button").click();
  await expect(gameOver).toBeHidden();
  await page.reload();
  await expect(startScreen).toBeVisible();
  await expect(page.getByTestId("stats-games")).toHaveText("2");

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("muestra feedback inmediato y activa el turbo de Café infinito", async ({
  page,
}) => {
  const runtime = watchRuntime(page);
  await page.goto(`/?seed=${findReachableFoodSeed("infinite-coffee")}`);
  await startGame(page);

  await expect(page.locator(".effect-chip--speed-boost")).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByTestId("game-toast")).toContainText("CAFÉ INFINITO");
  await expect(page.getByTestId("evolution-meter")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("evoluciona, desbloquea progreso y lo conserva", async ({
  page,
}, testInfo) => {
  const runtime = watchRuntime(page);
  await page.goto(`/?seed=${findReachableFoodSeed("legendary-potato")}`);
  await startGame(page);

  await expect(page.getByTestId("evolution-celebration")).toContainText(
    "Gusano Legendario",
    { timeout: 5_000 },
  );
  await expect(page.locator(".hud__item--evolution .hud__value")).toHaveText(
    "Gusano Legendario",
  );
  await expect(page.getByTestId("evolution-celebration")).toBeHidden({
    timeout: 3_000,
  });

  await turnUp(page, testInfo.project.name === "chromium-mobile");
  await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("new-record")).toBeVisible();
  const finalScoreText = await page.getByTestId("final-score").textContent();
  const finalScore = Number(finalScoreText?.match(/\d+/)?.[0] ?? 0);
  expect(finalScore).toBeGreaterThanOrEqual(120);
  await expect(page.getByTestId("unlock-notifications")).toBeVisible();

  await page.getByTestId("restart-button").click();
  await page.reload();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await page.getByTestId("challenge-panel").locator("summary").click();
  await expect(page.locator('[data-mission-id="score-100"]')).toHaveClass(
    /mission-card--done/,
  );
  await expect(page.locator('[data-achievement-id="first-bite"]')).toHaveClass(
    /achievement--unlocked/,
  );

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("persiste calidad reducida y reducción de movimiento", async ({
  page,
}) => {
  const runtime = watchRuntime(page);
  await page.goto("/");

  await page.getByTestId("quality-select").selectOption("reduced");
  await page.getByTestId("reduce-motion-toggle").check();
  await expect(page.locator("main")).toHaveAttribute(
    "data-reduce-motion",
    "true",
  );
  await page.reload();
  await expect(page.getByTestId("quality-select")).toHaveValue("reduced");
  await expect(page.getByTestId("reduce-motion-toggle")).toBeChecked();

  await startGame(page);
  await expect(page.locator(".canvas-shell")).toHaveAttribute(
    "data-quality",
    "reduced",
  );

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("pausa, cancela y sale de una partida limpiando el motor", async ({
  page,
}, testInfo) => {
  const runtime = watchRuntime(page);
  await page.goto("/");
  await startGame(page);

  const homeButton = page.getByTestId("home-button");
  await expect(homeButton).toBeVisible();
  await homeButton.click();
  const confirmation = page.getByTestId("exit-confirmation");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("¿Salir de la partida?");

  const timeBeforePause = await page
    .locator(".hud__item")
    .filter({ hasText: "Tiempo" })
    .locator(".hud__value")
    .innerText();
  await page.waitForTimeout(450);
  await expect(
    page
      .locator(".hud__item")
      .filter({ hasText: "Tiempo" })
      .locator(".hud__value"),
  ).toHaveText(timeBeforePause);

  await page.getByTestId("continue-button").click();
  await expect(confirmation).toBeHidden();
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(1);

  await homeButton.click();
  await page.getByTestId("confirm-exit-button").click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(0);
  await expect(page.getByTestId("stats-games")).toHaveText("0");

  await startGame(page);
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(1);
  await expect(page.getByTestId("hud")).toBeVisible();

  await turnUp(page, testInfo.project.name === "chromium-mobile");
  await expect(page.getByTestId("game-over")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("result-home-button").click();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.getByTestId("exit-confirmation")).toBeHidden();
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(0);

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});

test("mantiene una cadencia estable con el mundo vivo", async ({
  page,
}, testInfo) => {
  const runtime = watchRuntime(page);
  await page.goto("/?seed=812");
  await startGame(page);
  const isMobile = testInfo.project.name === "chromium-mobile";
  await turn(page, "up", isMobile);

  const metricsPromise = page.evaluate(
    () =>
      new Promise<{ averageMs: number; p95Ms: number; maximumMs: number }>(
        (resolve) => {
          const browser = globalThis as unknown as {
            performance: { now(): number };
            requestAnimationFrame(callback: (now: number) => void): number;
          };
          const deltas: number[] = [];
          let previous = browser.performance.now();
          const sample = (now: number) => {
            deltas.push(now - previous);
            previous = now;
            if (deltas.length < 120) {
              browser.requestAnimationFrame(sample);
              return;
            }
            const sorted = [...deltas].sort((a, b) => a - b);
            resolve({
              averageMs:
                deltas.reduce((total, value) => total + value, 0) /
                deltas.length,
              p95Ms: sorted[Math.floor(sorted.length * 0.95)]!,
              maximumMs: sorted.at(-1)!,
            });
          };
          browser.requestAnimationFrame(sample);
        },
      ),
  );

  await page.waitForTimeout(450);
  await turn(page, "left", isMobile);
  await page.waitForTimeout(450);
  await turn(page, "down", isMobile);
  await page.waitForTimeout(450);
  await turn(page, "right", isMobile);
  const metrics = await metricsPromise;
  console.log(
    `${testInfo.project.name}: ${metrics.averageMs.toFixed(2)} ms media, ${metrics.p95Ms.toFixed(2)} ms p95, ${metrics.maximumMs.toFixed(2)} ms máximo`,
  );
  expect(metrics.averageMs).toBeLessThan(35);
  expect(metrics.p95Ms).toBeLessThan(50);
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(1);

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
  expect([...runtime.externalRequests]).toEqual([]);
});
