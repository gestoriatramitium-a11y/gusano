import { describe, expect, it } from "vitest";
import {
  EVOLUTIONS,
  FOOD_CATALOG,
  FOOD_KINDS,
  createInitialState,
  createSnapshot,
  getEvolution,
  getTickMs,
  queueDirection,
  restart,
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
  it("define los ocho objetos meme y las cinco evoluciones", () => {
    expect(FOOD_KINDS).toHaveLength(8);
    expect(Object.keys(FOOD_CATALOG)).toHaveLength(8);
    expect(EVOLUTIONS.map((evolution) => evolution.name)).toEqual([
      "Mini Bicho Meme",
      "Gusano Legendario",
      "Serpiente Influencer",
      "Monstruo Meme",
      "Dios del Caos",
    ]);
  });

  it("mantiene umbrales y velocidades ordenados", () => {
    expect(EVOLUTIONS.map((evolution) => evolution.minEaten)).toEqual([
      0, 4, 9, 16, 25,
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
});

describe("comida, crecimiento y evolución", () => {
  it("suma puntos, crece y genera un nuevo objeto al comer", () => {
    const initial = foodAhead(createInitialState(12), "flying-pizza");
    const result = step(initial);

    expect(result.state.score).toBe(FOOD_CATALOG["flying-pizza"].points);
    expect(result.state.eaten).toBe(1);
    expect(result.state.snake).toHaveLength(initial.snake.length + 1);
    expect(result.state.snake).not.toContainEqual(result.state.food.position);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "ate",
        kind: "flying-pizza",
        points: 15,
        growth: 1,
      }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "food-spawned" }),
    );
  });

  it("aplica el crecimiento doble de Energía cringe durante dos ticks", () => {
    const initial = foodAhead(createInitialState(15), "cringe-energy");
    const first = step(initial).state;
    const second = step(first).state;

    expect(first.growthPending).toBe(1);
    expect(first.snake).toHaveLength(initial.snake.length + 1);
    expect(second.growthPending).toBe(0);
    expect(second.snake).toHaveLength(initial.snake.length + 2);
  });

  it.each([
    [0, "mini-bicho", 150],
    [4, "gusano-legendario", 140],
    [9, "serpiente-influencer", 128],
    [16, "monstruo-meme", 116],
    [25, "dios-del-caos", 104],
  ] as const)(
    "selecciona la evolución para %i objetos",
    (eaten, id, tickMs) => {
      const state = { ...createInitialState(21), eaten };
      expect(getEvolution(state).id).toBe(id);
      expect(getTickMs(state)).toBe(tickMs);
    },
  );

  it("emite evolved al cruzar un umbral", () => {
    const before = foodAhead(
      {
        ...createInitialState(20),
        eaten: 3,
        evolutionId: "mini-bicho",
      },
      "legendary-potato",
    );
    const result = step(before);

    expect(result.state.evolutionId).toBe("gusano-legendario");
    expect(result.events).toContainEqual({
      type: "evolved",
      tick: 1,
      from: "mini-bicho",
      to: "gusano-legendario",
    });
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
      evolutionId: "monstruo-meme",
      ticks: 80,
      elapsedMs: 9_999,
    };

    expect(restart(played)).toEqual(createInitialState(99));
  });
});

describe("snapshots", () => {
  it("crea una copia serializable sin compartir posiciones mutables", () => {
    const state = createInitialState(55);
    const snapshot = createSnapshot(state);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.snake).not.toBe(state.snake);
    expect(snapshot.snake[0]).not.toBe(state.snake[0]);
    expect(snapshot.food.position).not.toBe(state.food.position);
    expect(snapshot.evolutionName).toBe("Mini Bicho Meme");
  });
});
