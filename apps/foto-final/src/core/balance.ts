export const GAME_BALANCE = Object.freeze({
  board: Object.freeze({
    width: 72,
    height: 48,
    minimumWidth: 8,
    minimumHeight: 6,
  }),
  controls: Object.freeze({
    maximumDirectionQueue: 3,
  }),
  difficulty: Object.freeze({
    intervalMs: 20_000,
    maximumLevel: 10,
    tickReductionPerLevelMs: 2,
    minimumTickMs: 96,
    speedBoostMultiplier: 0.78,
    minimumBoostedTickMs: 74,
  }),
  spawning: Object.freeze({
    activeFood: 1,
    replacement: "immediate" as const,
  }),
  food: Object.freeze({
    "legendary-potato": Object.freeze({
      name: "Patata dorada",
      rarity: "legendary" as const,
      weight: 2.5,
      points: 120,
      experience: 8,
      growth: 4,
      color: 0xffd83d,
      visualScale: 1.18,
      visualEffect: "pulse" as const,
    }),
    "flying-pizza": Object.freeze({
      name: "Pizza voladora",
      rarity: "normal" as const,
      weight: 25,
      points: 15,
      experience: 2,
      growth: 1,
      color: 0xffc94d,
      visualScale: 1,
      visualEffect: "spin" as const,
    }),
    "lost-robot": Object.freeze({
      name: "Robot perdido",
      rarity: "rare" as const,
      weight: 7,
      points: 20,
      experience: 4,
      growth: 2,
      color: 0x90a4ae,
      visualScale: 1.05,
      visualEffect: "pulse" as const,
    }),
    "angry-emoji": Object.freeze({
      name: "Emoji enfadado",
      rarity: "normal" as const,
      weight: 22,
      points: 12,
      experience: 2,
      growth: 1,
      color: 0xffd23f,
      visualScale: 1,
      visualEffect: "pulse" as const,
    }),
    "sad-sock": Object.freeze({
      name: "Calcetín triste",
      rarity: "normal" as const,
      weight: 21,
      points: 10,
      experience: 2,
      growth: 1,
      color: 0x8f7aea,
      visualScale: 0.94,
      visualEffect: "float" as const,
    }),
    "duck-king": Object.freeze({
      name: "Patito rey",
      rarity: "rare" as const,
      weight: 6,
      points: 25,
      experience: 4,
      growth: 2,
      color: 0xffe066,
      visualScale: 1.08,
      visualEffect: "float" as const,
    }),
    "cringe-energy": Object.freeze({
      name: "Energía cringe",
      rarity: "rare" as const,
      weight: 4,
      points: 25,
      experience: 4,
      growth: 1,
      color: 0xff4fd8,
      visualScale: 1.12,
      visualEffect: "electric" as const,
      effect: Object.freeze({
        kind: "double-points" as const,
        durationMs: 7_000,
      }),
    }),
    "influencer-avocado": Object.freeze({
      name: "Aguacate influencer",
      rarity: "normal" as const,
      weight: 16,
      points: 30,
      experience: 2,
      growth: 1,
      color: 0x73c94f,
      visualScale: 1.04,
      visualEffect: "float" as const,
    }),
    "infinite-coffee": Object.freeze({
      name: "Café infinito",
      rarity: "rare" as const,
      weight: 4,
      points: 25,
      experience: 4,
      growth: 1,
      color: 0xd98c52,
      visualScale: 1.08,
      visualEffect: "pulse" as const,
      effect: Object.freeze({
        kind: "speed-boost" as const,
        durationMs: 6_000,
      }),
    }),
    "super-meme": Object.freeze({
      name: "Super Meme",
      rarity: "legendary" as const,
      weight: 0.5,
      points: 300,
      experience: 12,
      growth: 6,
      color: 0x5de8ff,
      visualScale: 1.24,
      visualEffect: "chaos" as const,
    }),
  }),
  evolutions: Object.freeze([
    Object.freeze({
      id: "mini-bicho" as const,
      name: "Mini Bicho Meme",
      minExperience: 0,
      tickMs: 165,
      scale: 0.82,
      headColor: 0xb9ff66,
      bodyColor: 0x6ed34d,
      accentColor: 0x2a154b,
      effect: "none" as const,
    }),
    Object.freeze({
      id: "gusano-legendario" as const,
      name: "Gusano Legendario",
      minExperience: 8,
      tickMs: 154,
      scale: 0.9,
      headColor: 0xffdd55,
      bodyColor: 0xf6a623,
      accentColor: 0x6b3b00,
      effect: "sparkles" as const,
    }),
    Object.freeze({
      id: "serpiente-influencer" as const,
      name: "Serpiente Influencer",
      minExperience: 22,
      tickMs: 143,
      scale: 0.98,
      headColor: 0xff70bf,
      bodyColor: 0xa75cff,
      accentColor: 0xffffff,
      effect: "glow" as const,
    }),
    Object.freeze({
      id: "monstruo-meme" as const,
      name: "Monstruo Meme",
      minExperience: 42,
      tickMs: 132,
      scale: 1.08,
      headColor: 0xff624d,
      bodyColor: 0xe23a65,
      accentColor: 0x3a0926,
      effect: "pulse" as const,
    }),
    Object.freeze({
      id: "dios-del-caos" as const,
      name: "Dios del Caos",
      minExperience: 70,
      tickMs: 120,
      scale: 1.18,
      headColor: 0x5de8ff,
      bodyColor: 0x5848ff,
      accentColor: 0xffef5a,
      effect: "chaos" as const,
    }),
  ]),
});

export type BalanceFoodKind = keyof typeof GAME_BALANCE.food;
export type BalanceEvolutionId = (typeof GAME_BALANCE.evolutions)[number]["id"];

export const RARITY_WEIGHTS = Object.freeze(
  Object.entries(GAME_BALANCE.food).reduce(
    (probabilities, [, food]) => {
      probabilities[food.rarity] += food.weight;
      return probabilities;
    },
    { normal: 0, rare: 0, legendary: 0 },
  ),
);

export const TOTAL_FOOD_WEIGHT = Object.values(GAME_BALANCE.food).reduce(
  (total, food) => total + food.weight,
  0,
);

export const RARITY_PROBABILITIES = Object.freeze({
  normal: RARITY_WEIGHTS.normal / TOTAL_FOOD_WEIGHT,
  rare: RARITY_WEIGHTS.rare / TOTAL_FOOD_WEIGHT,
  legendary: RARITY_WEIGHTS.legendary / TOTAL_FOOD_WEIGHT,
});

export interface BalanceSummary {
  readonly expectedPointsPerFood: number;
  readonly expectedExperiencePerFood: number;
  readonly expectedGrowthPerFood: number;
  readonly rarityProbabilities: typeof RARITY_PROBABILITIES;
}

function weightedAverage(
  selector: (food: (typeof GAME_BALANCE.food)[BalanceFoodKind]) => number,
): number {
  return (
    Object.values(GAME_BALANCE.food).reduce(
      (total, food) => total + selector(food) * food.weight,
      0,
    ) / TOTAL_FOOD_WEIGHT
  );
}

export function getBalanceSummary(): BalanceSummary {
  return {
    expectedPointsPerFood: weightedAverage((food) => food.points),
    expectedExperiencePerFood: weightedAverage((food) => food.experience),
    expectedGrowthPerFood: weightedAverage((food) => food.growth),
    rarityProbabilities: RARITY_PROBABILITIES,
  };
}

export function estimateFoodNeededForEvolution(minExperience: number): number {
  if (!Number.isFinite(minExperience) || minExperience <= 0) return 0;
  return Math.ceil(
    minExperience / getBalanceSummary().expectedExperiencePerFood,
  );
}
