import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_CATALOG,
  MISSION_CATALOG,
  completedMissionIds,
  evaluateMissions,
  findNewAchievements,
  mergeAchievementIds,
  type ChallengeMetrics,
} from "../../src/core/challenges";

const emptyMetrics: ChallengeMetrics = {
  gamesPlayed: 0,
  totalFood: 0,
  bestFoodInRun: 0,
  bestScore: 0,
  highestEvolutionRank: 0,
  rareCollected: 0,
  legendaryCollected: 0,
  recordsBroken: 0,
};

describe("catálogos de retención", () => {
  it("define ocho misiones y ocho logros configurables", () => {
    expect(MISSION_CATALOG).toHaveLength(8);
    expect(ACHIEVEMENT_CATALOG).toHaveLength(8);
    expect(
      MISSION_CATALOG.every(
        (mission) =>
          mission.id &&
          mission.title &&
          mission.description &&
          mission.condition &&
          mission.target > 0,
      ),
    ).toBe(true);
  });
});

describe("progreso de misiones", () => {
  it("calcula progreso y completa condiciones desde métricas compartidas", () => {
    const missions = evaluateMissions({
      ...emptyMetrics,
      gamesPlayed: 3,
      bestFoodInRun: 7,
      bestScore: 140,
      highestEvolutionRank: 1,
      rareCollected: 2,
    });

    expect(missions["eat-10"]).toEqual({ progress: 7, completed: false });
    expect(missions["score-100"]).toEqual({ progress: 100, completed: true });
    expect(missions["reach-worm"].completed).toBe(true);
    expect(missions["collect-rare"].completed).toBe(true);
    expect(missions["play-3"].completed).toBe(true);
    expect(completedMissionIds(missions)).toEqual([
      "score-100",
      "reach-worm",
      "collect-rare",
      "play-3",
    ]);
  });

  it("mantiene una misión completada una sola vez aunque cambie la métrica", () => {
    const completed = evaluateMissions({
      ...emptyMetrics,
      bestFoodInRun: 10,
    });
    const persisted = evaluateMissions(emptyMetrics, completed);

    expect(persisted["eat-10"]).toEqual({ progress: 0, completed: true });
  });

  it("normaliza métricas negativas o no finitas antes de evaluarlas", () => {
    const missions = evaluateMissions({
      ...emptyMetrics,
      bestFoodInRun: Number.NaN,
      bestScore: -50,
    });

    expect(missions["eat-10"]).toEqual({ progress: 0, completed: false });
    expect(missions["score-100"]).toEqual({ progress: 0, completed: false });
  });
});

describe("desbloqueo de logros", () => {
  it("desbloquea todos los logros cuyas condiciones se cumplen", () => {
    const ids = findNewAchievements(
      {
        ...emptyMetrics,
        gamesPlayed: 10,
        totalFood: 30,
        highestEvolutionRank: 4,
        legendaryCollected: 1,
        recordsBroken: 2,
      },
      [],
    );

    expect(ids).toEqual(
      ACHIEVEMENT_CATALOG.map((achievement) => achievement.id),
    );
  });

  it("no vuelve a anunciar logros ya desbloqueados y conserva el orden", () => {
    const metrics = {
      ...emptyMetrics,
      totalFood: 1,
      highestEvolutionRank: 1,
    };
    const first = findNewAchievements(metrics, []);
    const stored = mergeAchievementIds([], first);
    const repeated = findNewAchievements(metrics, stored);

    expect(first).toEqual(["first-bite", "first-evolution"]);
    expect(repeated).toEqual([]);
    expect(stored).toEqual(["first-bite", "first-evolution"]);
  });
});
