import { COUNTRIES, type CountryCode } from "./countries";
import type { Direction, Food, Position } from "./game";
import type { EffectiveGraphicsQuality } from "./preferences";
import {
  BIOMES,
  BOT_NAMES,
  BOT_PERSONALITIES,
  BOT_TIERS,
  WORLD_CONFIG,
  WORLD_EVENTS,
  type BiomeDefinition,
  type BiomeId,
  type BotPersonality,
  type BotTier,
  type DecorationKind,
  type WorldEventKind,
} from "./worldConfig";

const DIRECTIONS = Object.freeze(["up", "right", "down", "left"] as const);

const VECTORS: Readonly<Record<Direction, Position>> = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});

const OPPOSITE: Readonly<Record<Direction, Direction>> = Object.freeze({
  up: "down",
  right: "left",
  down: "up",
  left: "right",
});

export interface WorldDecoration {
  readonly x: number;
  readonly y: number;
  readonly kind: DecorationKind;
  readonly biomeId: BiomeId;
  readonly scale: number;
  readonly rotation: number;
}

export interface WorldBot {
  readonly id: string;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly tier: BotTier;
  readonly personality: BotPersonality;
  readonly snake: readonly Position[];
  readonly direction: Direction;
  readonly growthPending: number;
  readonly collected: number;
  readonly phase: number;
  readonly temporary: boolean;
}

export interface PortalPair {
  readonly a: Position;
  readonly b: Position;
}

export interface ActiveWorldEvent {
  readonly kind: WorldEventKind;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
  readonly portals?: PortalPair;
}

export interface WorldState {
  readonly seed: number;
  readonly rngState: number;
  readonly width: number;
  readonly height: number;
  readonly quality: EffectiveGraphicsQuality;
  readonly playerCountryCode: CountryCode;
  readonly bots: readonly WorldBot[];
  readonly decorations: readonly WorldDecoration[];
  readonly activeEvent: ActiveWorldEvent | null;
  readonly nextEventAtMs: number;
  readonly ticks: number;
}

export type WorldNotification =
  | {
      readonly type: "event-started";
      readonly kind: WorldEventKind;
      readonly name: string;
    }
  | { readonly type: "event-ended"; readonly kind: WorldEventKind }
  | {
      readonly type: "food-claimed";
      readonly botId: string;
      readonly botName: string;
      readonly countryCode: CountryCode;
    };

export interface WorldStepContext {
  readonly elapsedMs: number;
  readonly playerSnake: readonly Position[];
  readonly food: Food;
}

export interface WorldStepResult {
  readonly state: WorldState;
  readonly notifications: readonly WorldNotification[];
  readonly foodClaimedByBot: WorldBot | null;
}

export interface CreateWorldOptions {
  readonly width: number;
  readonly height: number;
  readonly quality: EffectiveGraphicsQuality;
  readonly playerCountryCode: CountryCode;
  readonly playerSnake: readonly Position[];
}

function normalizeSeed(seed: number): number {
  const normalized = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1;
  return normalized || 1;
}

function nextRandom(state: number): readonly [number, number] {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return [next || 1, next / 0x1_0000_0000];
}

function randomInteger(
  state: number,
  minimum: number,
  maximum: number,
): readonly [number, number] {
  const [next, value] = nextRandom(state);
  return [next, minimum + Math.floor(value * (maximum - minimum + 1))];
}

function key(position: Position): string {
  return `${position.x},${position.y}`;
}

function isInside(position: Position, width: number, height: number): boolean {
  return (
    position.x >= 0 &&
    position.x < width &&
    position.y >= 0 &&
    position.y < height
  );
}

function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildSnake(
  head: Position,
  direction: Direction,
  length: number,
): readonly Position[] {
  const vector = VECTORS[direction];
  return Array.from({ length }, (_, index) => ({
    x: head.x - vector.x * index,
    y: head.y - vector.y * index,
  }));
}

export function getBiomeAt(
  position: Position,
  width: number,
  height: number,
): BiomeDefinition {
  const right = position.x >= width / 2;
  const bottom = position.y >= height / 2;
  const index = (bottom ? 2 : 0) + (right ? 1 : 0);
  return BIOMES[index]!;
}

function createDecorations(
  seed: number,
  options: CreateWorldOptions,
): readonly [number, readonly WorldDecoration[]] {
  let rngState = seed;
  const amount = WORLD_CONFIG.decorations[options.quality];
  const decorations: WorldDecoration[] = [];
  for (let index = 0; index < amount; index += 1) {
    let xValue: number;
    let yValue: number;
    let kindIndex: number;
    [rngState, xValue] = randomInteger(rngState, 1, options.width - 2);
    [rngState, yValue] = randomInteger(rngState, 1, options.height - 2);
    const biome = getBiomeAt(
      { x: xValue, y: yValue },
      options.width,
      options.height,
    );
    [rngState, kindIndex] = randomInteger(
      rngState,
      0,
      biome.decorations.length - 1,
    );
    const [scaleState, scaleRandom] = nextRandom(rngState);
    const [rotationState, rotationRandom] = nextRandom(scaleState);
    rngState = rotationState;
    decorations.push({
      x: xValue + (scaleRandom - 0.5) * 0.55,
      y: yValue + (rotationRandom - 0.5) * 0.55,
      kind: biome.decorations[kindIndex]!,
      biomeId: biome.id,
      scale: 0.72 + scaleRandom * 0.48,
      rotation: (rotationRandom - 0.5) * 0.7,
    });
  }
  return [rngState, decorations];
}

function spawnBot(
  rngStateInput: number,
  index: number,
  options: CreateWorldOptions,
  occupiedInput: ReadonlySet<string>,
  temporary = false,
): readonly [number, WorldBot, ReadonlySet<string>] {
  let rngState = rngStateInput;
  const tierOrder: readonly BotTier[] = [
    "small",
    "medium",
    "small",
    "medium",
    "giant",
  ];
  const personalityOrder: readonly BotPersonality[] = [
    "balanced",
    "aggressive",
    "explorer",
    "coward",
  ];
  const tier = temporary ? "small" : tierOrder[index % tierOrder.length]!;
  const personality = temporary
    ? "aggressive"
    : personalityOrder[index % personalityOrder.length]!;
  const desiredLength = BOT_TIERS[tier].initialLength;
  let snake: readonly Position[] = [];
  let direction: Direction = "right";

  for (let attempt = 0; attempt < 120; attempt += 1) {
    let x: number;
    let y: number;
    let directionIndex: number;
    [rngState, x] = randomInteger(rngState, 1, options.width - 2);
    [rngState, y] = randomInteger(rngState, 1, options.height - 2);
    [rngState, directionIndex] = randomInteger(
      rngState,
      0,
      DIRECTIONS.length - 1,
    );
    direction = DIRECTIONS[directionIndex]!;
    const candidate = buildSnake({ x, y }, direction, desiredLength);
    if (
      candidate.every(
        (position) =>
          isInside(position, options.width, options.height) &&
          !occupiedInput.has(key(position)),
      )
    ) {
      snake = candidate;
      break;
    }
  }

  if (snake.length === 0) {
    const fallbackHead = {
      x: 1 + ((index * 3) % Math.max(2, options.width - 3)),
      y: index % 2 === 0 ? 1 : options.height - 2,
    };
    direction = index % 2 === 0 ? "right" : "left";
    snake = [fallbackHead];
  }

  const [countryState, countryIndex] = randomInteger(
    rngState,
    0,
    COUNTRIES.length - 1,
  );
  const [nameState, nameIndex] = randomInteger(
    countryState,
    0,
    BOT_NAMES.length - 1,
  );
  rngState = nameState;
  const occupied = new Set(occupiedInput);
  snake.forEach((position) => occupied.add(key(position)));
  const bot: WorldBot = {
    id: `${temporary ? "invader" : "bot"}-${index}`,
    name: BOT_NAMES[(nameIndex + index) % BOT_NAMES.length]!,
    countryCode: COUNTRIES[(countryIndex + index) % COUNTRIES.length]!.code,
    tier,
    personality,
    snake,
    direction,
    growthPending: 0,
    collected: 0,
    phase: index % BOT_TIERS[tier].moveEveryTicks,
    temporary,
  };
  return [rngState, bot, occupied];
}

function scheduleNextEvent(
  rngStateInput: number,
  elapsedMs: number,
): readonly [number, number] {
  const [rngState, random] = nextRandom(rngStateInput);
  const range =
    WORLD_CONFIG.eventDelay.maximumMs - WORLD_CONFIG.eventDelay.minimumMs;
  return [
    rngState,
    elapsedMs + WORLD_CONFIG.eventDelay.minimumMs + Math.round(random * range),
  ];
}

export function createWorldState(
  seed: number,
  options: CreateWorldOptions,
): WorldState {
  let rngState = normalizeSeed(seed ^ 0x9e37_79b9);
  const [decorationsState, decorations] = createDecorations(rngState, options);
  rngState = decorationsState;
  let occupied: ReadonlySet<string> = new Set(options.playerSnake.map(key));
  const bots: WorldBot[] = [];
  for (let index = 0; index < WORLD_CONFIG.bots[options.quality]; index += 1) {
    let bot: WorldBot;
    [rngState, bot, occupied] = spawnBot(rngState, index, options, occupied);
    bots.push(bot);
  }
  const [eventState, nextEventAtMs] = scheduleNextEvent(rngState, 0);
  rngState = eventState;
  return {
    seed: normalizeSeed(seed),
    rngState,
    width: options.width,
    height: options.height,
    quality: options.quality,
    playerCountryCode: options.playerCountryCode,
    bots,
    decorations,
    activeEvent: null,
    nextEventAtMs,
    ticks: 0,
  };
}

function createPortals(
  rngStateInput: number,
  width: number,
  height: number,
): readonly [number, PortalPair] {
  let rngState = rngStateInput;
  const padding = WORLD_CONFIG.portalPadding;
  const [axState, ax] = randomInteger(
    rngState,
    padding,
    Math.max(padding, width / 2 - 1),
  );
  const [ayState, ay] = randomInteger(axState, padding, height - padding - 1);
  const [bxState, bx] = randomInteger(
    ayState,
    Math.ceil(width / 2),
    width - padding - 1,
  );
  const [nextState, by] = randomInteger(bxState, padding, height - padding - 1);
  rngState = nextState;
  return [rngState, { a: { x: ax, y: ay }, b: { x: bx, y: by } }];
}

function beginEvent(
  state: WorldState,
  elapsedMs: number,
  playerSnake: readonly Position[],
): readonly [WorldState, WorldNotification] {
  let rngState = state.rngState;
  const kinds = Object.keys(WORLD_EVENTS) as WorldEventKind[];
  const [eventState, eventIndex] = randomInteger(rngState, 0, kinds.length - 1);
  rngState = eventState;
  const kind = kinds[eventIndex]!;
  let portals: PortalPair | undefined;
  if (kind === "portals")
    [rngState, portals] = createPortals(rngState, state.width, state.height);

  let bots = state.bots;
  if (kind === "bot-invasion") {
    let occupied: ReadonlySet<string> = new Set([
      ...playerSnake.map(key),
      ...bots.flatMap((bot) => bot.snake.map(key)),
    ]);
    const additions: WorldBot[] = [];
    const options: CreateWorldOptions = {
      width: state.width,
      height: state.height,
      quality: state.quality,
      playerCountryCode: state.playerCountryCode,
      playerSnake,
    };
    for (let index = 0; index < WORLD_CONFIG.bots.invasionExtra; index += 1) {
      let bot: WorldBot;
      [rngState, bot, occupied] = spawnBot(
        rngState,
        state.bots.length + index,
        options,
        occupied,
        true,
      );
      additions.push(bot);
    }
    bots = [...bots, ...additions].slice(0, WORLD_CONFIG.bots.maximum);
  }

  const definition = WORLD_EVENTS[kind];
  return [
    {
      ...state,
      rngState,
      bots,
      activeEvent: {
        kind,
        startedAtMs: elapsedMs,
        endsAtMs: elapsedMs + definition.durationMs,
        ...(portals ? { portals } : {}),
      },
    },
    { type: "event-started", kind, name: definition.name },
  ];
}

function endEvent(
  state: WorldState,
  elapsedMs: number,
): readonly [WorldState, WorldNotification] {
  const kind = state.activeEvent!.kind;
  const [rngState, nextEventAtMs] = scheduleNextEvent(
    state.rngState,
    elapsedMs,
  );
  return [
    {
      ...state,
      rngState,
      bots: state.bots.filter((bot) => !bot.temporary),
      activeEvent: null,
      nextEventAtMs,
    },
    { type: "event-ended", kind },
  ];
}

function chooseDirection(
  bot: WorldBot,
  state: WorldState,
  context: WorldStepContext,
  occupiedByBots: ReadonlySet<string>,
  rngStateInput: number,
): readonly [number, Direction | null] {
  let rngState = rngStateInput;
  const profile = BOT_PERSONALITIES[bot.personality];
  const head = bot.snake[0]!;
  const playerHead = context.playerSnake[0]!;
  const ownTail = key(bot.snake.at(-1)!);
  const ownBody = new Set(bot.snake.slice(0, -1).map(key));
  let best: { direction: Direction; score: number } | null = null;

  for (const direction of DIRECTIONS) {
    if (direction === OPPOSITE[bot.direction]) continue;
    const vector = VECTORS[direction];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    if (!isInside(next, state.width, state.height) || ownBody.has(key(next)))
      continue;
    if (occupiedByBots.has(key(next)) && key(next) !== ownTail) continue;
    if (context.playerSnake.some((position) => key(position) === key(next)))
      continue;

    const wallDistance = Math.min(
      next.x,
      next.y,
      state.width - 1 - next.x,
      state.height - 1 - next.y,
    );
    const playerDistance = distance(next, playerHead);
    const foodDistance = distance(next, context.food.position);
    const nearbyThreats = context.playerSnake.filter(
      (position) => distance(next, position) <= WORLD_CONFIG.dangerRadius,
    ).length;
    const [nextRngState, noise] = nextRandom(rngState);
    rngState = nextRngState;
    let score =
      wallDistance * profile.safetyWeight -
      foodDistance * profile.foodWeight +
      playerDistance * profile.playerDistanceWeight +
      noise * profile.wanderWeight -
      nearbyThreats * profile.safetyWeight * 3;
    if (direction === bot.direction) score += 0.5;
    if (state.activeEvent?.kind === "chaos-mode") score += noise * 4;
    if (!best || score > best.score) best = { direction, score };
  }
  return [rngState, best?.direction ?? null];
}

function teleportIfNeeded(
  bot: WorldBot,
  event: ActiveWorldEvent | null,
  width: number,
  height: number,
): WorldBot {
  if (event?.kind !== "portals" || !event.portals) return bot;
  const head = bot.snake[0]!;
  const destination =
    key(head) === key(event.portals.a)
      ? event.portals.b
      : key(head) === key(event.portals.b)
        ? event.portals.a
        : null;
  if (!destination) return bot;
  const delta = { x: destination.x - head.x, y: destination.y - head.y };
  const teleportedSnake = bot.snake.map((position) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
  }));
  if (!teleportedSnake.every((position) => isInside(position, width, height))) {
    return bot;
  }
  return {
    ...bot,
    snake: teleportedSnake,
  };
}

export function stepWorld(
  inputState: WorldState,
  context: WorldStepContext,
): WorldStepResult {
  let state = inputState;
  const notifications: WorldNotification[] = [];
  if (state.activeEvent && context.elapsedMs >= state.activeEvent.endsAtMs) {
    let notification: WorldNotification;
    [state, notification] = endEvent(state, context.elapsedMs);
    notifications.push(notification);
  }
  if (!state.activeEvent && context.elapsedMs >= state.nextEventAtMs) {
    let notification: WorldNotification;
    [state, notification] = beginEvent(
      state,
      context.elapsedMs,
      context.playerSnake,
    );
    notifications.push(notification);
  }

  let rngState = state.rngState;
  const allBotPositions = new Set(
    state.bots.flatMap((bot) => bot.snake.map(key)),
  );
  const foodClaims: WorldBot[] = [];
  const bots = state.bots.map((bot) => {
    const interval = BOT_TIERS[bot.tier].moveEveryTicks;
    if ((state.ticks + bot.phase) % interval !== 0) return bot;
    bot.snake.forEach((position) => allBotPositions.delete(key(position)));
    let direction: Direction | null;
    [rngState, direction] = chooseDirection(
      bot,
      state,
      context,
      allBotPositions,
      rngState,
    );
    if (!direction) {
      bot.snake.forEach((position) => allBotPositions.add(key(position)));
      return bot;
    }
    const vector = VECTORS[direction];
    const head = bot.snake[0]!;
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const claimed =
      foodClaims.length === 0 && key(nextHead) === key(context.food.position);
    const keepTail = bot.growthPending > 0 || claimed;
    const moved: WorldBot = teleportIfNeeded(
      {
        ...bot,
        direction,
        snake: [nextHead, ...(keepTail ? bot.snake : bot.snake.slice(0, -1))],
        growthPending: Math.max(0, bot.growthPending - 1) + (claimed ? 1 : 0),
        collected: bot.collected + (claimed ? 1 : 0),
      },
      state.activeEvent,
      state.width,
      state.height,
    );
    moved.snake.forEach((position) => allBotPositions.add(key(position)));
    if (claimed) foodClaims.push(moved);
    return moved;
  });

  const foodClaimedByBot = foodClaims[0] ?? null;

  if (foodClaimedByBot) {
    notifications.push({
      type: "food-claimed",
      botId: foodClaimedByBot.id,
      botName: foodClaimedByBot.name,
      countryCode: foodClaimedByBot.countryCode,
    });
  }

  return {
    state: { ...state, rngState, bots, ticks: state.ticks + 1 },
    notifications,
    foodClaimedByBot,
  };
}

export function occupiedByWorld(state: WorldState): readonly Position[] {
  return state.bots.flatMap((bot) => bot.snake);
}

export function worldEventName(kind: WorldEventKind): string {
  return WORLD_EVENTS[kind].name;
}

export function botEvolutionName(bot: WorldBot): string {
  if (bot.tier === "giant" || bot.snake.length >= 12) return "Monstruo Meme";
  if (bot.tier === "medium" || bot.snake.length >= 7)
    return "Gusano Legendario";
  return "Mini Bicho";
}
