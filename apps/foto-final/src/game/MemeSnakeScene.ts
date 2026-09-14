import Phaser from "phaser";

import {
  EVOLUTIONS,
  FOOD_CATALOG,
  createInitialState,
  createSnapshot,
  getEvolution,
  getTickMs,
  queueDirection,
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

interface SceneCallbacks {
  onEvent(event: GameEvent): void;
  onSnapshot(snapshot: GameSnapshot): void;
}

interface BoardMetrics {
  readonly cell: number;
  readonly offsetX: number;
  readonly offsetY: number;
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
  normal: "",
  rare: "RARA",
  legendary: "LEGENDARIA",
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

const DIRECTION_VECTOR: Readonly<Record<Direction, Position>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export class MemeSnakeScene extends Phaser.Scene {
  private readonly callbacks: SceneCallbacks;
  private state: GameState = createInitialState();
  private previousSnake: readonly Position[] = this.state.snake;
  private boardGraphics?: Phaser.GameObjects.Graphics;
  private snakeGraphics?: Phaser.GameObjects.Graphics;
  private foodGraphics?: Phaser.GameObjects.Graphics;
  private foodGlyph?: Phaser.GameObjects.Text;
  private foodLabel?: Phaser.GameObjects.Text;
  private accumulatorMs = 0;
  private pointerStart: Position | null = null;
  private pausedUntil = 0;
  private eatPulseUntil = 0;

  constructor(callbacks: SceneCallbacks) {
    super({ key: "meme-snake" });
    this.callbacks = callbacks;
  }

  create(): void {
    this.boardGraphics = this.add.graphics();
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

    this.renderBoard();
    this.renderDynamic(1, 0);
    this.emitSnapshot();
  }

  update(time: number, delta: number): void {
    if (this.state.status !== "playing") {
      this.renderDynamic(1, time);
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
    this.previousSnake = this.state.snake.map((position) => ({ ...position }));
    this.accumulatorMs = getTickMs(this.state);
    this.pausedUntil = 0;
    this.eatPulseUntil = 0;
    this.handleEvents(result.events, this.time.now);
    this.renderDynamic(1, this.time.now);
    this.emitSnapshot();
  }

  changeDirection(direction: Direction): void {
    if (this.state.status !== "playing") return;
    const next = queueDirection(this.state, direction);
    if (next !== this.state) {
      this.state = next;
      this.emitSnapshot();
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
        this.cameras.main.shake(
          event.rarity === "legendary" ? 150 : 70,
          0.0028,
        );
        if (event.rarity === "legendary") {
          this.cameras.main.flash(220, 255, 216, 61, false);
        }
      } else if (event.type === "evolved") {
        const evolution = EVOLUTIONS.find(
          (candidate) => candidate.id === event.to,
        );
        this.pausedUntil = time + 620;
        this.cameras.main.flash(330, 188, 255, 44, false);
        if (evolution)
          this.createBurst(this.state.snake[0]!, evolution.accentColor, 22);
      } else if (event.type === "game-over") {
        this.cameras.main.shake(340, 0.012);
        this.cameras.main.flash(180, 255, 59, 167, false);
      }
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot(createSnapshot(this.state));
  }

  private metrics(): BoardMetrics {
    const cell = Math.min(32, 820 / this.state.width, 520 / this.state.height);
    return {
      cell,
      offsetX: (900 - cell * this.state.width) / 2,
      offsetY: (620 - cell * this.state.height) / 2,
    };
  }

  private toPixels(position: Position, metrics: BoardMetrics): Position {
    return {
      x: metrics.offsetX + position.x * metrics.cell + metrics.cell / 2,
      y: metrics.offsetY + position.y * metrics.cell + metrics.cell / 2,
    };
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
  }

  private renderDynamic(progress: number, time: number): void {
    if (
      !this.snakeGraphics ||
      !this.foodGraphics ||
      !this.foodGlyph ||
      !this.foodLabel
    )
      return;
    const metrics = this.metrics();
    this.renderFood(metrics, time);
    this.renderSnake(metrics, progress, time);
  }

  private renderFood(metrics: BoardMetrics, time: number): void {
    const graphics = this.foodGraphics!;
    const glyph = this.foodGlyph!;
    const label = this.foodLabel!;
    const definition = FOOD_CATALOG[this.state.food.kind];
    const basePoint = this.toPixels(this.state.food.position, metrics);
    const phase = time * 0.006;
    const pulseAmount =
      definition.visualEffect === "pulse"
        ? 0.1
        : definition.visualEffect === "electric" ||
            definition.visualEffect === "chaos"
          ? 0.075
          : 0.035;
    const pulse = definition.visualScale * (1 + Math.sin(phase) * pulseAmount);
    const bobAmount =
      definition.visualEffect === "float" ||
      definition.visualEffect === "electric" ||
      definition.visualEffect === "chaos"
        ? 3.2
        : 1.2;
    const point = {
      x: basePoint.x,
      y: basePoint.y + Math.sin(phase * 0.8) * bobAmount,
    };

    graphics.clear();
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
      definition.visualEffect === "electric" ||
      definition.visualEffect === "chaos"
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
    const rotation =
      definition.visualEffect === "spin"
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
        `${rarityLabel ? `${rarityLabel} · ` : ""}+${definition.points} · +${definition.experience} XP`,
      )
      .setPosition(point.x, point.y - metrics.cell * 0.62)
      .setColor(definition.rarity === "legendary" ? "#fff45f" : "#ffffff")
      .setVisible(metrics.cell >= 25);
  }

  private renderSnake(
    metrics: BoardMetrics,
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
    const headScale = time < this.eatPulseUntil ? 1.24 : 1;

    graphics.clear();
    for (let index = this.state.snake.length - 1; index >= 0; index -= 1) {
      const target = this.state.snake[index]!;
      const origin =
        this.previousSnake[Math.min(index, this.previousSnake.length - 1)] ??
        target;
      const interpolated = {
        x: interpolate(origin.x, target.x, progress),
        y: interpolate(origin.y, target.y, progress),
      };
      const wobble = index === 0 ? 0 : Math.sin(phase + index * 0.85) * 0.9;
      const basePoint = this.toPixels(interpolated, metrics);
      const point = { x: basePoint.x, y: basePoint.y + wobble };
      const isHead = index === 0;
      const tailProgress = index / Math.max(1, this.state.snake.length - 1);
      const radius = isHead
        ? metrics.cell * 0.47 * evolution.scale * headScale
        : metrics.cell * (0.39 - tailProgress * 0.09) * evolution.scale;

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
          : index % 2 === 0
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

      if (isHead)
        this.renderFace(graphics, point, metrics.cell, evolution.accentColor);
    }

    if (evolution.effect === "sparkles" || evolution.effect === "chaos") {
      const head = this.state.snake[0]!;
      const origin = this.previousSnake[0] ?? head;
      const headPoint = this.toPixels(
        {
          x: interpolate(origin.x, head.x, progress),
          y: interpolate(origin.y, head.y, progress),
        },
        metrics,
      );
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
  }

  private renderFace(
    graphics: Phaser.GameObjects.Graphics,
    headPoint: Position,
    cell: number,
    accentColor: number,
  ): void {
    const vector = DIRECTION_VECTOR[this.state.direction];
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
    const metrics = this.metrics();
    const point = this.toPixels(position, metrics);
    for (let index = 0; index < amount; index += 1) {
      const angle = (Math.PI * 2 * index) / amount;
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
