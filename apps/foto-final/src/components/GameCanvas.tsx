import { useEffect, useRef } from "react";

import type { GameEvent, GameSnapshot } from "../core/game";
import type {
  EffectiveGraphicsQuality,
  GraphicsQualityPreference,
} from "../core/preferences";
import type { MemeSnakeScene } from "../game/MemeSnakeScene";

export interface GameController {
  changeDirection(direction: "up" | "down" | "left" | "right"): void;
  startRun(): void;
  setVisualPreferences(
    qualityPreference: GraphicsQualityPreference,
    effectiveQuality: EffectiveGraphicsQuality,
    reduceMotion: boolean,
  ): void;
}

interface GameCanvasProps {
  onController(controller: GameController | null): void;
  onEvent(event: GameEvent): void;
  onSnapshot(snapshot: GameSnapshot): void;
  onQualityChange(quality: EffectiveGraphicsQuality): void;
  onLoadError(): void;
  qualityPreference: GraphicsQualityPreference;
  effectiveQuality: EffectiveGraphicsQuality;
  reduceMotion: boolean;
}

export function GameCanvas({
  onController,
  onEvent,
  onSnapshot,
  onQualityChange,
  onLoadError,
  qualityPreference,
  effectiveQuality,
  reduceMotion,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MemeSnakeScene | null>(null);
  const initialVisualsRef = useRef({
    qualityPreference,
    effectiveQuality,
    reduceMotion,
  });
  const callbacksRef = useRef({
    onEvent,
    onSnapshot,
    onQualityChange,
    onLoadError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onEvent,
      onSnapshot,
      onQualityChange,
      onLoadError,
    };
  }, [onEvent, onLoadError, onQualityChange, onSnapshot]);

  useEffect(() => {
    sceneRef.current?.setVisualPreferences(
      qualityPreference,
      effectiveQuality,
      reduceMotion,
    );
  }, [effectiveQuality, qualityPreference, reduceMotion]);

  useEffect(() => {
    const parent = containerRef.current;

    if (!parent) {
      return;
    }

    let cancelled = false;
    let game: import("phaser").Game | null = null;
    const initialVisuals = initialVisualsRef.current;

    void Promise.all([import("phaser"), import("../game/MemeSnakeScene")])
      .then(([phaserModule, sceneModule]) => {
        if (cancelled) return;
        const Phaser = phaserModule.default;
        const scene = new sceneModule.MemeSnakeScene({
          onEvent: (event) => callbacksRef.current.onEvent(event),
          onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
          onQualityChange: (quality) =>
            callbacksRef.current.onQualityChange(quality),
          qualityPreference: initialVisuals.qualityPreference,
          initialQuality: initialVisuals.effectiveQuality,
          reduceMotion: initialVisuals.reduceMotion,
        });
        sceneRef.current = scene;
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          width: 900,
          height: 620,
          parent,
          backgroundColor: "#100a28",
          render: {
            antialias: initialVisuals.effectiveQuality === "normal",
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
          setVisualPreferences: (
            nextPreference,
            nextQuality,
            nextReduceMotion,
          ) =>
            scene.setVisualPreferences(
              nextPreference,
              nextQuality,
              nextReduceMotion,
            ),
        });
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onLoadError();
      });

    return () => {
      cancelled = true;
      onController(null);
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, [onController]);

  return (
    <div
      ref={containerRef}
      className="canvas-shell"
      aria-label="Tablero de Meme Evolution Snake"
      aria-describedby="game-instructions"
      data-quality={effectiveQuality}
      role="application"
    />
  );
}
