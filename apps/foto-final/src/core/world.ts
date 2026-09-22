import { COUNTRIES, type CountryCode } from "./countries";
import {
  FOOD_CATALOG,
  selectFoodKind,
  type Direction,
  type Food,
  type FoodKind,
  type Position,
} from "./game";
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
const TIER_RANK: Readonly<Record<BotTier, number>> = Object.freeze({
  small: 0,
  medium: 1,
  giant: 2,
});
const NORMAL_DROP_KINDS = Object.freeze([
  "flying-pizza",
  "angry-emoji",
  "sad-sock",
  "influencer-avocado",
] as const satisfies readonly FoodKind[]);
const RARE_DROP_KINDS = Object.freeze([
  "lost-robot",
  "duck-king",
  "cringe-energy",
  "infinite-coffee",
] as const satisfies readonly FoodKind[]);

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
  readonly invulnerableUntilMs: number;
}

export interface WorldDrop {
  readonly id: string;
  readonly position: Position;
  readonly kind: FoodKind;
  readonly points: number;
  readonly experience: number;
  readonly growth: number;
  readonly source: "ambient" | "remains";
  readonly expiresAtMs: number;
}

export interface WorldDeath {
  readonly id: string;
  readonly position: Position;
  readonly tier: BotTier;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly startedAtMs: number;
  readonly endsAtMs: number;
}

interface BotRespawn {
  readonly tier: BotTier;
  readonly dueAtMs: number;
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
  readonly drops: readonly WorldDrop[];
  readonly deaths: readonly WorldDeath[];
  readonly respawns: readonly BotRespawn[];
  readonly activeEvent: ActiveWorldEvent | null;
  readonly nextEventAtMs: number;
  readonly nextBotId: number;
  readonly nextDropId: number;
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
    }
  | {
      readonly type: "bot-eliminated";
      readonly botId: string;
      readonly botName: string;
      readonly countryCode: CountryCode;
      readonly tier: BotTier;
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
  readonly playerCollision: WorldBot | null;
  readonly collectedDrops: readonly WorldDrop[];
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

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
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
    let x: number;
    let y: number;
    let kindIndex: number;
    [rngState, x] = randomInteger(rngState, 1, options.width - 2);
    [rngState, y] = randomInteger(rngState, 1, options.height - 2);
    const biome = getBiomeAt({ x, y }, options.width, options.height);
    [rngState, kindIndex] = randomInteger(
      rngState,
      0,
      biome.decorations.length - 1,
    );
    const [scaleState, scaleRandom] = nextRandom(rngState);
    const [rotationState, rotationRandom] = nextRandom(scaleState);
    rngState = rotationState;
    decorations.push({
      x: x + (scaleRandom - 0.5) * 0.7,
      y: y + (rotationRandom - 0.5) * 0.7,
      kind: biome.decorations[kindIndex]!,
      biomeId: biome.id,
      scale: 0.68 + scaleRandom * 0.6,
      rotation: (rotationRandom - 0.5) * 0.8,
    });
  }
  return [rngState, decorations];
}

function spawnBot(
  rngStateInput: number,
  sequence: number,
  options: CreateWorldOptions,
  occupiedInput: ReadonlySet<string>,
  elapsedMs: number,
  temporary = false,
  forcedTier?: BotTier,
): readonly [number, WorldBot, ReadonlySet<string>] {
  let rngState = rngStateInput;
  const tiers: readonly BotTier[] = [
    "small",
    "medium",
    "small",
    "medium",
    "giant",
  ];
  const personalities: readonly BotPersonality[] = [
    "explorer",
    "balanced",
    "aggressive",
    "coward",
  ];
  const tier =
    forcedTier ?? (temporary ? "small" : tiers[sequence % tiers.length]!);
  const personality = temporary
    ? "aggressive"
    : personalities[sequence % personalities.length]!;
  const desiredLength = BOT_TIERS[tier].initialLength;
  let snake: readonly Position[] = [];
  let direction: Direction = "right";

  for (let attempt = 0; attempt < 160; attempt += 1) {
    let x: number;
    let y: number;
    let directionIndex: number;
    [rngState, x] = randomInteger(rngState, 2, options.width - 3);
    [rngState, y] = randomInteger(rngState, 2, options.height - 3);
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
    snake = [{ x: 2 + (sequence % (options.width - 4)), y: 2 }];
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
  return [
    rngState,
    {
      id: `${temporary ? "invader" : "bot"}-${sequence}`,
      name: BOT_NAMES[(nameIndex + sequence) % BOT_NAMES.length]!,
      countryCode:
        COUNTRIES[(countryIndex + sequence) % COUNTRIES.length]!.code,
      tier,
      personality,
      snake,
      direction,
      growthPending: 0,
      collected: 0,
      phase: sequence % BOT_TIERS[tier].moveEveryTicks,
      temporary,
      invulnerableUntilMs: elapsedMs + WORLD_CONFIG.spawnProtectionMs,
    },
    occupied,
  ];
}

function rewardFor(
  kind: FoodKind,
  source: WorldDrop["source"],
  tier?: BotTier,
) {
  const food = FOOD_CATALOG[kind];
  const scale =
    source === "ambient"
      ? 0.7
      : tier === "giant"
        ? 1
        : tier === "medium"
          ? 0.65
          : 0.42;
  return {
    points: Math.max(5, Math.round(food.points * scale)),
    experience: Math.max(1, Math.round(food.experience * scale)),
    growth:
      source === "remains" && tier === "giant" ? Math.min(2, food.growth) : 1,
  };
}

function createAmbientDrops(
  rngStateInput: number,
  startId: number,
  amount: number,
  width: number,
  height: number,
  occupied: ReadonlySet<string>,
  elapsedMs: number,
): readonly [number, readonly WorldDrop[], number] {
  let rngState = rngStateInput;
  let nextId = startId;
  const used = new Set(occupied);
  const drops: WorldDrop[] = [];
  for (let index = 0; index < amount; index += 1) {
    let x = 1;
    let y = 1;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      [rngState, x] = randomInteger(rngState, 1, width - 2);
      [rngState, y] = randomInteger(rngState, 1, height - 2);
      if (!used.has(`${x},${y}`)) break;
    }
    const [kindState, kindRoll] = nextRandom(rngState);
    rngState = kindState;
    const kind = selectFoodKind(kindRoll);
    drops.push({
      id: `drop-${nextId}`,
      position: { x, y },
      kind,
      ...rewardFor(kind, "ambient"),
      source: "ambient",
      expiresAtMs: elapsedMs + WORLD_CONFIG.drops.lifetimeMs * 3,
    });
    nextId += 1;
    used.add(`${x},${y}`);
  }
  return [rngState, drops, nextId];
}

function deathDropKind(tier: BotTier, index: number): FoodKind {
  if (tier === "giant" && index === 0) return "legendary-potato";
  if (tier !== "small" && index % 3 === 0) {
    return RARE_DROP_KINDS[index % RARE_DROP_KINDS.length]!;
  }
  return NORMAL_DROP_KINDS[index % NORMAL_DROP_KINDS.length]!;
}

function createDeathDrops(
  rngStateInput: number,
  startId: number,
  bot: WorldBot,
  width: number,
  height: number,
  elapsedMs: number,
): readonly [number, readonly WorldDrop[], number] {
  let rngState = rngStateInput;
  let nextId = startId;
  const count =
    bot.tier === "giant"
      ? WORLD_CONFIG.drops.giantCount
      : bot.tier === "medium"
        ? WORLD_CONFIG.drops.mediumCount
        : WORLD_CONFIG.drops.smallCount;
  const drops: WorldDrop[] = [];
  for (let index = 0; index < count; index += 1) {
    const anchor = bot.snake[Math.floor((index / count) * bot.snake.length)]!;
    let offsetX: number;
    let offsetY: number;
    [rngState, offsetX] = randomInteger(rngState, -1, 1);
    [rngState, offsetY] = randomInteger(rngState, -1, 1);
    const position = {
      x: Math.max(0, Math.min(width - 1, anchor.x + offsetX)),
      y: Math.max(0, Math.min(height - 1, anchor.y + offsetY)),
    };
    const kind = deathDropKind(bot.tier, index);
    drops.push({
      id: `drop-${nextId}`,
      position,
      kind,
      ...rewardFor(kind, "remains", bot.tier),
      source: "remains",
      expiresAtMs: elapsedMs + WORLD_CONFIG.drops.lifetimeMs,
    });
    nextId += 1;
  }
  return [rngState, drops, nextId];
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
  let nextBotId = 0;
  for (let index = 0; index < WORLD_CONFIG.bots[options.quality]; index += 1) {
    let bot: WorldBot;
    [rngState, bot, occupied] = spawnBot(
      rngState,
      nextBotId,
      options,
      occupied,
      0,
    );
    bots.push(bot);
    nextBotId += 1;
  }
  const ambientAmount =
    options.quality === "normal"
      ? WORLD_CONFIG.drops.ambientNormal
      : WORLD_CONFIG.drops.ambientReduced;
  const [dropsState, drops, nextDropId] = createAmbientDrops(
    rngState,
    0,
    ambientAmount,
    options.width,
    options.height,
    occupied,
    0,
  );
  rngState = dropsState;
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
    drops,
    deaths: [],
    respawns: [],
    activeEvent: null,
    nextEventAtMs,
    nextBotId,
    nextDropId,
    ticks: 0,
  };
}

function createPortals(
  rngStateInput: number,
  width: number,
  height: number,
): readonly [number, PortalPair] {
  const padding = WORLD_CONFIG.portalPadding;
  let rngState: number;
  let randomValue: number;
  [rngState, randomValue] = randomInteger(
    rngStateInput,
    padding,
    Math.floor(width / 2) - padding,
  );
  const ax = randomValue;
  [rngState, randomValue] = randomInteger(
    rngState,
    padding,
    height - padding - 1,
  );
  const ay = randomValue;
  [rngState, randomValue] = randomInteger(
    rngState,
    Math.ceil(width / 2) + padding,
    width - padding - 1,
  );
  const bx = randomValue;
  [rngState, randomValue] = randomInteger(
    rngState,
    padding,
    height - padding - 1,
  );
  const by = randomValue;
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
  if (kind === "portals") {
    [rngState, portals] = createPortals(rngState, state.width, state.height);
  }
  let bots = state.bots;
  let nextBotId = state.nextBotId;
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
        nextBotId,
        options,
        occupied,
        elapsedMs,
        true,
      );
      additions.push(bot);
      nextBotId += 1;
    }
    bots = [...bots, ...additions].slice(0, WORLD_CONFIG.bots.maximum);
  }
  const definition = WORLD_EVENTS[kind];
  return [
    {
      ...state,
      rngState,
      bots,
      nextBotId,
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

function targetFor(bot: WorldBot, state: WorldState, food: Food): Position {
  const head = bot.snake[0]!;
  let target = food.position;
  let targetDistance = distance(head, target);
  for (const drop of state.drops) {
    const dropDistance = distance(head, drop.position);
    const bonus = drop.source === "remains" ? 4 : 0;
    if (dropDistance - bonus < targetDistance) {
      target = drop.position;
      targetDistance = dropDistance;
    }
  }
  return target;
}

function chooseDirection(
  bot: WorldBot,
  state: WorldState,
  context: WorldStepContext,
  fatalPositions: ReadonlySet<string>,
  rngStateInput: number,
): readonly [number, Direction | null] {
  let rngState = rngStateInput;
  const profile = BOT_PERSONALITIES[bot.personality];
  const head = bot.snake[0]!;
  const playerHead = context.playerSnake[0]!;
  const target = targetFor(bot, state, context.food);
  let best: { direction: Direction; score: number } | null = null;

  for (const direction of DIRECTIONS) {
    if (direction === OPPOSITE[bot.direction]) continue;
    const vector = VECTORS[direction];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    if (!isInside(next, state.width, state.height)) continue;
    const wallDistance = Math.min(
      next.x,
      next.y,
      state.width - 1 - next.x,
      state.height - 1 - next.y,
    );
    const playerDistance = distance(next, playerHead);
    const targetDistance = distance(next, target);
    const [nextRngState, noise] = nextRandom(rngState);
    rngState = nextRngState;
    const isFatal =
      fatalPositions.has(key(next)) &&
      context.elapsedMs >= bot.invulnerableUntilMs;
    const smallerOpportunity = state.bots.reduce((closest, candidate) => {
      if (
        candidate.id === bot.id ||
        TIER_RANK[candidate.tier] >= TIER_RANK[bot.tier]
      ) {
        return closest;
      }
      return Math.min(closest, distance(next, candidate.snake[0]!));
    }, Number.POSITIVE_INFINITY);
    const biggerThreats = state.bots.filter(
      (candidate) =>
        candidate.id !== bot.id &&
        TIER_RANK[candidate.tier] > TIER_RANK[bot.tier] &&
        distance(next, candidate.snake[0]!) <= 5,
    ).length;
    let score =
      wallDistance * profile.safetyWeight -
      targetDistance * profile.foodWeight +
      playerDistance * profile.playerDistanceWeight +
      noise * profile.wanderWeight -
      biggerThreats * profile.safetyWeight * 5 -
      (Number.isFinite(smallerOpportunity) && bot.tier === "giant"
        ? smallerOpportunity * 0.28
        : 0) -
      (isFatal ? 1_000 : 0);
    if (direction === bot.direction) score += bot.tier === "small" ? 0.2 : 0.8;
    if (state.activeEvent?.kind === "chaos-mode") score += noise * 4;
    if (!best || score > best.score) best = { direction, score };
  }
  return [rngState, best?.direction ?? null];
}

function teleportIfNeeded(bot: WorldBot, state: WorldState): WorldBot {
  const event = state.activeEvent;
  if (event?.kind !== "portals" || !event.portals) return bot;
  const head = bot.snake[0]!;
  const destination = samePosition(head, event.portals.a)
    ? event.portals.b
    : samePosition(head, event.portals.b)
      ? event.portals.a
      : null;
  if (!destination) return bot;
  const delta = { x: destination.x - head.x, y: destination.y - head.y };
  const snake = bot.snake.map((position) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
  }));
  return snake.every((position) =>
    isInside(position, state.width, state.height),
  )
    ? { ...bot, snake }
    : bot;
}

function bodyPositions(
  state: WorldState,
  playerSnake: readonly Position[],
  excludedBotId?: string,
): ReadonlySet<string> {
  return new Set([
    ...playerSnake.slice(1).map(key),
    ...state.bots
      .filter((bot) => bot.id !== excludedBotId)
      .flatMap((bot) => bot.snake.slice(1).map(key)),
  ]);
}

function ensureAmbientDrops(
  state: WorldState,
  rngStateInput: number,
  dropsInput: readonly WorldDrop[],
  nextDropIdInput: number,
  elapsedMs: number,
  playerSnake: readonly Position[],
): readonly [number, readonly WorldDrop[], number] {
  const target =
    state.quality === "normal"
      ? WORLD_CONFIG.drops.ambientNormal
      : WORLD_CONFIG.drops.ambientReduced;
  const ambientCount = dropsInput.filter(
    (drop) => drop.source === "ambient",
  ).length;
  const amount = Math.min(
    target - ambientCount,
    WORLD_CONFIG.drops.maximum - dropsInput.length,
  );
  if (amount <= 0) return [rngStateInput, dropsInput, nextDropIdInput];
  const occupied = new Set([
    ...playerSnake.map(key),
    ...state.bots.flatMap((bot) => bot.snake.map(key)),
    ...dropsInput.map((drop) => key(drop.position)),
  ]);
  // Durante el escudo inicial dejamos espacio para que el jugador entienda
  // los controles y alcance el primer alimento sin que un bot o un resto le
  // robe la ruta inmediata.
  if (elapsedMs < WORLD_CONFIG.spawnProtectionMs + 1_000) {
    const head = playerSnake[0]!;
    for (let y = head.y - 8; y <= head.y + 8; y += 1) {
      for (let x = head.x - 8; x <= head.x + 8; x += 1) {
        if (isInside({ x, y }, state.width, state.height))
          occupied.add(`${x},${y}`);
      }
    }
  }
  const [rngState, additions, nextDropId] = createAmbientDrops(
    rngStateInput,
    nextDropIdInput,
    amount,
    state.width,
    state.height,
    occupied,
    elapsedMs,
  );
  return [rngState, [...dropsInput, ...additions], nextDropId];
}

export function stepWorld(
  inputState: WorldState,
  context: WorldStepContext,
): WorldStepResult {
  let state: WorldState = {
    ...inputState,
    drops: inputState.drops.filter(
      (drop) => drop.expiresAtMs > context.elapsedMs,
    ),
    deaths: inputState.deaths.filter(
      (death) => death.endsAtMs > context.elapsedMs,
    ),
  };
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
  let nextBotId = state.nextBotId;
  let nextDropId = state.nextDropId;
  let drops = [...state.drops];
  const deaths = [...state.deaths];
  const respawns = state.respawns.filter(
    (respawn) => respawn.dueAtMs > context.elapsedMs,
  );
  const bots = [...state.bots];
  const dueRespawns = state.respawns.filter(
    (respawn) => respawn.dueAtMs <= context.elapsedMs,
  );
  let occupied: ReadonlySet<string> = new Set([
    ...context.playerSnake.map(key),
    ...bots.flatMap((bot) => bot.snake.map(key)),
  ]);
  const options: CreateWorldOptions = {
    width: state.width,
    height: state.height,
    quality: state.quality,
    playerCountryCode: state.playerCountryCode,
    playerSnake: context.playerSnake,
  };
  for (const respawn of dueRespawns) {
    let bot: WorldBot;
    [rngState, bot, occupied] = spawnBot(
      rngState,
      nextBotId,
      options,
      occupied,
      context.elapsedMs,
      false,
      respawn.tier,
    );
    bots.push(bot);
    nextBotId += 1;
  }
  state = { ...state, bots };

  const playerHead = context.playerSnake[0]!;
  const playerCollision =
    context.elapsedMs < WORLD_CONFIG.spawnProtectionMs
      ? null
      : (bots.find((bot) =>
          bot.snake
            .slice(1)
            .some((position) => samePosition(position, playerHead)),
        ) ?? null);
  const mainFoodClaims: WorldBot[] = [];
  const claimedDropIds = new Set<string>();
  const survivors: WorldBot[] = [];

  for (const bot of bots) {
    // Un gusano puede cruzar su propia estela. Solo la cabeza contra el cuerpo
    // de un rival es mortal, exactamente igual que para el jugador.
    const fatalPositions = bodyPositions(state, context.playerSnake, bot.id);
    const baseInterval = BOT_TIERS[bot.tier].moveEveryTicks;
    const far =
      distance(bot.snake[0]!, playerHead) > WORLD_CONFIG.distantBotThreshold;
    const interval = baseInterval * (far ? 2 : 1);
    if ((state.ticks + bot.phase) % interval !== 0) {
      survivors.push(bot);
      continue;
    }
    let direction: Direction | null;
    [rngState, direction] = chooseDirection(
      bot,
      state,
      context,
      fatalPositions,
      rngState,
    );
    if (!direction) {
      survivors.push(bot);
      continue;
    }
    const vector = VECTORS[direction];
    const head = bot.snake[0]!;
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const collided =
      fatalPositions.has(key(nextHead)) &&
      context.elapsedMs >= bot.invulnerableUntilMs;
    if (collided) {
      let additions: readonly WorldDrop[];
      [rngState, additions, nextDropId] = createDeathDrops(
        rngState,
        nextDropId,
        bot,
        state.width,
        state.height,
        context.elapsedMs,
      );
      drops = [...drops, ...additions].slice(-WORLD_CONFIG.drops.maximum);
      deaths.push({
        id: `death-${bot.id}-${state.ticks}`,
        position: nextHead,
        tier: bot.tier,
        name: bot.name,
        countryCode: bot.countryCode,
        startedAtMs: context.elapsedMs,
        endsAtMs: context.elapsedMs + 1_100,
      });
      if (!bot.temporary) {
        respawns.push({
          tier: bot.tier,
          dueAtMs: context.elapsedMs + WORLD_CONFIG.drops.respawnDelayMs,
        });
      }
      notifications.push({
        type: "bot-eliminated",
        botId: bot.id,
        botName: bot.name,
        countryCode: bot.countryCode,
        tier: bot.tier,
      });
      continue;
    }

    const drop = drops.find(
      (candidate) =>
        !claimedDropIds.has(candidate.id) &&
        samePosition(candidate.position, nextHead),
    );
    const claimedMainFood =
      mainFoodClaims.length === 0 &&
      distance(context.food.position, playerHead) > 12 &&
      samePosition(nextHead, context.food.position);
    const wantsGrowth =
      Boolean(drop) || claimedMainFood || bot.growthPending > 0;
    const canGrow = bot.snake.length < BOT_TIERS[bot.tier].maximumLength;
    const moved = teleportIfNeeded(
      {
        ...bot,
        direction,
        snake: [
          nextHead,
          ...(wantsGrowth && canGrow ? bot.snake : bot.snake.slice(0, -1)),
        ],
        growthPending:
          Math.max(0, bot.growthPending - 1) +
          (drop
            ? drop.growth
            : claimedMainFood
              ? FOOD_CATALOG[context.food.kind].growth
              : 0),
        collected: bot.collected + (drop || claimedMainFood ? 1 : 0),
      },
      state,
    );
    if (drop) claimedDropIds.add(drop.id);
    if (claimedMainFood) mainFoodClaims.push(moved);
    survivors.push(moved);
  }

  drops = drops.filter((drop) => !claimedDropIds.has(drop.id));
  const collectedDrops = drops.filter((drop) =>
    samePosition(drop.position, playerHead),
  );
  const playerDropIds = new Set(collectedDrops.map((drop) => drop.id));
  drops = drops.filter((drop) => !playerDropIds.has(drop.id));
  const [ambientState, ensuredDrops, ensuredNextDropId] = ensureAmbientDrops(
    { ...state, bots: survivors },
    rngState,
    drops,
    nextDropId,
    context.elapsedMs,
    context.playerSnake,
  );
  rngState = ambientState;
  drops = [...ensuredDrops];
  nextDropId = ensuredNextDropId;

  const foodClaimedByBot = mainFoodClaims[0] ?? null;
  if (foodClaimedByBot) {
    notifications.push({
      type: "food-claimed",
      botId: foodClaimedByBot.id,
      botName: foodClaimedByBot.name,
      countryCode: foodClaimedByBot.countryCode,
    });
  }

  return {
    state: {
      ...state,
      rngState,
      bots: survivors,
      drops,
      deaths,
      respawns,
      nextBotId,
      nextDropId,
      ticks: state.ticks + 1,
    },
    notifications,
    foodClaimedByBot,
    playerCollision,
    collectedDrops,
  };
}

export function occupiedByWorld(state: WorldState): readonly Position[] {
  return [
    ...state.bots.flatMap((bot) => bot.snake),
    ...state.drops.map((drop) => drop.position),
  ];
}

export function worldEventName(kind: WorldEventKind): string {
  return WORLD_EVENTS[kind].name;
}

export function botEvolutionName(bot: WorldBot): string {
  if (bot.tier === "giant" || bot.snake.length >= 12) return "Monstruo Meme";
  if (bot.tier === "medium" || bot.snake.length >= 7) {
    return "Gusano Legendario";
  }
  return "Mini Bicho";
}
