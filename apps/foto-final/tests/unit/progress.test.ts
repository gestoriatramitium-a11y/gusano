import { describe, expect, it } from "vitest";

import {
  PLAYER_PROGRESS_VERSION,
  completeRun,
  createInitialPlayerProgress,
  getEvolutionProgress,
  getPlayerStats,
  parsePlayerProgress,
  recordCompletedRun,
  serializePlayerProgress,
} from "../../src/core/progress";

const emptyRarities = { normal: 0, rare: 0, legendary: 0 } as const;

describe("persistencia versionada del progreso local", () => {
  it("crea el esquema v2 sin identificadores personales", () => {
    const progress = createInitialPlayerProgress();

    expect(progress).toMatchObject({
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 0,
      gamesPlayed: 0,
      totalFood: 0,
      highestEvolutionId: "mini-bicho",
      bestSurvivalMs: 0,
      metrics: {
        measuredGames: 0,
        totalScore: 0,
        totalDurationMs: 0,
        bestFoodInRun: 0,
        recordsBroken: 0,
        collectedByRarity: emptyRarities,
      },
      unlockedAchievementIds: [],
    });
    expect(Object.keys(progress)).not.toContain("userId");
  });

  it("migra un progreso v1 preservando sus mejores marcas", () => {
    const migrated = parsePlayerProgress(
      JSON.stringify({
        version: 1,
        bestScore: 420,
        gamesPlayed: 7,
        totalFood: 54,
        highestEvolutionId: "serpiente-influencer",
        bestSurvivalMs: 83_000,
      }),
    );

    expect(migrated).toMatchObject({
      version: 2,
      bestScore: 420,
      gamesPlayed: 7,
      totalFood: 54,
      highestEvolutionId: "serpiente-influencer",
      bestSurvivalMs: 83_000,
      metrics: { measuredGames: 0, totalScore: 0 },
    });
  });

  it("conserva el récord legado ante contenido roto o versión desconocida", () => {
    expect(parsePlayerProgress(null, "350").bestScore).toBe(350);
    expect(parsePlayerProgress("contenido roto", 90).bestScore).toBe(90);
    expect(
      parsePlayerProgress(JSON.stringify({ version: 99 }), 75).bestScore,
    ).toBe(75);
  });

  it("normaliza datos v2 corruptos y descarta logros desconocidos", () => {
    const parsed = parsePlayerProgress(
      JSON.stringify({
        version: 2,
        bestScore: -1,
        gamesPlayed: "muchas",
        totalFood: Number.NaN,
        highestEvolutionId: "usuario-123",
        bestSurvivalMs: Number.POSITIVE_INFINITY,
        metrics: {
          measuredGames: -5,
          totalScore: "muchísimo",
          collectedByRarity: { normal: -1, rare: 2, legendary: "x" },
        },
        missions: { "eat-10": { progress: 999, completed: false } },
        unlockedAchievementIds: ["first-bite", "identificador-inventado"],
      }),
    );

    expect(parsed).toMatchObject({
      bestScore: 0,
      gamesPlayed: 0,
      totalFood: 0,
      highestEvolutionId: "mini-bicho",
      bestSurvivalMs: 0,
      metrics: {
        measuredGames: 0,
        totalScore: 0,
        collectedByRarity: { normal: 0, rare: 2, legendary: 0 },
      },
      unlockedAchievementIds: ["first-bite"],
    });
    expect(parsed.missions["eat-10"].progress).toBe(0);
  });

  it("serializa y vuelve a leer todo el progreso", () => {
    const completed = completeRun(createInitialPlayerProgress(), {
      score: 150,
      eaten: 3,
      experience: 8,
      evolutionId: "gusano-legendario",
      elapsedMs: 12_500,
      collectedByRarity: { normal: 1, rare: 1, legendary: 1 },
    }).progress;

    expect(parsePlayerProgress(serializePlayerProgress(completed))).toEqual(
      completed,
    );
  });
});

describe("registro y métricas de sesiones", () => {
  it("registra puntuación, duración, rarezas y evoluciones alcanzadas", () => {
    const update = completeRun(createInitialPlayerProgress(), {
      score: 360,
      eaten: 12,
      experience: 24,
      evolutionId: "serpiente-influencer",
      elapsedMs: 91_000,
      collectedByRarity: { normal: 8, rare: 3, legendary: 1 },
    });

    expect(update.isNewRecord).toBe(true);
    expect(update.previousBestScore).toBe(0);
    expect(update.progress).toMatchObject({
      bestScore: 360,
      gamesPlayed: 1,
      totalFood: 12,
      highestEvolutionId: "serpiente-influencer",
      bestSurvivalMs: 91_000,
      metrics: {
        measuredGames: 1,
        totalScore: 360,
        totalDurationMs: 91_000,
        bestFoodInRun: 12,
        recordsBroken: 1,
        collectedByRarity: { normal: 8, rare: 3, legendary: 1 },
        evolutionReachedCounts: {
          "mini-bicho": 1,
          "gusano-legendario": 1,
          "serpiente-influencer": 1,
          "monstruo-meme": 0,
          "dios-del-caos": 0,
        },
      },
    });
  });

  it("calcula medias solo con sesiones medidas tras la migración", () => {
    const migrated = parsePlayerProgress(
      JSON.stringify({
        version: 1,
        bestScore: 500,
        gamesPlayed: 8,
        totalFood: 80,
        highestEvolutionId: "monstruo-meme",
        bestSurvivalMs: 100_000,
      }),
    );
    const next = completeRun(migrated, {
      score: 100,
      eaten: 2,
      experience: 4,
      evolutionId: "mini-bicho",
      elapsedMs: 20_000,
      collectedByRarity: { normal: 2, rare: 0, legendary: 0 },
    }).progress;

    expect(next.gamesPlayed).toBe(9);
    expect(getPlayerStats(next)).toMatchObject({
      averageScore: 100,
      averageDurationMs: 20_000,
      commonCollected: 2,
      rareCollected: 0,
      legendaryCollected: 0,
    });
  });

  it("mantiene récord y logros, acumula medias y no duplica desbloqueos", () => {
    const first = completeRun(createInitialPlayerProgress(), {
      score: 200,
      eaten: 4,
      experience: 8,
      evolutionId: "gusano-legendario",
      elapsedMs: 30_000,
      collectedByRarity: { normal: 3, rare: 1, legendary: 0 },
    });
    const second = completeRun(first.progress, {
      score: 100,
      eaten: 1,
      experience: 2,
      evolutionId: "mini-bicho",
      elapsedMs: 10_000,
      collectedByRarity: { normal: 1, rare: 0, legendary: 0 },
    });

    expect(second.progress.bestScore).toBe(200);
    expect(second.isNewRecord).toBe(false);
    expect(second.newlyUnlockedAchievementIds).toEqual([]);
    expect(getPlayerStats(second.progress)).toMatchObject({
      averageScore: 150,
      averageDurationMs: 20_000,
    });
    expect(new Set(second.progress.unlockedAchievementIds).size).toBe(
      second.progress.unlockedAchievementIds.length,
    );
  });

  it("conserva el helper compatible de actualización simple", () => {
    const progress = recordCompletedRun(createInitialPlayerProgress(), {
      score: 0,
      eaten: 0,
      experience: 0,
      evolutionId: "mini-bicho",
      elapsedMs: 1_000,
      collectedByRarity: emptyRarities,
    });
    expect(progress.gamesPlayed).toBe(1);
  });
});

describe("barra de evolución", () => {
  it.each([
    [0, "mini-bicho", "gusano-legendario", 0, 8, 0],
    [4, "mini-bicho", "gusano-legendario", 4, 8, 50],
    [8, "gusano-legendario", "serpiente-influencer", 0, 12, 0],
    [19, "gusano-legendario", "serpiente-influencer", 11, 12, 91],
    [38, "monstruo-meme", "dios-del-caos", 0, 24, 0],
    [61, "monstruo-meme", "dios-del-caos", 23, 24, 95],
  ] as const)(
    "calcula el tramo para %i XP",
    (
      experience,
      current,
      next,
      experienceInLevel,
      experienceRequired,
      percent,
    ) => {
      expect(getEvolutionProgress(experience)).toMatchObject({
        current: { id: current },
        next: { id: next },
        experienceInLevel,
        experienceRequired,
        percent,
        isMaxLevel: false,
      });
    },
  );

  it("queda al 100 % al alcanzar la evolución máxima", () => {
    expect(getEvolutionProgress(62)).toMatchObject({
      current: { id: "dios-del-caos" },
      next: null,
      experienceRequired: 0,
      percent: 100,
      isMaxLevel: true,
    });
  });
});
