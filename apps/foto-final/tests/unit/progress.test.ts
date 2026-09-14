import { describe, expect, it } from "vitest";

import {
  PLAYER_PROGRESS_VERSION,
  createInitialPlayerProgress,
  createShareText,
  getEvolutionProgress,
  getProgressObjectives,
  parsePlayerProgress,
  recordCompletedRun,
  serializePlayerProgress,
  type PlayerProgress,
} from "../../src/core/progress";

describe("persistencia pura del progreso local", () => {
  it("crea un esquema versionado sin identificadores", () => {
    expect(createInitialPlayerProgress()).toEqual({
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 0,
      gamesPlayed: 0,
      totalFood: 0,
      highestEvolutionId: "mini-bicho",
      bestSurvivalMs: 0,
    });
    expect(Object.keys(createInitialPlayerProgress())).not.toContain("id");
  });

  it("conserva el récord anterior al migrar desde la clave del MVP", () => {
    expect(parsePlayerProgress(null, "420").bestScore).toBe(420);
    expect(parsePlayerProgress("contenido roto", 90).bestScore).toBe(90);
    expect(
      parsePlayerProgress(JSON.stringify({ version: 99 }), 75).bestScore,
    ).toBe(75);
  });

  it("recupera cada campo corrupto sin aceptar valores negativos o IDs", () => {
    const parsed = parsePlayerProgress(
      JSON.stringify({
        version: PLAYER_PROGRESS_VERSION,
        bestScore: -12,
        gamesPlayed: "muchas",
        totalFood: Number.NaN,
        highestEvolutionId: "usuario-123",
        bestSurvivalMs: Number.POSITIVE_INFINITY,
        persistentUserId: "no-debe-conservarse",
      }),
      35,
    );

    expect(parsed).toEqual({
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 0,
      gamesPlayed: 0,
      totalFood: 0,
      highestEvolutionId: "mini-bicho",
      bestSurvivalMs: 0,
    });
    expect(parsed).not.toHaveProperty("persistentUserId");
  });

  it("serializa y vuelve a leer un progreso válido", () => {
    const progress: PlayerProgress = {
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 530,
      gamesPlayed: 7,
      totalFood: 84,
      highestEvolutionId: "monstruo-meme",
      bestSurvivalMs: 201_500,
    };

    expect(parsePlayerProgress(serializePlayerProgress(progress))).toEqual(
      progress,
    );
  });
});

describe("registro de una partida terminada", () => {
  it("acumula partida y comida, manteniendo los mejores resultados", () => {
    const previous: PlayerProgress = {
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 600,
      gamesPlayed: 4,
      totalFood: 70,
      highestEvolutionId: "serpiente-influencer",
      bestSurvivalMs: 80_000,
    };

    const next = recordCompletedRun(previous, {
      score: 450,
      eaten: 18,
      evolutionId: "monstruo-meme",
      elapsedMs: 95_250,
    });

    expect(next).toEqual({
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 600,
      gamesPlayed: 5,
      totalFood: 88,
      highestEvolutionId: "monstruo-meme",
      bestSurvivalMs: 95_250,
    });
    expect(previous.gamesPlayed).toBe(4);
  });

  it("actualiza el récord pero nunca rebaja la evolución o el tiempo máximos", () => {
    const previous: PlayerProgress = {
      version: PLAYER_PROGRESS_VERSION,
      bestScore: 200,
      gamesPlayed: 1,
      totalFood: 30,
      highestEvolutionId: "dios-del-caos",
      bestSurvivalMs: 300_000,
    };

    const next = recordCompletedRun(previous, {
      score: 900,
      eaten: 2,
      evolutionId: "mini-bicho",
      elapsedMs: 12_000,
    });

    expect(next.bestScore).toBe(900);
    expect(next.highestEvolutionId).toBe("dios-del-caos");
    expect(next.bestSurvivalMs).toBe(300_000);
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

describe("objetivos locales", () => {
  it("calcula progreso parcial con límites estables", () => {
    const objectives = getProgressObjectives({
      ...createInitialPlayerProgress(),
      totalFood: 43,
      highestEvolutionId: "serpiente-influencer",
      bestSurvivalMs: 90_000,
    });

    expect(
      objectives.map(({ id, current, target, percent, completed }) => ({
        id,
        current,
        target,
        percent,
        completed,
      })),
    ).toEqual([
      {
        id: "reach-monstruo-meme",
        current: 2,
        target: 3,
        percent: 66,
        completed: false,
      },
      {
        id: "collect-100-memes",
        current: 43,
        target: 100,
        percent: 43,
        completed: false,
      },
      {
        id: "survive-5-minutes",
        current: 90_000,
        target: 300_000,
        percent: 30,
        completed: false,
      },
    ]);
  });

  it("marca y limita los tres objetivos completados", () => {
    const objectives = getProgressObjectives({
      ...createInitialPlayerProgress(),
      totalFood: 180,
      highestEvolutionId: "dios-del-caos",
      bestSurvivalMs: 800_000,
    });

    expect(objectives.every((entry) => entry.completed)).toBe(true);
    expect(objectives.every((entry) => entry.percent === 100)).toBe(true);
    expect(objectives.map((entry) => entry.current)).toEqual([3, 100, 300_000]);
  });
});

describe("texto compartible local", () => {
  it("genera un resultado estable sin URL ni identificadores", () => {
    const text = createShareText({
      score: 1_275,
      eaten: 18,
      evolutionId: "monstruo-meme",
      elapsedMs: 125_999,
    });

    expect(text).toBe(
      "He creado un Monstruo Meme nivel 18 😂\n" +
        "1275 puntos · 02:05\n" +
        "¿Puedes superarme?",
    );
    expect(text).not.toMatch(/https?:|usuario|id=/i);
  });
});
