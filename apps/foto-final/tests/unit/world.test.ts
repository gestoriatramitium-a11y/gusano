import { describe, expect, it } from "vitest";

import { COUNTRIES, getCountry, isCountryCode } from "../../src/core/countries";
import { createInitialState } from "../../src/core/game";
import {
  createWorldState,
  botEvolutionName,
  getBiomeAt,
  occupiedByWorld,
  stepWorld,
  worldEventName,
  type WorldDrop,
  type WorldState,
} from "../../src/core/world";
import {
  BIOMES,
  BOT_PERSONALITIES,
  BOT_TIERS,
  WORLD_CONFIG,
  WORLD_EVENTS,
} from "../../src/core/worldConfig";

const player = createInitialState(5);

function createWorld(seed = 23, quality: "normal" | "reduced" = "normal") {
  return createWorldState(seed, {
    width: player.width,
    height: player.height,
    quality,
    playerCountryCode: "ES",
    playerSnake: player.snake,
  });
}

describe("países e identidad local", () => {
  it("incluye doce países válidos y una paleta por identidad", () => {
    expect(COUNTRIES).toHaveLength(12);
    expect(new Set(COUNTRIES.map((country) => country.code)).size).toBe(12);
    for (const country of COUNTRIES) {
      expect(isCountryCode(country.code)).toBe(true);
      expect(getCountry(country.code)).toBe(country);
      expect(country.flag).not.toBe("");
      expect(country.primary).toBeGreaterThanOrEqual(0);
      expect(country.accent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mundo determinista", () => {
  it("crea los mismos bots y decoraciones con la misma semilla", () => {
    expect(createWorld(901)).toEqual(createWorld(901));
  });

  it("normaliza semillas inválidas y puede iniciar un mundo en el borde", () => {
    const world = createWorldState(Number.NaN, {
      width: 24,
      height: 16,
      quality: "reduced",
      playerCountryCode: "ES",
      playerSnake: [{ x: 0, y: 0 }],
    });
    expect(world.seed).toBe(1);
    expect(world.drops.length).toBeGreaterThan(0);
  });

  it("adapta bots y decoración a la calidad gráfica", () => {
    const normal = createWorld(11, "normal");
    const reduced = createWorld(11, "reduced");
    expect(normal.bots).toHaveLength(WORLD_CONFIG.bots.normal);
    expect(normal.decorations).toHaveLength(WORLD_CONFIG.decorations.normal);
    expect(reduced.bots).toHaveLength(WORLD_CONFIG.bots.reduced);
    expect(reduced.decorations).toHaveLength(WORLD_CONFIG.decorations.reduced);
  });

  it("configura tamaños, personalidades y países de todos los bots", () => {
    const world = createWorld();
    for (const bot of world.bots) {
      expect(BOT_TIERS[bot.tier]).toBeDefined();
      expect(BOT_PERSONALITIES[bot.personality]).toBeDefined();
      expect(isCountryCode(bot.countryCode)).toBe(true);
      expect(bot.name).not.toBe("");
      expect(bot.snake.length).toBeGreaterThan(0);
    }
  });

  it("mantiene bots y segmentos dentro del mapa durante giros continuos", () => {
    let world = createWorld(812);
    for (let tick = 0; tick < 100; tick += 1) {
      world = stepWorld(world, {
        elapsedMs: tick * 100,
        playerSnake: player.snake,
        food: player.food,
      }).state;
    }
    for (const position of occupiedByWorld(world)) {
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThan(world.width);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThan(world.height);
    }
  });

  it("asigna los cuatro cuadrantes a sus biomas", () => {
    const world = createWorld();
    expect(getBiomeAt({ x: 0, y: 0 }, world.width, world.height).id).toBe(
      "meme-meadow",
    );
    expect(
      getBiomeAt({ x: world.width - 1, y: 0 }, world.width, world.height).id,
    ).toBe("fast-food-city");
    expect(
      getBiomeAt({ x: 0, y: world.height - 1 }, world.width, world.height).id,
    ).toBe("cringe-lab");
    expect(
      getBiomeAt(
        { x: world.width - 1, y: world.height - 1 },
        world.width,
        world.height,
      ).id,
    ).toBe("chaos-zone");
    expect(BIOMES).toHaveLength(4);
  });

  it("permite que un bot reclame comida sin alterar el estado del jugador", () => {
    const base = createWorld(44, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: "right" as const,
      personality: "aggressive" as const,
      tier: "small" as const,
      phase: 0,
    };
    const world: WorldState = { ...base, bots: [bot], ticks: 0 };
    const result = stepWorld(world, {
      elapsedMs: 0,
      playerSnake: [{ x: 22, y: 14 }],
      food: { kind: "flying-pizza", position: { x: 6, y: 5 } },
    });
    expect(result.foodClaimedByBot?.id).toBe(bot.id);
    expect(result.notifications).toContainEqual(
      expect.objectContaining({ type: "food-claimed", botId: bot.id }),
    );
    expect(result.state.bots[0]!.collected).toBe(bot.collected + 1);
  });

  it("activa y finaliza eventos configurados de forma determinista", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed += 1) {
      const base = createWorld(seed, "normal");
      const started = stepWorld(
        { ...base, nextEventAtMs: 0 },
        { elapsedMs: 1, playerSnake: player.snake, food: player.food },
      );
      const event = started.state.activeEvent;
      expect(event).not.toBeNull();
      seen.add(event!.kind);
      expect(started.notifications[0]).toEqual(
        expect.objectContaining({ type: "event-started", kind: event!.kind }),
      );

      const ended = stepWorld(started.state, {
        elapsedMs: event!.endsAtMs,
        playerSnake: player.snake,
        food: player.food,
      });
      expect(ended.state.activeEvent).toBeNull();
      expect(ended.notifications).toContainEqual({
        type: "event-ended",
        kind: event!.kind,
      });
    }
    expect(seen).toEqual(new Set(Object.keys(WORLD_EVENTS)));
  });

  it("transporta un bot que entra en un portal", () => {
    const base = createWorld(51, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      direction: "right" as const,
      personality: "aggressive" as const,
      tier: "small" as const,
      phase: 0,
    };
    const world: WorldState = {
      ...base,
      bots: [bot],
      ticks: 0,
      activeEvent: {
        kind: "portals",
        startedAtMs: 0,
        endsAtMs: 10_000,
        portals: { a: { x: 6, y: 5 }, b: { x: 15, y: 10 } },
      },
    };
    const result = stepWorld(world, {
      elapsedMs: 1,
      playerSnake: [{ x: 22, y: 14 }],
      food: { kind: "flying-pizza", position: { x: 6, y: 5 } },
    });
    expect(result.state.bots[0]!.snake[0]).toEqual({ x: 15, y: 10 });
  });

  it("transporta también cuando el bot entra por el segundo portal", () => {
    const base = createWorld(511, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [
        { x: 14, y: 10 },
        { x: 13, y: 10 },
      ],
      direction: "right" as const,
      phase: 0,
      invulnerableUntilMs: 0,
    };
    const result = stepWorld(
      {
        ...base,
        bots: [bot],
        drops: [],
        ticks: 0,
        activeEvent: {
          kind: "portals",
          startedAtMs: 0,
          endsAtMs: 10_000,
          portals: { a: { x: 6, y: 5 }, b: { x: 15, y: 10 } },
        },
        nextEventAtMs: Number.MAX_SAFE_INTEGER,
      },
      {
        elapsedMs: 1,
        playerSnake: [{ x: 30, y: 30 }],
        food: { kind: "flying-pizza", position: { x: 15, y: 10 } },
      },
    );
    expect(result.state.bots[0]!.snake[0]).toEqual({ x: 6, y: 5 });
  });

  it("cancela un portal si el cuerpo quedaría fuera del mapa", () => {
    const base = createWorld(52, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
      ],
      direction: "right" as const,
      personality: "aggressive" as const,
      tier: "small" as const,
      phase: 0,
    };
    const world: WorldState = {
      ...base,
      bots: [bot],
      ticks: 0,
      activeEvent: {
        kind: "portals",
        startedAtMs: 0,
        endsAtMs: 10_000,
        portals: { a: { x: 6, y: 5 }, b: { x: 1, y: 5 } },
      },
    };
    const result = stepWorld(world, {
      elapsedMs: 1,
      playerSnake: [{ x: 22, y: 14 }],
      food: { kind: "flying-pizza", position: { x: 6, y: 5 } },
    });
    expect(result.state.bots[0]!.snake[0]).toEqual({ x: 6, y: 5 });
    expect(
      result.state.bots[0]!.snake.every(
        (position) => position.x >= 0 && position.x < world.width,
      ),
    ).toBe(true);
  });

  it("resuelve un bot sin salida contra cuerpos rivales sin producir posiciones inválidas", () => {
    const base = createWorld(61, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [{ x: 0, y: 0 }],
      direction: "right" as const,
      tier: "small" as const,
      phase: 0,
      invulnerableUntilMs: 0,
    };
    const world: WorldState = { ...base, bots: [bot], ticks: 0 };
    const result = stepWorld(world, {
      elapsedMs: 4_000,
      playerSnake: [
        { x: 30, y: 30 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      food: { kind: "flying-pizza", position: { x: 10, y: 10 } },
    });
    expect(result.state.bots[0]).toBeUndefined();
    expect(result.state.deaths).toHaveLength(1);
  });

  it("expone nombres configurados para eventos y evolución de bots", () => {
    expect(worldEventName("chaos-mode")).toBe("Modo caos");
    const base = createWorld(71).bots[0]!;
    expect(
      botEvolutionName({ ...base, tier: "small", snake: [{ x: 1, y: 1 }] }),
    ).toBe("Mini Bicho");
    expect(botEvolutionName({ ...base, tier: "medium" })).toBe(
      "Gusano Legendario",
    );
    expect(botEvolutionName({ ...base, tier: "giant" })).toBe("Monstruo Meme");
  });

  it("protege al jugador al aparecer y detecta cabeza contra cuerpo rival después", () => {
    const base = createWorld(91, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [
        { x: 12, y: 12 },
        { x: 11, y: 12 },
      ],
      invulnerableUntilMs: 0,
    };
    const world: WorldState = {
      ...base,
      bots: [bot],
      drops: [],
      nextEventAtMs: Number.MAX_SAFE_INTEGER,
    };
    const playerSnake = [
      { x: 11, y: 12 },
      { x: 10, y: 12 },
    ];
    const protectedResult = stepWorld(world, {
      elapsedMs: 1_000,
      playerSnake,
      food: { kind: "flying-pizza", position: { x: 40, y: 40 } },
    });
    expect(protectedResult.playerCollision).toBeNull();

    const exposedResult = stepWorld(world, {
      elapsedMs: 4_000,
      playerSnake,
      food: { kind: "flying-pizza", position: { x: 40, y: 40 } },
    });
    expect(exposedResult.playerCollision?.id).toBe(bot.id);
  });

  it("elimina un bot que impacta contra un cuerpo rival y deja restos limitados", () => {
    const base = createWorld(92, "reduced");
    const bot = {
      ...base.bots[0]!,
      snake: [{ x: 0, y: 0 }],
      direction: "right" as const,
      invulnerableUntilMs: 0,
      phase: 0,
    };
    const world: WorldState = {
      ...base,
      bots: [bot],
      drops: [],
      ticks: 0,
      nextEventAtMs: Number.MAX_SAFE_INTEGER,
    };
    const result = stepWorld(world, {
      elapsedMs: 4_000,
      playerSnake: [
        { x: 30, y: 30 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      food: { kind: "flying-pizza", position: { x: 40, y: 40 } },
    });

    expect(result.state.bots).toHaveLength(0);
    expect(result.state.deaths).toHaveLength(1);
    expect(
      result.state.drops.filter((drop) => drop.source === "remains"),
    ).toHaveLength(WORLD_CONFIG.drops.smallCount);
    expect(result.notifications).toContainEqual(
      expect.objectContaining({ type: "bot-eliminated", botId: bot.id }),
    );
  });

  it.each([
    ["medium", WORLD_CONFIG.drops.mediumCount, "lost-robot"],
    ["giant", WORLD_CONFIG.drops.giantCount, "legendary-potato"],
  ] as const)(
    "deja la cantidad y rareza configuradas cuando cae un bot %s",
    (tier, count, firstKind) => {
      const base = createWorld(94 + (tier === "giant" ? 1 : 0), "reduced");
      const bot = {
        ...base.bots[0]!,
        tier,
        snake: [{ x: 0, y: 0 }],
        direction: "right" as const,
        invulnerableUntilMs: 0,
        phase: 0,
      };
      const result = stepWorld(
        {
          ...base,
          bots: [bot],
          drops: [],
          nextEventAtMs: Number.MAX_SAFE_INTEGER,
        },
        {
          elapsedMs: 4_000,
          playerSnake: [
            { x: 30, y: 30 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ],
          food: { kind: "flying-pizza", position: { x: 40, y: 40 } },
        },
      );
      const remains = result.state.drops.filter(
        (drop) => drop.source === "remains",
      );
      expect(remains).toHaveLength(count);
      expect(remains[0]!.kind).toBe(firstKind);
    },
  );

  it("expone restos como recompensa coleccionable del jugador", () => {
    const base = createWorld(93, "reduced");
    const drop: WorldDrop = {
      id: "drop-remains-test",
      position: { x: 30, y: 30 },
      kind: "cringe-energy",
      points: 18,
      experience: 9,
      growth: 1,
      source: "remains",
      expiresAtMs: 30_000,
    };
    const result = stepWorld(
      {
        ...base,
        bots: [],
        drops: [drop],
        nextEventAtMs: Number.MAX_SAFE_INTEGER,
      },
      {
        elapsedMs: 4_000,
        playerSnake: [{ x: 30, y: 30 }],
        food: { kind: "flying-pizza", position: { x: 40, y: 40 } },
      },
    );

    expect(result.collectedDrops).toEqual([drop]);
    expect(
      result.state.drops.some((candidate) => candidate.id === drop.id),
    ).toBe(false);
  });
});
