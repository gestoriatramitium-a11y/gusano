import { useEffect, useRef } from "react";

import type { GameEvent, GameSnapshot } from "../core/game";
import type { CountryCode } from "../core/countries";
import type {
  EffectiveGraphicsQuality,
  GraphicsQualityPreference,
} from "../core/preferences";
import type { MemeSnakeScene } from "../game/MemeSnakeScene";
import type { WorldNotification } from "../core/world";

export interface GameController {
  changeDirection(direction: "up" | "down" | "left" | "right"): void;
  startRun(): void;
  setPaused(paused: boolean): void;
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
  onWorldEvent(event: WorldNotification): void;
  onQualityChange(quality: EffectiveGraphicsQuality): void;
  onLoadError(): void;
  qualityPreference: GraphicsQualityPreference;
  effectiveQuality: EffectiveGraphicsQuality;
  reduceMotion: boolean;
  countryCode: CountryCode;
}

export function GameCanvas({
  onController,
  onEvent,
  onSnapshot,
  onWorldEvent,
  onQualityChange,
  onLoadError,
  qualityPreference,
  effectiveQuality,
  reduceMotion,
  countryCode,
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
    onWorldEvent,
    onQualityChange,
    onLoadError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onEvent,
      onSnapshot,
      onWorldEvent,
      onQualityChange,
      onLoadError,
    };
  }, [onEvent, onLoadError, onQualityChange, onSnapshot, onWorldEvent]);

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
          onWorldEvent: (event) => callbacksRef.current.onWorldEvent(event),
          onQualityChange: (quality) =>
            callbacksRef.current.onQualityChange(quality),
          qualityPreference: initialVisuals.qualityPreference,
          initialQuality: initialVisuals.effectiveQuality,
          reduceMotion: initialVisuals.reduceMotion,
          playerCountryCode: countryCode,
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
          setPaused: (paused) => scene.setPaused(paused),
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
  }, [countryCode, onController]);

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
