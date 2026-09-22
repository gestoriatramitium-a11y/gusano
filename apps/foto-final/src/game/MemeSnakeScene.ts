import Phaser from "phaser";

import {
  EVOLUTIONS,
  FOOD_CATALOG,
  collectExternalReward,
  createInitialState,
  createSnapshot,
  endFromEnemyCollision,
  getEvolution,
  getTickMs,
  queueDirection,
  relocateFood,
  start,
  step,
  type Direction,
  type FoodKind,
  type FoodRarity,
  type GameEvent,
  type GameSnapshot,
  type GameState,
  type Position,
} from "../core/game";
import { getCountry, type CountryCode } from "../core/countries";
import type {
  EffectiveGraphicsQuality,
  GraphicsQualityPreference,
} from "../core/preferences";
import {
  botEvolutionName,
  createWorldState,
  occupiedByWorld,
  stepWorld,
  type WorldNotification,
  type WorldState,
} from "../core/world";
import {
  BIOMES,
  BOT_TIERS,
  WORLD_CONFIG,
  WORLD_EVENTS,
} from "../core/worldConfig";
import {
  createSmoothSnakePath,
  directionAlongPath,
  interpolateSnakeAnchors,
} from "./snakeVisuals";
import {
  createWorldMetrics,
  positionToWorldPixels,
  type WorldMetrics,
} from "./worldCamera";

interface SceneCallbacks {
  onEvent(event: GameEvent): void;
  onSnapshot(snapshot: GameSnapshot): void;
  onQualityChange(quality: EffectiveGraphicsQuality): void;
  onWorldEvent(event: WorldNotification): void;
}

interface SceneOptions extends SceneCallbacks {
  readonly qualityPreference: GraphicsQualityPreference;
  readonly initialQuality: EffectiveGraphicsQuality;
  readonly reduceMotion: boolean;
  readonly playerCountryCode: CountryCode;
}

const FOOD_GLYPHS: Readonly<Record<FoodKind, string>> = {
  "legendary-potato": "🥔",
  "flying-pizza": "🍕",
  "lost-robot": "🤖",
  "angry-emoji": "😡",
  "sad-sock": "🧦",
  "duck-king": "👑",
  "cringe-energy": "⚡",
  "influencer-avocado": "🥑",
  "infinite-coffee": "☕",
  "super-meme": "★",
};

const RARITY_LABELS: Readonly<Record<FoodRarity, string>> = {
  normal: "● COMÚN",
  rare: "◆ RARA",
  legendary: "★ LEGENDARIA",
};

const KEY_TO_DIRECTION: Readonly<Record<string, Direction>> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

export class MemeSnakeScene extends Phaser.Scene {
  private readonly callbacks: SceneCallbacks;
  private state: GameState = createInitialState();
  private previousSnake: readonly Position[] = this.state.snake;
  private boardGraphics?: Phaser.GameObjects.Graphics;
  private environmentGraphics?: Phaser.GameObjects.Graphics;
  private worldEffectsGraphics?: Phaser.GameObjects.Graphics;
  private botGraphics?: Phaser.GameObjects.Graphics;
  private snakeGraphics?: Phaser.GameObjects.Graphics;
  private foodGraphics?: Phaser.GameObjects.Graphics;
  private foodGlyph?: Phaser.GameObjects.Text;
  private foodLabel?: Phaser.GameObjects.Text;
  private readonly botLabels = new Map<string, Phaser.GameObjects.Text>();
  private readonly biomeLabels: Phaser.GameObjects.Text[] = [];
  private cameraTarget?: Phaser.GameObjects.Zone;
  private environmentViewportKey = "";
  private accumulatorMs = 0;
  private pointerStart: Position | null = null;
  private pausedUntil = 0;
  private eatPulseUntil = 0;
  private qualityPreference: GraphicsQualityPreference;
  private effectiveQuality: EffectiveGraphicsQuality;
  private reduceMotion: boolean;
  private frameTimeTotal = 0;
  private frameSampleCount = 0;
  private userPaused = false;
  private readonly playerCountryCode: CountryCode;
  private world: WorldState;
  private previousWorld: WorldState;

  constructor(options: SceneOptions) {
    super({ key: "meme-snake" });
    this.callbacks = options;
    this.qualityPreference = options.qualityPreference;
    this.effectiveQuality = options.initialQuality;
    this.reduceMotion = options.reduceMotion;
    this.playerCountryCode = options.playerCountryCode;
    this.world = createWorldState(1, {
      width: this.state.width,
      height: this.state.height,
      quality: options.initialQuality,
      playerCountryCode: options.playerCountryCode,
      playerSnake: this.state.snake,
    });
    this.previousWorld = this.world;
  }

  create(): void {
    this.boardGraphics = this.add.graphics();
    this.environmentGraphics = this.add.graphics();
    this.worldEffectsGraphics = this.add.graphics();
    this.botGraphics = this.add.graphics();
    this.foodGraphics = this.add.graphics();
    this.snakeGraphics = this.add.graphics();
    this.foodGlyph = this.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.foodLabel = this.add
      .text(0, 0, "", {
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        backgroundColor: "#160d32dd",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5, 1);
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.code];
      if (!direction) return;
      event.preventDefault();
      this.changeDirection(direction);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pointerStart = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerStart) return;
      const deltaX = pointer.x - this.pointerStart.x;
      const deltaY = pointer.y - this.pointerStart.y;
      this.pointerStart = null;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
      this.changeDirection(
        Math.abs(deltaX) > Math.abs(deltaY)
          ? deltaX > 0
            ? "right"
            : "left"
          : deltaY > 0
            ? "down"
            : "up",
      );
    });

    this.configureCamera();
    this.renderBoard();
    this.renderEnvironment(true);
    this.renderDynamic(1, 0);
    this.emitSnapshot();
  }

  update(time: number, delta: number): void {
    this.assessPerformance(delta);
    if (this.state.status !== "playing") {
      this.renderDynamic(1, time);
      return;
    }

    if (this.userPaused) {
      const pausedProgress = Phaser.Math.Clamp(
        this.accumulatorMs / getTickMs(this.state),
        0,
        1,
      );
      this.renderDynamic(pausedProgress, time);
      return;
    }

    if (time < this.pausedUntil) {
      this.renderDynamic(1, time);
      return;
    }

    this.accumulatorMs += Math.min(delta, 250);
    let committedSteps = 0;
    let safety = 0;
    while (this.accumulatorMs >= getTickMs(this.state) && safety < 4) {
      this.accumulatorMs -= getTickMs(this.state);
      this.previousSnake = this.state.snake.map((position) => ({
        ...position,
      }));
      const result = step(this.state);
      this.state = result.state;
      this.handleEvents(result.events, time);
      if (this.state.status === "playing") {
        this.previousWorld = this.world;
        const worldResult = stepWorld(this.world, {
          elapsedMs: this.state.elapsedMs,
          playerSnake: this.state.snake,
          food: this.state.food,
        });
        this.world = worldResult.state;
        worldResult.notifications.forEach((event) =>
          this.callbacks.onWorldEvent(event),
        );
        if (worldResult.playerCollision) {
          const collision = endFromEnemyCollision(
            this.state,
            this.state.snake[0]!,
          );
          this.state = collision.state;
          this.handleEvents(collision.events, time);
        } else {
          for (const drop of worldResult.collectedDrops) {
            const reward = collectExternalReward(this.state, drop);
            this.state = reward.state;
            this.handleEvents(reward.events, time);
          }
        }
        if (this.state.status === "playing" && worldResult.foodClaimedByBot) {
          this.state = relocateFood(this.state, occupiedByWorld(this.world));
        }
      }
      committedSteps += 1;
      safety += 1;
      if (this.state.status === "game-over") {
        this.accumulatorMs = 0;
        break;
      }
    }

    const movementProgress =
      this.state.status === "playing"
        ? Phaser.Math.Clamp(this.accumulatorMs / getTickMs(this.state), 0, 1)
        : 1;
    this.renderDynamic(movementProgress, time);
    if (committedSteps > 0) this.emitSnapshot();
  }

  startRun(): void {
    const querySeed = Number(
      new URLSearchParams(window.location.search).get("seed"),
    );
    const generatedSeed =
      (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
    const seed =
      Number.isSafeInteger(querySeed) && querySeed > 0
        ? querySeed
        : generatedSeed || 1;
    const result = start(createInitialState(seed));
    this.state = result.state;
    this.world = createWorldState(seed, {
      width: this.state.width,
      height: this.state.height,
      quality: this.effectiveQuality,
      playerCountryCode: this.playerCountryCode,
      playerSnake: this.state.snake,
    });
    this.previousWorld = this.world;
    this.previousSnake = this.state.snake.map((position) => ({ ...position }));
    this.accumulatorMs = getTickMs(this.state);
    this.pausedUntil = 0;
    this.eatPulseUntil = 0;
    this.userPaused = false;
    this.environmentViewportKey = "";
    this.configureCamera(true);
    this.renderBoard();
    this.renderEnvironment(true);
    this.handleEvents(result.events, this.time.now);
    this.renderDynamic(1, this.time.now);
    this.emitSnapshot();
  }

  changeDirection(direction: Direction): void {
    if (this.state.status !== "playing" || this.userPaused) return;
    const next = queueDirection(this.state, direction);
    if (next !== this.state) {
      this.state = next;
      this.emitSnapshot();
    }
  }

  setPaused(paused: boolean): void {
    if (this.state.status !== "playing") return;
    this.userPaused = paused;
    this.pointerStart = null;
  }

  setVisualPreferences(
    qualityPreference: GraphicsQualityPreference,
    effectiveQuality: EffectiveGraphicsQuality,
    reduceMotion: boolean,
  ): void {
    this.qualityPreference = qualityPreference;
    this.effectiveQuality = effectiveQuality;
    this.reduceMotion = reduceMotion;
    this.frameTimeTotal = 0;
    this.frameSampleCount = 0;
    this.callbacks.onQualityChange(effectiveQuality);
  }

  private assessPerformance(delta: number): void {
    if (
      this.qualityPreference !== "auto" ||
      this.effectiveQuality === "reduced" ||
      delta <= 0 ||
      delta > 250
    ) {
      return;
    }
    this.frameTimeTotal += delta;
    this.frameSampleCount += 1;
    if (this.frameSampleCount < 120) return;
    const averageFrameMs = this.frameTimeTotal / this.frameSampleCount;
    this.frameTimeTotal = 0;
    this.frameSampleCount = 0;
    if (averageFrameMs > 22) {
      this.effectiveQuality = "reduced";
      this.callbacks.onQualityChange("reduced");
    }
  }

  private handleEvents(events: readonly GameEvent[], time: number): void {
    for (const event of events) {
      this.callbacks.onEvent(event);
      if (event.type === "ate") {
        const definition = FOOD_CATALOG[event.kind];
        const amount =
          event.rarity === "legendary" ? 24 : event.rarity === "rare" ? 15 : 9;
        this.createBurst(this.state.snake[0]!, definition.color, amount);
        this.createFloatingText(
          this.state.snake[0]!,
          `${event.multiplier > 1 ? `+${event.points} · x2` : `+${event.points}`} · +${event.experience} XP`,
          event.rarity === "legendary" ? "#fff45f" : "#ffffff",
        );
        this.eatPulseUntil = time + 190;
        if (!this.reduceMotion) {
          this.cameras.main.shake(
            event.rarity === "legendary" ? 150 : 70,
            0.0028,
          );
        }
        if (event.rarity === "legendary" && !this.reduceMotion) {
          this.cameras.main.flash(220, 255, 216, 61, false);
        }
      } else if (event.type === "evolved") {
        const evolution = EVOLUTIONS.find(
          (candidate) => candidate.id === event.to,
        );
        this.pausedUntil = time + (this.reduceMotion ? 120 : 620);
        if (!this.reduceMotion)
          this.cameras.main.flash(330, 188, 255, 44, false);
        if (evolution)
          this.createBurst(this.state.snake[0]!, evolution.accentColor, 22);
      } else if (event.type === "game-over") {
        if (!this.reduceMotion) {
          this.cameras.main.shake(340, 0.012);
          this.cameras.main.flash(180, 255, 59, 167, false);
        }
      }
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot(createSnapshot(this.state));
  }

  private metrics(): WorldMetrics {
    return createWorldMetrics(
      this.state.width,
      this.state.height,
      WORLD_CONFIG.camera.cellSize,
    );
  }

  private toPixels(position: Position, metrics: WorldMetrics): Position {
    return positionToWorldPixels(position, metrics);
  }

  private configureCamera(jumpToPlayer = false): void {
    const metrics = this.metrics();
    const camera = this.cameras.main;
    const target = this.toPixels(this.state.snake[0]!, metrics);
    this.cameraTarget ??= this.add.zone(target.x, target.y, 1, 1);
    this.cameraTarget.setPosition(target.x, target.y);
    camera.setBounds(
      0,
      0,
      metrics.pixelWidth + metrics.offsetX * 2,
      metrics.pixelHeight + metrics.offsetY * 2,
    );
    camera.setDeadzone(
      WORLD_CONFIG.camera.deadzone,
      WORLD_CONFIG.camera.deadzone * 0.72,
    );
    camera.startFollow(
      this.cameraTarget,
      true,
      WORLD_CONFIG.camera.lerp,
      WORLD_CONFIG.camera.lerp,
    );
    camera.setRoundPixels(true);
    if (jumpToPlayer) camera.centerOn(target.x, target.y);
  }

  private renderBoard(): void {
    if (!this.boardGraphics) return;
    const { cell, offsetX, offsetY } = this.metrics();
    const boardWidth = cell * this.state.width;
    const boardHeight = cell * this.state.height;
    this.boardGraphics.clear();
    this.boardGraphics.fillStyle(0x0d0922, 1);
    this.boardGraphics.fillRoundedRect(
      offsetX - 10,
      offsetY - 10,
      boardWidth + 20,
      boardHeight + 20,
      22,
    );
    const halfWidth = boardWidth / 2;
    const halfHeight = boardHeight / 2;
    BIOMES.forEach((biome, index) => {
      this.boardGraphics!.fillStyle(biome.backgroundColor, 0.76);
      this.boardGraphics!.fillRect(
        offsetX + (index % 2) * halfWidth,
        offsetY + Math.floor(index / 2) * halfHeight,
        halfWidth,
        halfHeight,
      );
    });
    this.boardGraphics.lineStyle(2, 0x7c3cff, 0.46);
    this.boardGraphics.strokeRoundedRect(
      offsetX - 10,
      offsetY - 10,
      boardWidth + 20,
      boardHeight + 20,
      22,
    );
    this.boardGraphics.lineStyle(1, 0xffffff, 0.045);
    for (let x = 1; x < this.state.width; x += 1) {
      this.boardGraphics.lineBetween(
        offsetX + x * cell,
        offsetY,
        offsetX + x * cell,
        offsetY + boardHeight,
      );
    }
    for (let y = 1; y < this.state.height; y += 1) {
      this.boardGraphics.lineBetween(
        offsetX,
        offsetY + y * cell,
        offsetX + boardWidth,
        offsetY + y * cell,
      );
    }
    this.boardGraphics.lineStyle(2, 0xffffff, 0.08);
    this.boardGraphics.lineBetween(
      offsetX + halfWidth,
      offsetY,
      offsetX + halfWidth,
      offsetY + boardHeight,
    );
    this.boardGraphics.lineBetween(
      offsetX,
      offsetY + halfHeight,
      offsetX + boardWidth,
      offsetY + halfHeight,
    );

    this.biomeLabels.forEach((label) => label.destroy());
    this.biomeLabels.length = 0;
    BIOMES.forEach((biome, index) => {
      const label = this.add
        .text(
          offsetX + (index % 2) * halfWidth + 10,
          offsetY + Math.floor(index / 2) * halfHeight + 8,
          biome.name.toUpperCase(),
          {
            color: `#${biome.accentColor.toString(16).padStart(6, "0")}`,
            fontFamily: "system-ui, sans-serif",
            fontSize: "10px",
            fontStyle: "bold",
            backgroundColor: "#08051899",
            padding: { x: 5, y: 3 },
          },
        )
        .setAlpha(0.72);
      this.biomeLabels.push(label);
    });
  }

  private isVisible(point: Position, padding = 100): boolean {
    const view = this.cameras.main.worldView;
    return (
      point.x >= view.x - padding &&
      point.x <= view.right + padding &&
      point.y >= view.y - padding &&
      point.y <= view.bottom + padding
    );
  }

  private renderEnvironment(force = false): void {
    const graphics = this.environmentGraphics;
    if (!graphics) return;
    const metrics = this.metrics();
    const view = this.cameras.main.worldView;
    const viewportKey = `${Math.floor(view.x / (metrics.cell * 3))}:${Math.floor(view.y / (metrics.cell * 3))}:${this.effectiveQuality}`;
    if (!force && viewportKey === this.environmentViewportKey) return;
    this.environmentViewportKey = viewportKey;
    graphics.clear();
    for (const decoration of this.world.decorations) {
      const point = this.toPixels(decoration, metrics);
      if (!this.isVisible(point, metrics.cell * 3)) continue;
      const size = metrics.cell * 0.18 * decoration.scale;
      const biome = BIOMES.find(
        (candidate) => candidate.id === decoration.biomeId,
      )!;
      graphics.fillStyle(biome.accentColor, 0.24);
      if (decoration.kind === "rock") {
        graphics.fillEllipse(point.x, point.y, size * 1.7, size);
      } else if (
        decoration.kind === "bush" ||
        decoration.kind === "flower" ||
        decoration.kind === "crystal"
      ) {
        graphics.fillCircle(point.x, point.y, size);
        graphics.fillCircle(
          point.x + size * 0.75,
          point.y + size * 0.15,
          size * 0.7,
        );
        if (decoration.kind !== "bush") {
          graphics.fillStyle(0xffffff, 0.35);
          graphics.fillCircle(point.x, point.y, size * 0.32);
        }
      } else {
        graphics.fillRoundedRect(
          point.x - size * 0.75,
          point.y - size * 0.5,
          size * 1.5,
          size,
          size * 0.25,
        );
        graphics.lineStyle(1, 0xffffff, 0.24);
        graphics.lineBetween(
          point.x - size * 0.45,
          point.y,
          point.x + size * 0.45,
          point.y,
        );
      }
    }
  }

  private renderDynamic(progress: number, time: number): void {
    if (
      !this.snakeGraphics ||
      !this.foodGraphics ||
      !this.foodGlyph ||
      !this.foodLabel ||
      !this.worldEffectsGraphics ||
      !this.botGraphics
    )
      return;
    const metrics = this.metrics();
    const playerAnchors = interpolateSnakeAnchors(
      this.previousSnake,
      this.state.snake,
      progress,
    );
    const playerHead = this.toPixels(playerAnchors[0]!, metrics);
    this.cameraTarget?.setPosition(playerHead.x, playerHead.y);
    this.renderEnvironment();
    this.renderWorldEffects(metrics, time);
    this.renderBots(metrics, progress, time);
    this.renderFood(metrics, time);
    this.renderSnake(metrics, progress, time);
    this.renderPlayerIdentity(metrics, progress);
  }

  private renderWorldEffects(metrics: WorldMetrics, time: number): void {
    const graphics = this.worldEffectsGraphics!;
    graphics.clear();
    for (const drop of this.world.drops) {
      const point = this.toPixels(drop.position, metrics);
      if (!this.isVisible(point, metrics.cell * 2)) continue;
      const definition = FOOD_CATALOG[drop.kind];
      const pulse = this.reduceMotion
        ? 1
        : 1 + Math.sin(time * 0.008 + drop.position.x) * 0.08;
      const radius =
        metrics.cell * (drop.source === "remains" ? 0.25 : 0.19) * pulse;
      graphics.fillStyle(
        definition.color,
        drop.source === "remains" ? 0.92 : 0.72,
      );
      if (definition.rarity === "legendary") {
        graphics.fillTriangle(
          point.x,
          point.y - radius * 1.25,
          point.x + radius,
          point.y + radius,
          point.x - radius,
          point.y + radius,
        );
      } else {
        graphics.fillCircle(point.x, point.y, radius);
      }
      if (drop.source === "remains" || definition.rarity !== "normal") {
        graphics.lineStyle(
          drop.source === "remains" ? 2.5 : 1.5,
          0xffffff,
          drop.source === "remains" ? 0.78 : 0.45,
        );
        graphics.strokeCircle(point.x, point.y, radius * 1.35);
      }
    }
    for (const death of this.world.deaths) {
      const point = this.toPixels(death.position, metrics);
      if (!this.isVisible(point, metrics.cell * 3)) continue;
      const duration = Math.max(1, death.endsAtMs - death.startedAtMs);
      const progress = Phaser.Math.Clamp(
        (this.state.elapsedMs - death.startedAtMs) / duration,
        0,
        1,
      );
      const color = getCountry(death.countryCode).accent;
      graphics.lineStyle(5 - progress * 3, color, 1 - progress);
      graphics.strokeCircle(
        point.x,
        point.y,
        metrics.cell * (0.35 + progress * 1.25),
      );
      graphics.fillStyle(color, 0.85 - progress * 0.6);
      const fragments = this.effectiveQuality === "reduced" ? 4 : 8;
      for (let index = 0; index < fragments; index += 1) {
        const angle = (Math.PI * 2 * index) / fragments + progress;
        graphics.fillCircle(
          point.x + Math.cos(angle) * metrics.cell * progress,
          point.y + Math.sin(angle) * metrics.cell * progress,
          3.5 - progress * 1.5,
        );
      }
    }
    const event = this.world.activeEvent;
    const definition = event ? WORLD_EVENTS[event.kind] : null;
    const phase = time * 0.003;
    if (event?.kind === "portals" && event.portals) {
      for (const portal of [event.portals.a, event.portals.b]) {
        const point = this.toPixels(portal, metrics);
        graphics.lineStyle(5, definition!.color, 0.45 + Math.sin(phase) * 0.15);
        graphics.strokeCircle(point.x, point.y, metrics.cell * 0.58);
        graphics.lineStyle(2, 0xffffff, 0.5);
        graphics.strokeCircle(point.x, point.y, metrics.cell * 0.35);
      }
    } else if (event?.kind === "object-rain") {
      const drops = this.effectiveQuality === "reduced" ? 8 : 16;
      const view = this.cameras.main.worldView;
      graphics.fillStyle(definition!.color, 0.5);
      for (let index = 0; index < drops; index += 1) {
        const x =
          view.x + ((index * 83 + time * 0.08) % Math.max(1, view.width));
        const y =
          view.y + ((index * 47 + time * 0.19) % Math.max(1, view.height));
        graphics.fillCircle(x, y, 2.4 + (index % 3));
      }
    } else if (event?.kind === "chaos-mode") {
      graphics.lineStyle(
        8,
        definition!.color,
        0.18 + Math.sin(phase * 2) * 0.08,
      );
      graphics.strokeRoundedRect(
        metrics.offsetX - 5,
        metrics.offsetY - 5,
        metrics.cell * this.state.width + 10,
        metrics.cell * this.state.height + 10,
        18,
      );
    } else if (event?.kind === "bot-invasion") {
      graphics.lineStyle(3, definition!.color, 0.28);
      for (let index = 0; index < 4; index += 1) {
        const x =
          metrics.offsetX + ((index + 1) / 5) * metrics.cell * this.state.width;
        graphics.lineBetween(
          x,
          metrics.offsetY,
          x,
          metrics.offsetY + metrics.cell * 0.45,
        );
      }
    }

    const evolutionIndex = Math.max(
      0,
      EVOLUTIONS.findIndex(
        (evolution) => evolution.id === this.state.evolutionId,
      ),
    );
    if (!this.reduceMotion && evolutionIndex > 0) {
      const particles = Math.min(
        this.effectiveQuality === "reduced" ? 3 : 8,
        evolutionIndex * 2,
      );
      const evolution = getEvolution(this.state);
      const head = this.toPixels(this.state.snake[0]!, metrics);
      graphics.fillStyle(evolution.accentColor, 0.22);
      for (let index = 0; index < particles; index += 1) {
        const angle = phase * 0.45 + index * ((Math.PI * 2) / particles);
        const distance = metrics.cell * (2.4 + (index % 3) * 0.8);
        const x = head.x + Math.cos(angle) * distance;
        const y = head.y + Math.sin(angle) * distance;
        graphics.fillCircle(x, y, 1.5 + evolutionIndex * 0.45);
      }
    }
  }

  private renderBots(
    metrics: WorldMetrics,
    progress: number,
    time: number,
  ): void {
    const graphics = this.botGraphics!;
    const activeIds = new Set(this.world.bots.map((bot) => bot.id));
    for (const [id, label] of this.botLabels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.botLabels.delete(id);
      }
    }
    this.botLabels.forEach((label) => label.setVisible(false));
    graphics.clear();
    const visibleLimit =
      WORLD_CONFIG.bots[this.effectiveQuality] +
      (this.world.activeEvent?.kind === "bot-invasion"
        ? WORLD_CONFIG.bots.invasionExtra
        : 0);
    for (const bot of this.world.bots.slice(0, visibleLimit)) {
      const previous = this.previousWorld.bots.find(
        (candidate) => candidate.id === bot.id,
      );
      const anchors = interpolateSnakeAnchors(
        previous?.snake ?? bot.snake,
        bot.snake,
        progress,
      ).map((position) => this.toPixels(position, metrics));
      const path = createSmoothSnakePath(
        anchors,
        this.effectiveQuality === "reduced" ? 2 : 4,
      );
      const head = path[0]!;
      if (!this.isVisible(head, metrics.cell * 5)) continue;
      const country = getCountry(bot.countryCode);
      const tier = BOT_TIERS[bot.tier];
      for (let index = path.length - 1; index >= 0; index -= 1) {
        const point = path[index]!;
        const tailProgress = index / Math.max(1, path.length - 1);
        const radius =
          metrics.cell *
          (index === 0 ? 0.22 : 0.16 - tailProgress * 0.035) *
          tier.bodyScale;
        graphics.fillStyle(index === 0 ? country.accent : country.primary, 0.9);
        graphics.fillCircle(point.x, point.y, radius);
      }
      const botDirection = directionAlongPath(path);
      if (this.state.elapsedMs < bot.invulnerableUntilMs) {
        graphics.lineStyle(2, 0xffffff, 0.48);
        graphics.strokeCircle(
          head.x,
          head.y,
          metrics.cell * 0.38 * tier.bodyScale,
        );
      }
      this.renderFace(
        graphics,
        head,
        metrics.cell * 0.52 * tier.bodyScale,
        country.accent,
        botDirection,
      );
      this.drawCountryFlag(
        graphics,
        head.x,
        head.y - metrics.cell * 0.08,
        Math.atan2(botDirection.y, botDirection.x) * 0.12,
        country,
        metrics.cell * 0.48,
      );
      let label = this.botLabels.get(bot.id);
      if (!label) {
        label = this.add
          .text(0, 0, "", {
            color: "#ffffff",
            fontFamily: "system-ui, sans-serif",
            fontSize: "10px",
            fontStyle: "bold",
            stroke: "#080518",
            strokeThickness: 3,
            align: "center",
          })
          .setOrigin(0.5, 1);
        this.botLabels.set(bot.id, label);
      }
      label
        .setText(`${country.code} · ${bot.name}\n${botEvolutionName(bot)}`)
        .setPosition(head.x, head.y - metrics.cell * 0.82)
        .setVisible(this.effectiveQuality === "normal")
        .setAlpha(0.88 + Math.sin(time * 0.004 + bot.phase) * 0.08);
    }
  }

  private renderPlayerIdentity(metrics: WorldMetrics, progress: number): void {
    const anchors = interpolateSnakeAnchors(
      this.previousSnake,
      this.state.snake,
      progress,
    ).map((position) => this.toPixels(position, metrics));
    const path = createSmoothSnakePath(anchors, 2);
    const head = path[0]!;
    const direction = directionAlongPath(path);
    const angle = Math.atan2(direction.y, direction.x);
    if (this.state.status !== "game-over") {
      this.drawCountryFlag(
        this.snakeGraphics!,
        head.x - direction.x * metrics.cell * 0.08,
        head.y - direction.y * metrics.cell * 0.08,
        this.reduceMotion ? 0 : angle * 0.12,
        getCountry(this.playerCountryCode),
        metrics.cell * 0.7,
      );
    }
  }

  private drawCountryFlag(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    rotation: number,
    country: ReturnType<typeof getCountry>,
    size: number,
  ): void {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const point = (localX: number, localY: number) => ({
      x: x + localX * cosine - localY * sine,
      y: y + localX * sine + localY * cosine,
    });
    const poleTop = point(0, -size);
    const topRight = point(size * 0.78, -size);
    const middleLeft = point(0, -size * 0.72);
    const middleRight = point(size * 0.78, -size * 0.72);
    const bottomLeft = point(0, -size * 0.44);
    const bottomRight = point(size * 0.78, -size * 0.44);

    graphics.lineStyle(Math.max(1.5, size * 0.08), 0xffffff, 0.88);
    graphics.lineBetween(x, y, poleTop.x, poleTop.y);
    graphics.fillStyle(country.primary, 1);
    graphics.fillTriangle(
      poleTop.x,
      poleTop.y,
      topRight.x,
      topRight.y,
      middleRight.x,
      middleRight.y,
    );
    graphics.fillTriangle(
      poleTop.x,
      poleTop.y,
      middleRight.x,
      middleRight.y,
      middleLeft.x,
      middleLeft.y,
    );
    graphics.fillStyle(country.accent, 1);
    graphics.fillTriangle(
      middleLeft.x,
      middleLeft.y,
      middleRight.x,
      middleRight.y,
      bottomRight.x,
      bottomRight.y,
    );
    graphics.fillTriangle(
      middleLeft.x,
      middleLeft.y,
      bottomRight.x,
      bottomRight.y,
      bottomLeft.x,
      bottomLeft.y,
    );
    graphics.lineStyle(Math.max(1, size * 0.045), 0xffffff, 0.72);
    graphics.lineBetween(poleTop.x, poleTop.y, topRight.x, topRight.y);
    graphics.lineBetween(topRight.x, topRight.y, bottomRight.x, bottomRight.y);
    graphics.lineBetween(
      bottomRight.x,
      bottomRight.y,
      bottomLeft.x,
      bottomLeft.y,
    );
  }

  private renderFood(metrics: WorldMetrics, time: number): void {
    const graphics = this.foodGraphics!;
    const glyph = this.foodGlyph!;
    const label = this.foodLabel!;
    const definition = FOOD_CATALOG[this.state.food.kind];
    const basePoint = this.toPixels(this.state.food.position, metrics);
    const phase = time * 0.006;
    const pulseAmount = this.reduceMotion
      ? 0
      : definition.visualEffect === "pulse"
        ? 0.1
        : definition.visualEffect === "electric" ||
            definition.visualEffect === "chaos"
          ? 0.075
          : 0.035;
    const pulse = definition.visualScale * (1 + Math.sin(phase) * pulseAmount);
    const bobAmount = this.reduceMotion
      ? 0
      : definition.visualEffect === "float" ||
          definition.visualEffect === "electric" ||
          definition.visualEffect === "chaos"
        ? 3.2
        : 1.2;
    const point = {
      x: basePoint.x,
      y: basePoint.y + Math.sin(phase * 0.8) * bobAmount,
    };

    graphics.clear();
    if (this.state.status === "ready") {
      const headPoint = this.toPixels(this.state.snake[0]!, metrics);
      graphics.lineStyle(3, 0xbcff2c, 0.55);
      graphics.lineBetween(headPoint.x, headPoint.y, point.x, point.y);
      graphics.lineStyle(4, 0xffffff, 0.9);
      graphics.strokeCircle(point.x, point.y, metrics.cell * 0.82);
    }
    graphics.fillStyle(
      definition.color,
      definition.rarity === "legendary" ? 0.28 : 0.17,
    );
    graphics.fillCircle(point.x, point.y, metrics.cell * 0.67 * pulse);
    if (definition.rarity !== "normal") {
      graphics.lineStyle(
        definition.rarity === "legendary" ? 4 : 2,
        definition.color,
        0.86,
      );
      graphics.strokeCircle(point.x, point.y, metrics.cell * 0.57 * pulse);
      graphics.lineStyle(1, 0xffffff, 0.35);
      graphics.strokeCircle(point.x, point.y, metrics.cell * 0.69 * pulse);
    }
    if (
      this.effectiveQuality === "normal" &&
      !this.reduceMotion &&
      (definition.visualEffect === "electric" ||
        definition.visualEffect === "chaos")
    ) {
      const sparks = definition.visualEffect === "chaos" ? 5 : 3;
      graphics.fillStyle(definition.color, 0.9);
      for (let index = 0; index < sparks; index += 1) {
        const angle = phase * 0.7 + index * ((Math.PI * 2) / sparks);
        graphics.fillCircle(
          point.x + Math.cos(angle) * metrics.cell * 0.72 * pulse,
          point.y + Math.sin(angle) * metrics.cell * 0.72 * pulse,
          definition.visualEffect === "chaos" ? 2.8 : 2.2,
        );
      }
    }
    const rotation = this.reduceMotion
      ? 0
      : definition.visualEffect === "spin"
        ? phase * 0.16
        : definition.visualEffect === "chaos"
          ? phase * 0.08 + Math.sin(phase * 1.7) * 0.2
          : definition.rarity === "legendary"
            ? Math.sin(phase * 0.7) * 0.12
            : 0;
    glyph
      .setText(FOOD_GLYPHS[this.state.food.kind])
      .setColor(this.state.food.kind === "super-meme" ? "#fff45f" : "#ffffff")
      .setFontSize(Math.round(metrics.cell * 0.72))
      .setPosition(point.x, point.y + 1)
      .setScale(pulse)
      .setRotation(rotation);
    const rarityLabel = RARITY_LABELS[definition.rarity];
    label
      .setText(
        `${rarityLabel} · +${definition.points} · +${definition.experience} XP`,
      )
      .setPosition(point.x, point.y - metrics.cell * 0.62)
      .setColor(definition.rarity === "legendary" ? "#fff45f" : "#ffffff")
      .setVisible(metrics.cell >= 25);
  }

  private renderSnake(
    metrics: WorldMetrics,
    progress: number,
    time: number,
  ): void {
    const graphics = this.snakeGraphics!;
    const evolution = getEvolution(this.state);
    const phase = time * 0.008;
    const isBoosted = this.state.activeEffects.some(
      (effect) =>
        effect.kind === "speed-boost" &&
        effect.expiresAtMs > this.state.elapsedMs,
    );
    const hasDoublePoints = this.state.activeEffects.some(
      (effect) =>
        effect.kind === "double-points" &&
        effect.expiresAtMs > this.state.elapsedMs,
    );
    const headScale = time < this.eatPulseUntil ? 1.2 : 1;
    const anchors = interpolateSnakeAnchors(
      this.previousSnake,
      this.state.snake,
      progress,
    ).map((point) => this.toPixels(point, metrics));
    const subdivisions =
      this.state.snake.length > 90
        ? 2
        : this.effectiveQuality === "reduced"
          ? 3
          : 4;
    const path = createSmoothSnakePath(anchors, subdivisions);
    const headDirection = directionAlongPath(path);

    graphics.clear();
    for (let index = path.length - 1; index >= 0; index -= 1) {
      const basePoint = path[index]!;
      const isHead = index === 0;
      const tailProgress = index / Math.max(1, path.length - 1);
      const neighbor = path[Math.min(path.length - 1, index + 1)] ?? basePoint;
      const tangentX = basePoint.x - neighbor.x;
      const tangentY = basePoint.y - neighbor.y;
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const elasticOffset =
        isHead || this.reduceMotion
          ? 0
          : Math.sin(phase - index * 0.28) * 0.72 * (1 - tailProgress * 0.35);
      const point = {
        x: basePoint.x + (-tangentY / tangentLength) * elasticOffset,
        y: basePoint.y + (tangentX / tangentLength) * elasticOffset,
      };
      const radius = isHead
        ? metrics.cell * 0.42 * evolution.scale * headScale
        : metrics.cell * (0.29 - tailProgress * 0.08) * evolution.scale;

      if (
        isHead &&
        (evolution.effect === "glow" ||
          evolution.effect === "chaos" ||
          isBoosted)
      ) {
        graphics.fillStyle(isBoosted ? 0xd98c52 : evolution.accentColor, 0.14);
        graphics.fillCircle(point.x, point.y, radius * 1.85);
      }
      if (isHead && hasDoublePoints) {
        graphics.lineStyle(3, 0xff4fd8, 0.75 + Math.sin(phase) * 0.2);
        graphics.strokeCircle(point.x, point.y, radius * 1.38);
      }

      graphics.fillStyle(
        isHead
          ? evolution.headColor
          : Math.floor(index / subdivisions) % 2 === 0
            ? evolution.bodyColor
            : evolution.headColor,
        0.97,
      );
      graphics.fillCircle(point.x, point.y, radius);
      graphics.lineStyle(
        isHead ? 3 : 2,
        evolution.accentColor,
        isHead ? 0.82 : 0.22,
      );
      graphics.strokeCircle(point.x, point.y, radius);

      if (isHead) {
        this.renderFace(
          graphics,
          point,
          metrics.cell,
          evolution.accentColor,
          headDirection,
        );
      }
    }

    if (
      this.effectiveQuality === "normal" &&
      !this.reduceMotion &&
      (evolution.effect === "sparkles" || evolution.effect === "chaos")
    ) {
      const headPoint = path[0]!;
      graphics.fillStyle(evolution.accentColor, 0.86);
      for (let index = 0; index < 4; index += 1) {
        const angle = phase * 0.7 + index * (Math.PI / 2);
        graphics.fillCircle(
          headPoint.x + Math.cos(angle) * metrics.cell * 0.72,
          headPoint.y + Math.sin(angle) * metrics.cell * 0.72,
          2.4,
        );
      }
    }
    if (
      this.state.status === "playing" &&
      this.state.elapsedMs < WORLD_CONFIG.spawnProtectionMs
    ) {
      const remaining =
        1 - this.state.elapsedMs / WORLD_CONFIG.spawnProtectionMs;
      graphics.lineStyle(3, 0xffffff, 0.3 + remaining * 0.45);
      graphics.strokeCircle(
        path[0]!.x,
        path[0]!.y,
        metrics.cell * (0.72 + (1 - remaining) * 0.1),
      );
    }
  }

  private renderFace(
    graphics: Phaser.GameObjects.Graphics,
    headPoint: Position,
    cell: number,
    accentColor: number,
    vector: Position,
  ): void {
    const side = { x: -vector.y, y: vector.x };
    for (const eyeSide of [-1, 1]) {
      const eyeX =
        headPoint.x + vector.x * cell * 0.17 + side.x * eyeSide * cell * 0.17;
      const eyeY =
        headPoint.y + vector.y * cell * 0.17 + side.y * eyeSide * cell * 0.17;
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(eyeX, eyeY, cell * 0.13);
      graphics.fillStyle(0x160c2f, 1);
      graphics.fillCircle(
        eyeX + vector.x * cell * 0.035,
        eyeY + vector.y * cell * 0.035,
        cell * 0.06,
      );
    }
    graphics.lineStyle(2, accentColor, 0.9);
    graphics.strokeCircle(
      headPoint.x + vector.x * cell * 0.3,
      headPoint.y + vector.y * cell * 0.3,
      cell * 0.055,
    );
  }

  private createBurst(position: Position, color: number, amount: number): void {
    if (this.reduceMotion) return;
    const metrics = this.metrics();
    const point = this.toPixels(position, metrics);
    const effectiveAmount =
      this.effectiveQuality === "reduced" ? Math.ceil(amount * 0.45) : amount;
    for (let index = 0; index < effectiveAmount; index += 1) {
      const angle = (Math.PI * 2 * index) / effectiveAmount;
      const particle = this.add.circle(point.x, point.y, 4, color, 0.95);
      this.tweens.add({
        targets: particle,
        x: point.x + Math.cos(angle) * Phaser.Math.Between(28, 68),
        y: point.y + Math.sin(angle) * Phaser.Math.Between(28, 68),
        alpha: 0,
        scale: 0.3,
        duration: 360,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private createFloatingText(
    position: Position,
    text: string,
    color: string,
  ): void {
    const metrics = this.metrics();
    const point = this.toPixels(position, metrics);
    const label = this.add
      .text(point.x, point.y - metrics.cell * 0.45, text, {
        color,
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        stroke: "#160c2f",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    if (this.reduceMotion) {
      this.time.delayedCall(520, () => label.destroy());
      return;
    }
    this.tweens.add({
      targets: label,
      y: label.y - 42,
      alpha: 0,
      scale: 1.18,
      duration: 680,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }
}
