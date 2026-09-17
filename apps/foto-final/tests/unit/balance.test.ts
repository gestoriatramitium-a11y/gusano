import { describe, expect, it } from "vitest";

import {
  GAME_BALANCE,
  RARITY_PROBABILITIES,
  TOTAL_FOOD_WEIGHT,
  estimateFoodNeededForEvolution,
  getBalanceSummary,
} from "../../src/core/balance";

describe("configuración central de balance", () => {
  it("mantiene pesos, recompensas y dificultad en rangos válidos", () => {
    expect(TOTAL_FOOD_WEIGHT).toBe(108);
    expect(Object.values(GAME_BALANCE.food)).toHaveLength(10);
    expect(
      Object.values(GAME_BALANCE.food).every(
        (food) =>
          food.weight > 0 &&
          food.points > 0 &&
          food.experience > 0 &&
          food.growth > 0,
      ),
    ).toBe(true);
    expect(GAME_BALANCE.difficulty.minimumBoostedTickMs).toBeGreaterThanOrEqual(
      70,
    );
  });

  it("distribuye rarezas sin trivializar los objetos legendarios", () => {
    expect(RARITY_PROBABILITIES.normal).toBeCloseTo(0.7778, 3);
    expect(RARITY_PROBABILITIES.rare).toBeCloseTo(0.1944, 3);
    expect(RARITY_PROBABILITIES.legendary).toBeCloseTo(0.0278, 3);
    expect(
      RARITY_PROBABILITIES.normal +
        RARITY_PROBABILITIES.rare +
        RARITY_PROBABILITIES.legendary,
    ).toBeCloseTo(1, 8);
  });

  it("expone estimaciones útiles para playtesting", () => {
    const summary = getBalanceSummary();

    expect(summary.expectedExperiencePerFood).toBeCloseTo(2.574, 3);
    expect(summary.expectedGrowthPerFood).toBeCloseTo(1.213, 3);
    expect(estimateFoodNeededForEvolution(8)).toBe(4);
    expect(estimateFoodNeededForEvolution(22)).toBe(9);
    expect(estimateFoodNeededForEvolution(42)).toBe(17);
    expect(estimateFoodNeededForEvolution(70)).toBe(28);
    expect(estimateFoodNeededForEvolution(Number.NaN)).toBe(0);
  });
});
