export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "ready" | "playing" | "game-over";

export interface Position {
  readonly x: number;
  readonly y: number;
}

export type FoodKind =
  | "legendary-potato"
  | "flying-pizza"
  | "lost-robot"
  | "angry-emoji"
  | "sad-sock"
  | "duck-king"
  | "cringe-energy"
  | "influencer-avocado";

export interface FoodDefinition {
  readonly kind: FoodKind;
  readonly name: string;
  readonly points: number;
  readonly growth: number;
  readonly color: number;
}

export interface Food {
  readonly kind: FoodKind;
  readonly position: Position;
}

export type EvolutionId =
  | "mini-bicho"
  | "gusano-legendario"
  | "serpiente-influencer"
  | "monstruo-meme"
  | "dios-del-caos";

export interface Evolution {
  readonly id: EvolutionId;
  readonly name: string;
  readonly minEaten: number;
  readonly tickMs: number;
  readonly scale: number;
  readonly headColor: number;
  readonly bodyColor: number;
  readonly accentColor: number;
  readonly effect: "none" | "sparkles" | "glow" | "pulse" | "chaos";
}

export const FOOD_CATALOG: Readonly<Record<FoodKind, FoodDefinition>> = {
  "legendary-potato": {
    kind: "legendary-potato",
    name: "Patata legendaria",
    points: 10,
    growth: 1,
    color: 0xc98b4b,
  },
  "flying-pizza": {
    kind: "flying-pizza",
    name: "Pizza voladora",
    points: 15,
    growth: 1,
    color: 0xffc94d,
  },
  "lost-robot": {
    kind: "lost-robot",
    name: "Robot perdido",
    points: 20,
    growth: 1,
    color: 0x90a4ae,
  },
  "angry-emoji": {
    kind: "angry-emoji",
    name: "Emoji enfadado",
    points: 12,
    growth: 1,
    color: 0xffd23f,
  },
  "sad-sock": {
    kind: "sad-sock",
    name: "Calcetín triste",
    points: 10,
    growth: 1,
    color: 0x8f7aea,
  },
  "duck-king": {
    kind: "duck-king",
    name: "Patito rey",
    points: 25,
    growth: 1,
    color: 0xffe066,
  },
  "cringe-energy": {
    kind: "cringe-energy",
    name: "Energía cringe",
    points: 40,
    growth: 2,
    color: 0xff4fd8,
  },
  "influencer-avocado": {
    kind: "influencer-avocado",
    name: "Aguacate influencer",
    points: 30,
    growth: 1,
    color: 0x73c94f,
  },
};

export const FOOD_KINDS = Object.freeze(
  Object.keys(FOOD_CATALOG) as FoodKind[],
);

export const EVOLUTIONS: readonly Evolution[] = Object.freeze([
  {
    id: "mini-bicho",
    name: "Mini Bicho Meme",
    minEaten: 0,
    tickMs: 150,
    scale: 0.82,
    headColor: 0xb9ff66,
    bodyColor: 0x6ed34d,
    accentColor: 0x2a154b,
    effect: "none",
  },
  {
    id: "gusano-legendario",
    name: "Gusano Legendario",
    minEaten: 4,
    tickMs: 140,
    scale: 0.9,
    headColor: 0xffdd55,
    bodyColor: 0xf6a623,
    accentColor: 0x6b3b00,
    effect: "sparkles",
  },
  {
    id: "serpiente-influencer",
    name: "Serpiente Influencer",
    minEaten: 9,
    tickMs: 128,
    scale: 0.98,
    headColor: 0xff70bf,
    bodyColor: 0xa75cff,
    accentColor: 0xffffff,
    effect: "glow",
  },
  {
    id: "monstruo-meme",
    name: "Monstruo Meme",
    minEaten: 16,
    tickMs: 116,
    scale: 1.08,
    headColor: 0xff624d,
    bodyColor: 0xe23a65,
    accentColor: 0x3a0926,
    effect: "pulse",
  },
  {
    id: "dios-del-caos",
    name: "Dios del Caos",
    minEaten: 25,
    tickMs: 104,
    scale: 1.18,
    headColor: 0x5de8ff,
    bodyColor: 0x5848ff,
    accentColor: 0xffef5a,
    effect: "chaos",
  },
]);

export interface GameState {
  readonly seed: number;
  readonly rngState: number;
  readonly width: number;
  readonly height: number;
  readonly status: GameStatus;
  readonly snake: readonly Position[];
  readonly direction: Direction;
  readonly queuedDirection: Direction;
  readonly food: Food;
  readonly score: number;
  readonly eaten: number;
  readonly growthPending: number;
  readonly evolutionId: EvolutionId;
  readonly ticks: number;
  readonly elapsedMs: number;
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
      readonly points: number;
      readonly score: number;
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
  readonly food: Food;
  readonly score: number;
  readonly eaten: number;
  readonly growthPending: number;
  readonly evolutionId: EvolutionId;
  readonly evolutionName: string;
  readonly ticks: number;
  readonly tickMs: number;
  readonly elapsedMs: number;
}

const DEFAULT_SEED = 0x5eed_1234;
const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 16;
const MIN_WIDTH = 8;
const MIN_HEIGHT = 6;

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

function evolutionFor(eaten: number): Evolution {
  for (let index = EVOLUTIONS.length - 1; index >= 0; index -= 1) {
    const evolution = EVOLUTIONS[index];
    if (evolution && eaten >= evolution.minEaten) return evolution;
  }
  return EVOLUTIONS[0]!;
}

export function getEvolution(state: Pick<GameState, "eaten">): Evolution {
  return evolutionFor(state.eaten);
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
  const kindRoll = randomIndex(cellRoll.rngState, FOOD_KINDS.length);
  return {
    rngState: kindRoll.rngState,
    food: {
      kind: FOOD_KINDS[kindRoll.index]!,
      position: free[cellRoll.index]!,
    },
  };
}

export function createInitialState(
  seed = DEFAULT_SEED,
  options: GameOptions = {},
): GameState {
  const width = validateDimension(options.width, DEFAULT_WIDTH, MIN_WIDTH);
  const height = validateDimension(options.height, DEFAULT_HEIGHT, MIN_HEIGHT);
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
    food: spawned.food,
    score: 0,
    eaten: 0,
    growthPending: 0,
    evolutionId: EVOLUTIONS[0]!.id,
    ticks: 0,
    elapsedMs: 0,
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
  if (direction === OPPOSITE[state.direction]) return state;
  if (direction === state.queuedDirection) return state;
  return { ...state, queuedDirection: direction };
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
  collision: CollisionKind,
  at: Position,
  prefixEvents: readonly GameEvent[],
): StepResult {
  const ended: GameState = {
    ...state,
    status: "game-over",
    ticks: tick,
    elapsedMs: state.elapsedMs + getTickMs(state),
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
  const direction = state.queuedDirection;
  const vector = VECTORS[direction];
  const head = state.snake[0]!;
  const nextHead: Position = { x: head.x + vector.x, y: head.y + vector.y };
  const events: GameEvent[] = [...started.events];

  if (direction !== state.direction) {
    events.push({ type: "direction-changed", tick, direction });
  }
  if (collidesWithWall(nextHead, state.width, state.height)) {
    return gameOver(state, tick, "wall", nextHead, events);
  }

  const bodyThatRemains =
    state.growthPending > 0 ? state.snake : state.snake.slice(0, -1);
  if (bodyThatRemains.some((position) => samePosition(position, nextHead))) {
    return gameOver(state, tick, "self", nextHead, events);
  }

  const ate = samePosition(nextHead, state.food.position);
  const definition = ate ? FOOD_CATALOG[state.food.kind] : null;
  const growsThisTick = ate || state.growthPending > 0;
  const snake = growsThisTick
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];
  const score = state.score + (definition?.points ?? 0);
  const eaten = state.eaten + (ate ? 1 : 0);
  const pendingBeforeMovement = Math.max(0, state.growthPending - 1);
  const growthPending =
    pendingBeforeMovement + (definition ? definition.growth - 1 : 0);
  const evolution = evolutionFor(eaten);
  let rngState = state.rngState;
  let food = state.food;

  events.push({ type: "moved", tick, head: nextHead, length: snake.length });
  if (growsThisTick) {
    events.push({ type: "grew", tick, by: 1, length: snake.length });
  }
  if (definition) {
    events.push({
      type: "ate",
      tick,
      kind: definition.kind,
      points: definition.points,
      score,
      growth: definition.growth,
    });
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
      queuedDirection: direction,
      food,
      score,
      eaten,
      growthPending,
      evolutionId: evolution.id,
      ticks: tick,
      elapsedMs: state.elapsedMs + getTickMs(state),
    },
    events,
  };
}

export function getTickMs(state: Pick<GameState, "eaten">): number {
  return evolutionFor(state.eaten).tickMs;
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
    food: {
      kind: state.food.kind,
      position: { ...state.food.position },
    },
    score: state.score,
    eaten: state.eaten,
    growthPending: state.growthPending,
    evolutionId: evolution.id,
    evolutionName: evolution.name,
    ticks: state.ticks,
    tickMs: evolution.tickMs,
    elapsedMs: state.elapsedMs,
  };
}
