import type { FoodKind } from "./game";

export type BotTier = "small" | "medium" | "giant";
export type BotPersonality = "aggressive" | "explorer" | "coward" | "balanced";
export type BiomeId =
  "meme-meadow" | "fast-food-city" | "cringe-lab" | "chaos-zone";
export type WorldEventKind =
  "object-rain" | "chaos-mode" | "portals" | "bot-invasion";
export type DecorationKind =
  | "bush"
  | "flower"
  | "rock"
  | "sign"
  | "fry"
  | "flask"
  | "antenna"
  | "crystal"
  | "glitch";

export interface BotTierConfig {
  readonly initialLength: number;
  readonly maximumLength: number;
  readonly moveEveryTicks: number;
  readonly bodyScale: number;
  readonly reward: number;
}

export interface PersonalityConfig {
  readonly foodWeight: number;
  readonly safetyWeight: number;
  readonly playerDistanceWeight: number;
  readonly wanderWeight: number;
}

export interface BiomeDefinition {
  readonly id: BiomeId;
  readonly name: string;
  readonly backgroundColor: number;
  readonly accentColor: number;
  readonly decorations: readonly DecorationKind[];
  readonly featuredFoods: readonly FoodKind[];
}

export const BOT_TIERS: Readonly<Record<BotTier, BotTierConfig>> =
  Object.freeze({
    small: Object.freeze({
      initialLength: 4,
      maximumLength: 11,
      moveEveryTicks: 1,
      bodyScale: 0.72,
      reward: 1,
    }),
    medium: Object.freeze({
      initialLength: 7,
      maximumLength: 19,
      moveEveryTicks: 2,
      bodyScale: 0.92,
      reward: 2,
    }),
    giant: Object.freeze({
      initialLength: 10,
      maximumLength: 32,
      moveEveryTicks: 3,
      bodyScale: 1.36,
      reward: 4,
    }),
  });

export const BOT_PERSONALITIES: Readonly<
  Record<BotPersonality, PersonalityConfig>
> = Object.freeze({
  aggressive: Object.freeze({
    foodWeight: 5.2,
    safetyWeight: 2.6,
    playerDistanceWeight: -0.42,
    wanderWeight: 0.35,
  }),
  explorer: Object.freeze({
    foodWeight: 2.4,
    safetyWeight: 3.4,
    playerDistanceWeight: 0.05,
    wanderWeight: 2.2,
  }),
  coward: Object.freeze({
    foodWeight: 2.2,
    safetyWeight: 7.2,
    playerDistanceWeight: 0.75,
    wanderWeight: 0.55,
  }),
  balanced: Object.freeze({
    foodWeight: 3.8,
    safetyWeight: 4.5,
    playerDistanceWeight: 0.18,
    wanderWeight: 0.85,
  }),
});

export const BOT_NAMES = Object.freeze([
  "Gusanator",
  "NinjaWorm",
  "MemeKing",
  "Doña Croqueta",
  "Sir Wiggles",
  "Patatín Prime",
  "Cringe Rider",
  "Taco Turbo",
  "Señor Fideo",
  "Pixel Churro",
] as const);

export const BIOMES: readonly BiomeDefinition[] = Object.freeze([
  Object.freeze({
    id: "meme-meadow",
    name: "Pradera Meme",
    backgroundColor: 0x102719,
    accentColor: 0x75df62,
    decorations: Object.freeze(["bush", "flower", "rock"] as const),
    featuredFoods: Object.freeze(["influencer-avocado", "duck-king"] as const),
  }),
  Object.freeze({
    id: "fast-food-city",
    name: "Ciudad Fast Food",
    backgroundColor: 0x2b1820,
    accentColor: 0xff9848,
    decorations: Object.freeze(["sign", "fry", "rock"] as const),
    featuredFoods: Object.freeze(["flying-pizza", "infinite-coffee"] as const),
  }),
  Object.freeze({
    id: "cringe-lab",
    name: "Laboratorio Cringe",
    backgroundColor: 0x101f2d,
    accentColor: 0x4de1ff,
    decorations: Object.freeze(["flask", "antenna", "rock"] as const),
    featuredFoods: Object.freeze(["lost-robot", "cringe-energy"] as const),
  }),
  Object.freeze({
    id: "chaos-zone",
    name: "Zona Caos",
    backgroundColor: 0x28102f,
    accentColor: 0xff4fd8,
    decorations: Object.freeze(["crystal", "glitch", "rock"] as const),
    featuredFoods: Object.freeze(["super-meme", "legendary-potato"] as const),
  }),
]);

export const WORLD_EVENTS: Readonly<
  Record<
    WorldEventKind,
    {
      readonly name: string;
      readonly durationMs: number;
      readonly color: number;
    }
  >
> = Object.freeze({
  "object-rain": Object.freeze({
    name: "Lluvia de objetos",
    durationMs: 7_000,
    color: 0xffd83d,
  }),
  "chaos-mode": Object.freeze({
    name: "Modo caos",
    durationMs: 8_000,
    color: 0xff4fd8,
  }),
  portals: Object.freeze({
    name: "Portales meme",
    durationMs: 9_000,
    color: 0x8f6cff,
  }),
  "bot-invasion": Object.freeze({
    name: "Invasión bot",
    durationMs: 10_000,
    color: 0x4de1ff,
  }),
});

export const WORLD_CONFIG = Object.freeze({
  bots: Object.freeze({
    normal: 12,
    reduced: 6,
    invasionExtra: 4,
    maximum: 16,
  }),
  decorations: Object.freeze({ normal: 150, reduced: 72 }),
  drops: Object.freeze({
    ambientNormal: 22,
    ambientReduced: 12,
    maximum: 56,
    lifetimeMs: 28_000,
    respawnDelayMs: 4_000,
    smallCount: 4,
    mediumCount: 7,
    giantCount: 11,
  }),
  eventDelay: Object.freeze({ minimumMs: 18_000, maximumMs: 30_000 }),
  dangerRadius: 2,
  portalPadding: 3,
  spawnProtectionMs: 3_500,
  distantBotThreshold: 24,
  camera: Object.freeze({ cellSize: 30, lerp: 0.085, deadzone: 90 }),
});
