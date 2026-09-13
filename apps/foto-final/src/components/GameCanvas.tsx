import { useEffect, useRef } from "react";
import Phaser from "phaser";

import type { GameEvent, GameSnapshot } from "../core/game";
import { MemeSnakeScene } from "../game/MemeSnakeScene";

export interface GameController {
  changeDirection(direction: "up" | "down" | "left" | "right"): void;
  startRun(): void;
}

interface GameCanvasProps {
  onController(controller: GameController | null): void;
  onEvent(event: GameEvent): void;
  onSnapshot(snapshot: GameSnapshot): void;
}

export function GameCanvas({
  onController,
  onEvent,
  onSnapshot,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onEvent, onSnapshot });

  useEffect(() => {
    callbacksRef.current = { onEvent, onSnapshot };
  }, [onEvent, onSnapshot]);

  useEffect(() => {
    const parent = containerRef.current;

    if (!parent) {
      return;
    }

    const scene = new MemeSnakeScene({
      onEvent: (event) => callbacksRef.current.onEvent(event),
      onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
    });

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 900,
      height: 620,
      parent,
      backgroundColor: "#100a28",
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [scene],
      banner: false,
    });

    onController({
      changeDirection: (direction) => scene.changeDirection(direction),
      startRun: () => scene.startRun(),
    });

    return () => {
      onController(null);
      game.destroy(true);
    };
  }, [onController]);

  return (
    <div
      ref={containerRef}
      className="canvas-shell"
      aria-label="Tablero de Meme Evolution Snake"
      role="application"
    />
  );
}
