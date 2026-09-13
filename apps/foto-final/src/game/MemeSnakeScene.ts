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
  type GameEvent,
  type GameSnapshot,
  type GameState,
  type Position,
} from "../core/game";

interface SceneCallbacks {
  onEvent(event: GameEvent): void;
  onSnapshot(snapshot: GameSnapshot): void;
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

export class MemeSnakeScene extends Phaser.Scene {
  private readonly callbacks: SceneCallbacks;
  private state: GameState = createInitialState();
  private boardGraphics?: Phaser.GameObjects.Graphics;
  private snakeGraphics?: Phaser.GameObjects.Graphics;
  private foodGraphics?: Phaser.GameObjects.Graphics;
  private foodGlyph?: Phaser.GameObjects.Text;
  private foodLabel?: Phaser.GameObjects.Text;
  private accumulatorMs = 0;
  private pointerStart: Position | null = null;

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
      if (!direction) {
        return;
      }
      event.preventDefault();
      this.changeDirection(direction);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pointerStart = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerStart) {
        return;
      }
      const deltaX = pointer.x - this.pointerStart.x;
      const deltaY = pointer.y - this.pointerStart.y;
      this.pointerStart = null;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) {
        return;
      }
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

    this.renderState();
    this.emitSnapshot();
  }

  update(_time: number, delta: number): void {
    if (this.state.status !== "playing") {
      return;
    }

    this.accumulatorMs += Math.min(delta, 250);
    let safety = 0;
    while (this.accumulatorMs >= getTickMs(this.state) && safety < 4) {
      this.accumulatorMs -= getTickMs(this.state);
      const result = step(this.state);
      this.state = result.state;
      this.handleEvents(result.events);
      safety += 1;
      if (this.state.status === "game-over") {
        this.accumulatorMs = 0;
        break;
      }
    }

    if (safety > 0) {
      this.renderState();
      this.emitSnapshot();
    }
  }

  startRun(): void {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
    const initial = createInitialState(seed || 1);
    const result = start(initial);
    this.state = result.state;
    this.accumulatorMs = 0;
    this.handleEvents(result.events);
    this.renderState();
    this.emitSnapshot();
  }

  changeDirection(direction: Direction): void {
    if (this.state.status !== "playing") {
      return;
    }
    const next = queueDirection(this.state, direction);
    if (next !== this.state) {
      this.state = next;
      this.emitSnapshot();
    }
  }

  private handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      this.callbacks.onEvent(event);
      if (event.type === "ate") {
        this.createBurst(this.state.snake[0]!, FOOD_CATALOG[event.kind].color);
        this.cameras.main.shake(70, 0.0022);
      } else if (event.type === "evolved") {
        const evolution = EVOLUTIONS.find(
          (candidate) => candidate.id === event.to,
        );
        this.cameras.main.flash(260, 188, 255, 44, false);
        if (evolution) {
          this.createBurst(this.state.snake[0]!, evolution.accentColor, 16);
        }
      } else if (event.type === "game-over") {
        this.cameras.main.shake(340, 0.012);
        this.cameras.main.flash(180, 255, 59, 167, false);
      }
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshot(createSnapshot(this.state));
  }

  private metrics(): { cell: number; offsetX: number; offsetY: number } {
    const cell = Math.min(32, 820 / this.state.width, 520 / this.state.height);
    return {
      cell,
      offsetX: (900 - cell * this.state.width) / 2,
      offsetY: (620 - cell * this.state.height) / 2,
    };
  }

  private toPixels(position: Position): Position {
    const { cell, offsetX, offsetY } = this.metrics();
    return {
      x: offsetX + position.x * cell + cell / 2,
      y: offsetY + position.y * cell + cell / 2,
    };
  }

  private renderState(): void {
    if (
      !this.boardGraphics ||
      !this.snakeGraphics ||
      !this.foodGraphics ||
      !this.foodGlyph ||
      !this.foodLabel
    ) {
      return;
    }

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

    this.renderFood(cell);
    this.renderSnake(cell);
  }

  private renderFood(cell: number): void {
    const graphics = this.foodGraphics!;
    const glyph = this.foodGlyph!;
    const label = this.foodLabel!;
    const definition = FOOD_CATALOG[this.state.food.kind];
    const point = this.toPixels(this.state.food.position);
    const pulse = 1 + Math.sin(this.state.ticks * 0.65) * 0.08;

    graphics.clear();
    graphics.fillStyle(definition.color, 0.2);
    graphics.fillCircle(point.x, point.y, cell * 0.61 * pulse);
    graphics.lineStyle(2, definition.color, 0.92);
    graphics.strokeCircle(point.x, point.y, cell * 0.47 * pulse);
    glyph
      .setText(FOOD_GLYPHS[this.state.food.kind])
      .setFontSize(Math.round(cell * 0.72))
      .setPosition(point.x, point.y + 1)
      .setScale(pulse);
    label
      .setText(`+${definition.points}`)
      .setPosition(point.x, point.y - cell * 0.56)
      .setVisible(cell >= 25);
  }

  private renderSnake(cell: number): void {
    const graphics = this.snakeGraphics!;
    const evolution = getEvolution(this.state);
    const head = this.state.snake[0]!;
    const headPoint = this.toPixels(head);
    const pulse =
      evolution.effect === "pulse" || evolution.effect === "chaos"
        ? 1 + Math.sin(this.state.ticks * 0.7) * 0.08
        : 1;

    graphics.clear();
    if (evolution.effect === "glow" || evolution.effect === "chaos") {
      graphics.fillStyle(evolution.accentColor, 0.13);
      graphics.fillCircle(headPoint.x, headPoint.y, cell * 0.92 * pulse);
    }

    for (let index = this.state.snake.length - 1; index >= 1; index -= 1) {
      const position = this.state.snake[index]!;
      const point = this.toPixels(position);
      const progress = index / Math.max(1, this.state.snake.length - 1);
      const radius = cell * (0.39 - progress * 0.09) * evolution.scale;
      graphics.fillStyle(
        index % 2 === 0 ? evolution.bodyColor : evolution.headColor,
        0.97,
      );
      graphics.fillCircle(point.x, point.y, radius);
      graphics.lineStyle(2, evolution.accentColor, 0.22);
      graphics.strokeCircle(point.x, point.y, radius);
    }

    const headRadius = cell * 0.47 * evolution.scale * pulse;
    graphics.fillStyle(evolution.headColor, 1);
    graphics.fillCircle(headPoint.x, headPoint.y, headRadius);
    graphics.lineStyle(3, evolution.accentColor, 0.82);
    graphics.strokeCircle(headPoint.x, headPoint.y, headRadius);

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

    graphics.lineStyle(2, evolution.accentColor, 0.9);
    const mouthCenter = {
      x: headPoint.x + vector.x * cell * 0.3,
      y: headPoint.y + vector.y * cell * 0.3,
    };
    graphics.strokeCircle(mouthCenter.x, mouthCenter.y, cell * 0.055);

    if (evolution.effect === "sparkles" || evolution.effect === "chaos") {
      graphics.fillStyle(evolution.accentColor, 0.86);
      for (let index = 0; index < 4; index += 1) {
        const angle = this.state.ticks * 0.35 + index * (Math.PI / 2);
        graphics.fillCircle(
          headPoint.x + Math.cos(angle) * cell * 0.72,
          headPoint.y + Math.sin(angle) * cell * 0.72,
          2.4,
        );
      }
    }
  }

  private createBurst(position: Position, color: number, amount = 9): void {
    const point = this.toPixels(position);
    for (let index = 0; index < amount; index += 1) {
      const angle = (Math.PI * 2 * index) / amount;
      const particle = this.add.circle(point.x, point.y, 4, color, 0.95);
      this.tweens.add({
        targets: particle,
        x: point.x + Math.cos(angle) * Phaser.Math.Between(28, 62),
        y: point.y + Math.sin(angle) * Phaser.Math.Between(28, 62),
        alpha: 0,
        scale: 0.35,
        duration: 320,
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }
}
