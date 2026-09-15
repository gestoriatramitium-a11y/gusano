import { describe, expect, it } from "vitest";
import {
  EVOLUTIONS,
  FOOD_CATALOG,
  FOOD_KINDS,
  createInitialState,
  createSnapshot,
  getDifficultyLevel,
  getEvolution,
  getTickMs,
  queueDirection,
  restart,
  selectFoodKind,
  start,
  step,
  type FoodKind,
  type GameState,
} from "../../src/core/game";

function foodAhead(state: GameState, kind: FoodKind): GameState {
  const head = state.snake[0]!;
  return {
    ...state,
    status: "playing",
    food: { kind, position: { x: head.x + 1, y: head.y } },
  };
}

describe("catálogos de Meme Evolution Snake", () => {
  it("define los diez objetos meme y las cinco evoluciones", () => {
    expect(FOOD_KINDS).toHaveLength(10);
    expect(Object.keys(FOOD_CATALOG)).toHaveLength(10);
    expect(EVOLUTIONS.map((evolution) => evolution.name)).toEqual([
      "Mini Bicho Meme",
      "Gusano Legendario",
      "Serpiente Influencer",
      "Monstruo Meme",
      "Dios del Caos",
    ]);
  });

  it("clasifica la comida y configura los cuatro objetos especiales", () => {
    expect(FOOD_CATALOG["infinite-coffee"]).toMatchObject({
      name: "Café infinito",
      rarity: "rare",
      experience: 4,
      visualScale: 1.08,
      visualEffect: "pulse",
      effect: { kind: "speed-boost", durationMs: 6_000 },
    });
    expect(FOOD_CATALOG["cringe-energy"]).toMatchObject({
      name: "Energía cringe",
      rarity: "rare",
      experience: 4,
      visualEffect: "electric",
      effect: { kind: "double-points", durationMs: 7_000 },
    });
    expect(FOOD_CATALOG["legendary-potato"]).toMatchObject({
      name: "Patata dorada",
      rarity: "legendary",
      experience: 8,
      growth: 4,
    });
    expect(FOOD_CATALOG["super-meme"]).toMatchObject({
      rarity: "legendary",
      experience: 12,
      growth: 6,
      points: 300,
      visualEffect: "chaos",
    });
    expect(
      FOOD_KINDS.every((kind) => {
        const food = FOOD_CATALOG[kind];
        return food.weight > 0 && food.experience > 0 && food.visualScale > 0;
      }),
    ).toBe(true);
  });

  it("selecciona cada objeto dentro de su intervalo ponderado", () => {
    const totalWeight = FOOD_KINDS.reduce(
      (total, kind) => total + FOOD_CATALOG[kind].weight,
      0,
    );
    let accumulatedWeight = 0;

    for (const kind of FOOD_KINDS) {
      const midpoint =
        (accumulatedWeight + FOOD_CATALOG[kind].weight / 2) / totalWeight;
      expect(selectFoodKind(midpoint)).toBe(kind);
      accumulatedWeight += FOOD_CATALOG[kind].weight;
    }
    expect(() => selectFoodKind(1)).toThrow(RangeError);
  });

  it("mantiene umbrales y velocidades ordenados", () => {
    expect(EVOLUTIONS.map((evolution) => evolution.minExperience)).toEqual([
      0, 8, 20, 38, 62,
    ]);
    expect(EVOLUTIONS.map((evolution) => evolution.tickMs)).toEqual([
      150, 140, 128, 116, 104,
    ]);
  });
});

describe("estado y aleatoriedad determinista", () => {
  it("crea el mismo estado completo para la misma semilla", () => {
    expect(createInitialState(123_456)).toEqual(createInitialState(123_456));
  });

  it("mantiene cada objeto generado dentro de una casilla libre", () => {
    for (let seed = 1; seed <= 64; seed += 1) {
      const state = createInitialState(seed, { width: 12, height: 8 });
      expect(state.food.position.x).toBeGreaterThanOrEqual(0);
      expect(state.food.position.x).toBeLessThan(state.width);
      expect(state.food.position.y).toBeGreaterThanOrEqual(0);
      expect(state.food.position.y).toBeLessThan(state.height);
      expect(state.snake).not.toContainEqual(state.food.position);
    }
  });

  it("valida las dimensiones mínimas del tablero", () => {
    expect(() => createInitialState(1, { width: 7 })).toThrow(RangeError);
    expect(() => createInitialState(1, { height: 5 })).toThrow(RangeError);
  });
});

describe("movimiento y controles", () => {
  it("empieza en Mini Bicho Meme y arranca con un evento serializable", () => {
    const initial = createInitialState(7);
    const result = start(initial);

    expect(initial.status).toBe("ready");
    expect(result.state.status).toBe("playing");
    expect(result.events).toEqual([{ type: "started", tick: 0 }]);
    expect(() => JSON.stringify(result.events)).not.toThrow();
  });

  it("avanza una casilla por tick y step arranca un estado ready", () => {
    const initial = createInitialState(7);
    const head = initial.snake[0]!;
    const result = step(initial);

    expect(result.state.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(result.state.ticks).toBe(1);
    expect(result.state.elapsedMs).toBe(150);
    expect(result.events.map((event) => event.type)).toContain("started");
    expect(result.events.map((event) => event.type)).toContain("moved");
  });

  it("acepta giros perpendiculares y bloquea el giro inverso", () => {
    const initial = createInitialState(7);
    const reversed = queueDirection(initial, "left");
    expect(reversed).toBe(initial);

    const queued = queueDirection(initial, "up");
    expect(queued.queuedDirection).toBe("up");
    const result = step(queued);
    expect(result.state.direction).toBe("up");
    expect(result.events).toContainEqual({
      type: "direction-changed",
      tick: 1,
      direction: "up",
    });
  });

  it("conserva hasta dos giros rápidos y los consume en orden", () => {
    const initial = createInitialState(8);
    const up = queueDirection(initial, "up");
    const left = queueDirection(up, "left");
    const ignoredThird = queueDirection(left, "down");

    expect(left.directionQueue).toEqual(["up", "left"]);
    expect(left.queuedDirection).toBe("up");
    expect(ignoredThird).toBe(left);

    const first = step(left).state;
    expect(first.direction).toBe("up");
    expect(first.directionQueue).toEqual(["left"]);
    expect(first.queuedDirection).toBe("left");

    const second = step(first).state;
    expect(second.direction).toBe("left");
    expect(second.directionQueue).toEqual([]);
  });

  it("rechaza un giro opuesto respecto a la última entrada en cola", () => {
    const initial = createInitialState(9);
    const up = queueDirection(initial, "up");

    expect(queueDirection(up, "down")).toBe(up);
  });
});

describe("comida, crecimiento y evolución", () => {
  it("suma puntos, crece y genera un nuevo objeto al comer", () => {
    const initial = foodAhead(createInitialState(12), "flying-pizza");
    const result = step(initial);

    expect(result.state.score).toBe(FOOD_CATALOG["flying-pizza"].points);
    expect(result.state.eaten).toBe(1);
    expect(result.state.experience).toBe(2);
    expect(result.state.collectedByRarity).toEqual({
      normal: 1,
      rare: 0,
      legendary: 0,
    });
    expect(result.state.snake).toHaveLength(initial.snake.length + 1);
    expect(result.state.snake).not.toContainEqual(result.state.food.position);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "ate",
        kind: "flying-pizza",
        points: 15,
        experience: 2,
        growth: 1,
      }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "food-spawned" }),
    );
  });

  it("aplica todo el crecimiento de una comida legendaria en varios ticks", () => {
    const initial = foodAhead(createInitialState(15), "legendary-potato");
    const first = step(initial).state;
    const second = step(first).state;

    expect(first.growthPending).toBe(3);
    expect(first.collectedByRarity.legendary).toBe(1);
    expect(first.snake).toHaveLength(initial.snake.length + 1);
    expect(second.growthPending).toBe(2);
    expect(second.snake).toHaveLength(initial.snake.length + 2);
  });

  it("activa Energía cringe y duplica solo las comidas posteriores", () => {
    const initial = foodAhead(createInitialState(16), "cringe-energy");
    const first = step(initial);
    const firstEffect = first.state.activeEffects[0];

    expect(first.state.score).toBe(25);
    expect(firstEffect).toEqual({
      kind: "double-points",
      expiresAtMs: first.state.elapsedMs + 7_000,
    });
    expect(first.events).toContainEqual({
      type: "effect-started",
      tick: 1,
      effect: "double-points",
      expiresAtMs: firstEffect?.expiresAtMs,
      refreshed: false,
    });

    const second = step(foodAhead(first.state, "flying-pizza"));
    expect(second.state.score).toBe(55);
    expect(second.events).toContainEqual(
      expect.objectContaining({
        type: "ate",
        kind: "flying-pizza",
        basePoints: 15,
        multiplier: 2,
        points: 30,
      }),
    );
  });

  it("refresca un efecto repetido sin apilar multiplicadores", () => {
    const first = step(
      foodAhead(createInitialState(17), "cringe-energy"),
    ).state;
    const previousExpiry = first.activeEffects[0]?.expiresAtMs ?? 0;
    const second = step(foodAhead(first, "cringe-energy"));

    expect(second.state.activeEffects).toHaveLength(1);
    expect(second.state.activeEffects[0]?.expiresAtMs).toBeGreaterThan(
      previousExpiry,
    );
    expect(second.events).toContainEqual(
      expect.objectContaining({
        type: "effect-started",
        effect: "double-points",
        refreshed: true,
      }),
    );
  });

  it("elimina y anuncia los efectos al alcanzar su vencimiento", () => {
    const initial: GameState = {
      ...createInitialState(18),
      status: "playing",
      activeEffects: [{ kind: "double-points", expiresAtMs: 1 }],
    };
    const result = step(initial);

    expect(result.state.activeEffects).toEqual([]);
    expect(result.events).toContainEqual({
      type: "effect-expired",
      tick: 1,
      effect: "double-points",
    });
  });

  it.each([
    [0, "mini-bicho", 150],
    [8, "gusano-legendario", 140],
    [20, "serpiente-influencer", 128],
    [38, "monstruo-meme", 116],
    [62, "dios-del-caos", 104],
  ] as const)(
    "selecciona la evolución para %i XP",
    (experience, id, tickMs) => {
      const state = { ...createInitialState(21), experience };
      expect(getEvolution(state).id).toBe(id);
      expect(getTickMs(state)).toBe(tickMs);
    },
  );

  it("usa la experiencia propia de la comida y emite evolved al cruzar un umbral", () => {
    const before = foodAhead(
      {
        ...createInitialState(20),
        evolutionId: "mini-bicho",
      },
      "legendary-potato",
    );
    const result = step(before);

    expect(result.state.evolutionId).toBe("gusano-legendario");
    expect(result.state.eaten).toBe(1);
    expect(result.state.experience).toBe(8);
    expect(result.events).toContainEqual({
      type: "evolved",
      tick: 1,
      from: "mini-bicho",
      to: "gusano-legendario",
    });
  });
});

describe("dificultad y velocidad temporal", () => {
  it("acelera progresivamente cada quince segundos y limita la dificultad", () => {
    const initial = createInitialState(22);

    expect(getDifficultyLevel(initial)).toBe(0);
    expect(getTickMs(initial)).toBe(150);
    expect(getTickMs({ ...initial, elapsedMs: 15_000 })).toBe(147);
    expect(getDifficultyLevel({ ...initial, elapsedMs: 999_999 })).toBe(12);
    expect(getTickMs({ ...initial, elapsedMs: 999_999, experience: 62 })).toBe(
      78,
    );
  });

  it("Café infinito aplica turbo temporal con un límite seguro", () => {
    const initial = foodAhead(createInitialState(23), "infinite-coffee");
    const collected = step(initial);
    const speedEffect = collected.state.activeEffects.find(
      (effect) => effect.kind === "speed-boost",
    );

    expect(speedEffect).toEqual({
      kind: "speed-boost",
      expiresAtMs: collected.state.elapsedMs + 6_000,
    });
    expect(getTickMs(collected.state)).toBe(113);
    expect(
      getTickMs({
        ...collected.state,
        experience: 62,
        elapsedMs: 999_999,
        activeEffects: [{ kind: "speed-boost", expiresAtMs: 1_000_000 }],
      }),
    ).toBeGreaterThanOrEqual(58);
    expect(
      getTickMs({
        ...collected.state,
        elapsedMs: speedEffect?.expiresAtMs ?? 0,
      }),
    ).toBeGreaterThan(113);
  });
});

describe("colisiones, derrota y reinicio", () => {
  it("termina la partida al chocar con una pared", () => {
    const initial: GameState = {
      ...createInitialState(31, { width: 8, height: 6 }),
      status: "playing",
      snake: [
        { x: 7, y: 3 },
        { x: 6, y: 3 },
        { x: 5, y: 3 },
      ],
      direction: "right",
      queuedDirection: "right",
    };
    const result = step(initial);

    expect(result.state.status).toBe("game-over");
    expect(result.state.elapsedMs).toBe(150);
    expect(result.events).toContainEqual({
      type: "collision",
      tick: 1,
      collision: "wall",
      at: { x: 8, y: 3 },
    });
    expect(result.events.at(-1)).toEqual(
      expect.objectContaining({ type: "game-over", score: 0 }),
    );
  });

  it("termina la partida al chocar con el propio cuerpo", () => {
    const initial: GameState = {
      ...createInitialState(32, { width: 8, height: 6 }),
      status: "playing",
      snake: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
      ],
      direction: "down",
      queuedDirection: "down",
      food: { kind: "sad-sock", position: { x: 6, y: 4 } },
    };
    const result = step(initial);

    expect(result.state.status).toBe("game-over");
    expect(result.events).toContainEqual({
      type: "collision",
      tick: 1,
      collision: "self",
      at: { x: 2, y: 3 },
    });
  });

  it("permite entrar en la casilla que la cola abandona", () => {
    const initial: GameState = {
      ...createInitialState(33, { width: 8, height: 6 }),
      status: "playing",
      snake: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
      ],
      direction: "down",
      queuedDirection: "down",
      food: { kind: "sad-sock", position: { x: 6, y: 4 } },
    };
    const result = step(initial);

    expect(result.state.status).toBe("playing");
    expect(result.state.snake[0]).toEqual({ x: 2, y: 3 });
  });

  it("reinicia puntuación, longitud y evolución con la misma semilla", () => {
    const played: GameState = {
      ...createInitialState(99),
      status: "game-over",
      score: 345,
      eaten: 17,
      experience: 40,
      evolutionId: "monstruo-meme",
      ticks: 80,
      elapsedMs: 9_999,
    };

    expect(restart(played)).toEqual(createInitialState(99));
  });
});

describe("snapshots", () => {
  it("crea una copia serializable sin compartir posiciones mutables", () => {
    const state: GameState = {
      ...queueDirection(createInitialState(55), "up"),
      activeEffects: [{ kind: "double-points", expiresAtMs: 7_000 }],
      elapsedMs: 15_000,
    };
    const snapshot = createSnapshot(state);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.snake).not.toBe(state.snake);
    expect(snapshot.snake[0]).not.toBe(state.snake[0]);
    expect(snapshot.food.position).not.toBe(state.food.position);
    expect(snapshot.directionQueue).toEqual(["up"]);
    expect(snapshot.directionQueue).not.toBe(state.directionQueue);
    expect(snapshot.activeEffects).toEqual(state.activeEffects);
    expect(snapshot.activeEffects).not.toBe(state.activeEffects);
    expect(snapshot.activeEffects[0]).not.toBe(state.activeEffects[0]);
    expect(snapshot.collectedByRarity).toEqual(state.collectedByRarity);
    expect(snapshot.collectedByRarity).not.toBe(state.collectedByRarity);
    expect(snapshot.experience).toBe(0);
    expect(snapshot.difficultyLevel).toBe(1);
    expect(snapshot.tickMs).toBe(147);
    expect(snapshot.evolutionName).toBe("Mini Bicho Meme");
  });
});
