import {
  GAME_BALANCE,
  type BalanceEvolutionId,
  type BalanceFoodKind,
} from "./balance";

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "ready" | "playing" | "game-over";

export interface Position {
  readonly x: number;
  readonly y: number;
}

export type FoodKind = BalanceFoodKind;

export type FoodRarity = "normal" | "rare" | "legendary";

export type RarityCounts = Readonly<Record<FoodRarity, number>>;

export type FoodVisualEffect =
  "float" | "pulse" | "spin" | "electric" | "chaos";

export type TimedEffectKind = "speed-boost" | "double-points";

export interface TimedEffectDefinition {
  readonly kind: TimedEffectKind;
  readonly durationMs: number;
}

export interface ActiveEffect {
  readonly kind: TimedEffectKind;
  readonly expiresAtMs: number;
}

export interface FoodDefinition {
  readonly kind: FoodKind;
  readonly name: string;
  readonly rarity: FoodRarity;
  readonly weight: number;
  readonly points: number;
  readonly experience: number;
  readonly growth: number;
  readonly color: number;
  readonly visualScale: number;
  readonly visualEffect: FoodVisualEffect;
  readonly effect?: TimedEffectDefinition;
}

export interface Food {
  readonly kind: FoodKind;
  readonly position: Position;
}

export type EvolutionId = BalanceEvolutionId;

export interface Evolution {
  readonly id: EvolutionId;
  readonly name: string;
  readonly minExperience: number;
  readonly tickMs: number;
  readonly scale: number;
  readonly headColor: number;
  readonly bodyColor: number;
  readonly accentColor: number;
  readonly effect: "none" | "sparkles" | "glow" | "pulse" | "chaos";
}

export const FOOD_CATALOG: Readonly<Record<FoodKind, FoodDefinition>> =
  Object.fromEntries(
    Object.entries(GAME_BALANCE.food).map(([kind, definition]) => [
      kind,
      { ...definition, kind },
    ]),
  ) as Readonly<Record<FoodKind, FoodDefinition>>;

export const FOOD_KINDS = Object.freeze(
  Object.keys(FOOD_CATALOG) as FoodKind[],
);

export const EVOLUTIONS: readonly Evolution[] = GAME_BALANCE.evolutions;

export interface GameState {
  readonly seed: number;
  readonly rngState: number;
  readonly width: number;
  readonly height: number;
  readonly status: GameStatus;
  readonly snake: readonly Position[];
  readonly direction: Direction;
  readonly queuedDirection: Direction;
  readonly directionQueue: readonly Direction[];
  readonly food: Food;
  readonly score: number;
  readonly eaten: number;
  readonly experience: number;
  readonly collectedByRarity: RarityCounts;
  readonly growthPending: number;
  readonly evolutionId: EvolutionId;
  readonly activeEffects: readonly ActiveEffect[];
  readonly ticks: number;
  readonly elapsedMs: number;
  readonly fastestTickMs: number;
}

export interface GameOptions {
  readonly width?: number;
  readonly height?: number;
}

export type CollisionKind = "wall" | "self";

export type GameEvent =
  | { readonly type: "started"; readonly tick: number }
  | {
      readonly type: "direction-changed";
      readonly tick: number;
      readonly direction: Direction;
    }
  | {
      readonly type: "moved";
      readonly tick: number;
      readonly head: Position;
      readonly length: number;
    }
  | {
      readonly type: "ate";
      readonly tick: number;
      readonly kind: FoodKind;
      readonly rarity: FoodRarity;
      readonly basePoints: number;
      readonly multiplier: number;
      readonly points: number;
      readonly score: number;
      readonly experience: number;
      readonly growth: number;
    }
  | {
      readonly type: "grew";
      readonly tick: number;
      readonly by: number;
      readonly length: number;
    }
  | {
      readonly type: "evolved";
      readonly tick: number;
      readonly from: EvolutionId;
      readonly to: EvolutionId;
    }
  | {
      readonly type: "food-spawned";
      readonly tick: number;
      readonly food: Food;
    }
  | {
      readonly type: "effect-started";
      readonly tick: number;
      readonly effect: TimedEffectKind;
      readonly expiresAtMs: number;
      readonly refreshed: boolean;
    }
  | {
      readonly type: "effect-expired";
      readonly tick: number;
      readonly effect: TimedEffectKind;
    }
  | {
      readonly type: "collision";
      readonly tick: number;
      readonly collision: CollisionKind;
      readonly at: Position;
    }
  | {
      readonly type: "game-over";
      readonly tick: number;
      readonly score: number;
      readonly evolutionId: EvolutionId;
    };

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface GameSnapshot {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly status: GameStatus;
  readonly snake: readonly Position[];
  readonly direction: Direction;
  readonly queuedDirection: Direction;
  readonly directionQueue: readonly Direction[];
  readonly food: Food;
  readonly score: number;
  readonly eaten: number;
  readonly experience: number;
  readonly collectedByRarity: RarityCounts;
  readonly growthPending: number;
  readonly evolutionId: EvolutionId;
  readonly evolutionName: string;
  readonly activeEffects: readonly ActiveEffect[];
  readonly difficultyLevel: number;
  readonly ticks: number;
  readonly tickMs: number;
  readonly elapsedMs: number;
  readonly fastestTickMs: number;
}

const DEFAULT_SEED = 0x5eed_1234;
const { board, controls, difficulty: difficultyBalance } = GAME_BALANCE;

const VECTORS: Readonly<Record<Direction, Position>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return DEFAULT_SEED;
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

function validateDimension(
  value: number | undefined,
  fallback: number,
  min: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(
      `La dimensión debe ser un entero mayor o igual que ${min}.`,
    );
  }
  return value;
}

/** Xorshift32: returns both the next RNG state and a stable unit value. */
export function nextRandom(rngState: number): {
  readonly rngState: number;
  readonly value: number;
} {
  let next = normalizeSeed(rngState);
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { rngState: next, value: next / 0x1_0000_0000 };
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function evolutionFor(experience: number): Evolution {
  for (let index = EVOLUTIONS.length - 1; index >= 0; index -= 1) {
    const evolution = EVOLUTIONS[index];
    if (evolution && experience >= evolution.minExperience) return evolution;
  }
  return EVOLUTIONS[0]!;
}

export function getEvolution(state: Pick<GameState, "experience">): Evolution {
  return evolutionFor(state.experience);
}

function randomIndex(
  rngState: number,
  length: number,
): {
  readonly rngState: number;
  readonly index: number;
} {
  const random = nextRandom(rngState);
  return {
    rngState: random.rngState,
    index: Math.min(length - 1, Math.floor(random.value * length)),
  };
}

/** Selects a food from a stable weighted interval. Useful for deterministic tests. */
export function selectFoodKind(value: number): FoodKind {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      "El valor aleatorio debe estar entre 0 (incluido) y 1.",
    );
  }

  const totalWeight = FOOD_KINDS.reduce(
    (total, kind) => total + FOOD_CATALOG[kind].weight,
    0,
  );
  let cursor = value * totalWeight;
  for (const kind of FOOD_KINDS) {
    cursor -= FOOD_CATALOG[kind].weight;
    if (cursor < 0) return kind;
  }
  return FOOD_KINDS.at(-1)!;
}

function spawnFood(
  rngState: number,
  width: number,
  height: number,
  snake: readonly Position[],
): { readonly rngState: number; readonly food: Food } {
  const occupied = new Set(
    snake.map((position) => `${position.x},${position.y}`),
  );
  const free: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    throw new Error("No queda ninguna casilla libre para un objeto meme.");
  }

  const cellRoll = randomIndex(rngState, free.length);
  const kindRoll = nextRandom(cellRoll.rngState);
  return {
    rngState: kindRoll.rngState,
    food: {
      kind: selectFoodKind(kindRoll.value),
      position: free[cellRoll.index]!,
    },
  };
}

export function createInitialState(
  seed = DEFAULT_SEED,
  options: GameOptions = {},
): GameState {
  const width = validateDimension(
    options.width,
    board.width,
    board.minimumWidth,
  );
  const height = validateDimension(
    options.height,
    board.height,
    board.minimumHeight,
  );
  const normalizedSeed = normalizeSeed(seed);
  const headX = Math.floor(width / 2);
  const headY = Math.floor(height / 2);
  const snake: readonly Position[] = [
    { x: headX, y: headY },
    { x: headX - 1, y: headY },
    { x: headX - 2, y: headY },
  ];
  const spawned = spawnFood(normalizedSeed, width, height, snake);

  return {
    seed: normalizedSeed,
    rngState: spawned.rngState,
    width,
    height,
    status: "ready",
    snake,
    direction: "right",
    queuedDirection: "right",
    directionQueue: [],
    food: spawned.food,
    score: 0,
    eaten: 0,
    experience: 0,
    collectedByRarity: { normal: 0, rare: 0, legendary: 0 },
    growthPending: 0,
    evolutionId: EVOLUTIONS[0]!.id,
    activeEffects: [],
    ticks: 0,
    elapsedMs: 0,
    fastestTickMs: EVOLUTIONS[0]!.tickMs,
  };
}

export function start(state: GameState): StepResult {
  if (state.status !== "ready") return { state, events: [] };
  const started: GameState = { ...state, status: "playing" };
  return {
    state: started,
    events: [{ type: "started", tick: state.ticks }],
  };
}

export function restart(state: GameState, seed = state.seed): GameState {
  return createInitialState(seed, { width: state.width, height: state.height });
}

export function queueDirection(
  state: GameState,
  direction: Direction,
): GameState {
  if (state.status === "game-over") return state;
  const lastDirection = state.directionQueue.at(-1) ?? state.direction;
  if (direction === OPPOSITE[lastDirection]) return state;
  if (direction === lastDirection) return state;
  if (state.directionQueue.length >= controls.maximumDirectionQueue)
    return state;

  const directionQueue = [...state.directionQueue, direction];
  return {
    ...state,
    queuedDirection: directionQueue[0]!,
    directionQueue,
  };
}

function collidesWithWall(
  position: Position,
  width: number,
  height: number,
): boolean {
  return (
    position.x < 0 ||
    position.x >= width ||
    position.y < 0 ||
    position.y >= height
  );
}

function gameOver(
  state: GameState,
  tick: number,
  elapsedMs: number,
  collision: CollisionKind,
  at: Position,
  prefixEvents: readonly GameEvent[],
): StepResult {
  const ended: GameState = {
    ...state,
    status: "game-over",
    ticks: tick,
    elapsedMs,
  };
  return {
    state: ended,
    events: [
      ...prefixEvents,
      { type: "collision", tick, collision, at },
      {
        type: "game-over",
        tick,
        score: state.score,
        evolutionId: state.evolutionId,
      },
    ],
  };
}

export function step(inputState: GameState): StepResult {
  if (inputState.status === "game-over")
    return { state: inputState, events: [] };

  const started = start(inputState);
  const state = started.state;
  const tick = state.ticks + 1;
  const tickMs = getTickMs(state);
  const elapsedMs = state.elapsedMs + tickMs;
  const direction = state.directionQueue[0] ?? state.queuedDirection;
  const directionQueue = state.directionQueue.slice(1);
  const queuedDirection = directionQueue[0] ?? direction;
  const vector = VECTORS[direction];
  const head = state.snake[0]!;
  const nextHead: Position = { x: head.x + vector.x, y: head.y + vector.y };
  const events: GameEvent[] = [...started.events];
  const activeEffects = state.activeEffects.filter((effect) => {
    if (effect.expiresAtMs > elapsedMs) return true;
    events.push({ type: "effect-expired", tick, effect: effect.kind });
    return false;
  });
  const stateAtTick: GameState = {
    ...state,
    direction,
    queuedDirection,
    directionQueue,
    activeEffects,
    fastestTickMs: Math.min(state.fastestTickMs, tickMs),
  };

  if (direction !== state.direction) {
    events.push({ type: "direction-changed", tick, direction });
  }
  if (collidesWithWall(nextHead, state.width, state.height)) {
    return gameOver(stateAtTick, tick, elapsedMs, "wall", nextHead, events);
  }

  const bodyThatRemains =
    state.growthPending > 0 ? state.snake : state.snake.slice(0, -1);
  if (bodyThatRemains.some((position) => samePosition(position, nextHead))) {
    return gameOver(stateAtTick, tick, elapsedMs, "self", nextHead, events);
  }

  const ate = samePosition(nextHead, state.food.position);
  const definition = ate ? FOOD_CATALOG[state.food.kind] : null;
  const growsThisTick = ate || state.growthPending > 0;
  const snake = growsThisTick
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];
  const multiplier = activeEffects.some(
    (effect) => effect.kind === "double-points",
  )
    ? 2
    : 1;
  const awardedPoints = (definition?.points ?? 0) * multiplier;
  const score = state.score + awardedPoints;
  const eaten = state.eaten + (ate ? 1 : 0);
  const experience = state.experience + (definition?.experience ?? 0);
  const collectedByRarity = definition
    ? {
        ...state.collectedByRarity,
        [definition.rarity]: state.collectedByRarity[definition.rarity] + 1,
      }
    : state.collectedByRarity;
  const pendingBeforeMovement = Math.max(0, state.growthPending - 1);
  const growthPending =
    pendingBeforeMovement + (definition ? definition.growth - 1 : 0);
  const evolution = evolutionFor(experience);
  let rngState = state.rngState;
  let food = state.food;
  let nextActiveEffects = activeEffects;

  events.push({ type: "moved", tick, head: nextHead, length: snake.length });
  if (growsThisTick) {
    events.push({ type: "grew", tick, by: 1, length: snake.length });
  }
  if (definition) {
    events.push({
      type: "ate",
      tick,
      kind: definition.kind,
      rarity: definition.rarity,
      basePoints: definition.points,
      multiplier,
      points: awardedPoints,
      score,
      experience: definition.experience,
      growth: definition.growth,
    });
    if (definition.effect) {
      const refreshed = activeEffects.some(
        (effect) => effect.kind === definition.effect?.kind,
      );
      const effect: ActiveEffect = {
        kind: definition.effect.kind,
        expiresAtMs: elapsedMs + definition.effect.durationMs,
      };
      nextActiveEffects = [
        ...activeEffects.filter((active) => active.kind !== effect.kind),
        effect,
      ];
      events.push({
        type: "effect-started",
        tick,
        effect: effect.kind,
        expiresAtMs: effect.expiresAtMs,
        refreshed,
      });
    }
    if (evolution.id !== state.evolutionId) {
      events.push({
        type: "evolved",
        tick,
        from: state.evolutionId,
        to: evolution.id,
      });
    }
    const spawned = spawnFood(rngState, state.width, state.height, snake);
    rngState = spawned.rngState;
    food = spawned.food;
    events.push({ type: "food-spawned", tick, food });
  }

  return {
    state: {
      ...state,
      rngState,
      status: "playing",
      snake,
      direction,
      queuedDirection,
      directionQueue,
      food,
      score,
      eaten,
      experience,
      collectedByRarity,
      growthPending,
      evolutionId: evolution.id,
      activeEffects: nextActiveEffects,
      ticks: tick,
      elapsedMs,
      fastestTickMs: stateAtTick.fastestTickMs,
    },
    events,
  };
}

export function getDifficultyLevel(
  state: Pick<GameState, "elapsedMs">,
): number {
  return Math.min(
    difficultyBalance.maximumLevel,
    Math.floor(Math.max(0, state.elapsedMs) / difficultyBalance.intervalMs),
  );
}

type TickState = Pick<GameState, "experience"> &
  Partial<Pick<GameState, "elapsedMs" | "activeEffects">>;

export function getTickMs(state: TickState): number {
  const elapsedMs = state.elapsedMs ?? 0;
  const difficultyLevel = getDifficultyLevel({ elapsedMs });
  const normalTickMs = Math.max(
    difficultyBalance.minimumTickMs,
    evolutionFor(state.experience).tickMs -
      difficultyLevel * difficultyBalance.tickReductionPerLevelMs,
  );
  const hasSpeedBoost = (state.activeEffects ?? []).some(
    (effect) => effect.kind === "speed-boost" && effect.expiresAtMs > elapsedMs,
  );

  return hasSpeedBoost
    ? Math.max(
        difficultyBalance.minimumBoostedTickMs,
        Math.round(normalTickMs * difficultyBalance.speedBoostMultiplier),
      )
    : normalTickMs;
}

export function createSnapshot(state: GameState): GameSnapshot {
  const evolution = getEvolution(state);
  return {
    seed: state.seed,
    width: state.width,
    height: state.height,
    status: state.status,
    snake: state.snake.map((position) => ({ ...position })),
    direction: state.direction,
    queuedDirection: state.queuedDirection,
    directionQueue: [...state.directionQueue],
    food: {
      kind: state.food.kind,
      position: { ...state.food.position },
    },
    score: state.score,
    eaten: state.eaten,
    experience: state.experience,
    collectedByRarity: { ...state.collectedByRarity },
    growthPending: state.growthPending,
    evolutionId: evolution.id,
    evolutionName: evolution.name,
    activeEffects: state.activeEffects.map((effect) => ({ ...effect })),
    difficultyLevel: getDifficultyLevel(state),
    ticks: state.ticks,
    tickMs: getTickMs(state),
    elapsedMs: state.elapsedMs,
    fastestTickMs: state.fastestTickMs,
  };
}
