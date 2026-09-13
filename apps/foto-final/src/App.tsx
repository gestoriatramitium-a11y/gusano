import { useCallback, useEffect, useRef, useState } from "react";

import { GameCanvas, type GameController } from "./components/GameCanvas";
import {
  EVOLUTIONS,
  FOOD_CATALOG,
  type Direction,
  type GameEvent,
  type GameSnapshot,
} from "./core/game";

const BEST_SCORE_KEY = "meme-evolution-snake:best-score";

type Screen = "start" | "playing" | "game-over";

function readBestScore(): number {
  try {
    const value = Number.parseInt(
      localStorage.getItem(BEST_SCORE_KEY) ?? "0",
      10,
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function storeBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // El juego sigue funcionando si el navegador bloquea el almacenamiento local.
  }
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function App() {
  const [controller, setController] = useState<GameController | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [bestScore, setBestScore] = useState(readBestScore);
  const [announcement, setAnnouncement] = useState("");
  const announcementTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (announcementTimer.current !== null) {
        window.clearTimeout(announcementTimer.current);
      }
    },
    [],
  );

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    if (announcementTimer.current !== null) {
      window.clearTimeout(announcementTimer.current);
    }
    announcementTimer.current = window.setTimeout(
      () => setAnnouncement(""),
      1800,
    );
  }, []);

  const handleController = useCallback(
    (nextController: GameController | null) => {
      setController(nextController);
    },
    [],
  );

  const handleSnapshot = useCallback((nextSnapshot: GameSnapshot) => {
    setSnapshot(nextSnapshot);
    if (nextSnapshot.status === "game-over") {
      setScreen("game-over");
      setBestScore((currentBest) => {
        const nextBest = Math.max(currentBest, nextSnapshot.score);
        if (nextBest !== currentBest) {
          storeBestScore(nextBest);
        }
        return nextBest;
      });
    } else if (nextSnapshot.status === "playing") {
      setScreen("playing");
    }
  }, []);

  const handleEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === "ate") {
        announce(`¡ÑAM! ${FOOD_CATALOG[event.kind].name}: +${event.points}`);
        navigator.vibrate?.(35);
      } else if (event.type === "evolved") {
        const evolution = EVOLUTIONS.find(
          (candidate) => candidate.id === event.to,
        );
        announce(`¡Evolución! ${evolution?.name ?? "Poder meme desbloqueado"}`);
        navigator.vibrate?.([45, 30, 70]);
      } else if (event.type === "game-over") {
        navigator.vibrate?.([90, 45, 120]);
      }
    },
    [announce],
  );

  const startGame = useCallback(() => {
    if (!controller) {
      return;
    }
    setAnnouncement("");
    setScreen("playing");
    controller.startRun();
  }, [controller]);

  const changeDirection = useCallback(
    (direction: Direction) => {
      controller?.changeDirection(direction);
    },
    [controller],
  );

  const score = snapshot?.score ?? 0;
  const evolution = snapshot?.evolutionName ?? "Mini Bicho Meme";
  const elapsedMs = snapshot?.elapsedMs ?? 0;

  return (
    <main className="app-shell">
      <div className="game-layout">
        <section className="game-card" aria-label="Meme Evolution Snake">
          <header className="game-header">
            <h1 className="mini-logo">
              <span className="mini-logo__mark" aria-hidden="true">
                ◉
              </span>
              Meme Evolution Snake
            </h1>
            <span className="status-pill">
              {screen === "playing" ? "Partida en curso" : "MVP local"}
            </span>
          </header>

          <div
            className="hud"
            data-testid="hud"
            aria-label="Marcador de la partida"
          >
            <div className="hud__item">
              <span className="hud__label">Puntos</span>
              <strong className="hud__value">{score}</strong>
            </div>
            <div className="hud__item">
              <span className="hud__label">Récord</span>
              <strong className="hud__value">{bestScore}</strong>
            </div>
            <div className="hud__item hud__item--evolution">
              <span className="hud__label">Evolución</span>
              <strong className="hud__value">{evolution}</strong>
            </div>
            <div className="hud__item">
              <span className="hud__label">Tiempo</span>
              <strong className="hud__value">{formatTime(elapsedMs)}</strong>
            </div>
          </div>

          <div className="play-area">
            <GameCanvas
              onController={handleController}
              onEvent={handleEvent}
              onSnapshot={handleSnapshot}
            />

            {screen === "start" && (
              <div className="screen-overlay" data-testid="start-screen">
                <div className="hero">
                  <p className="eyebrow">Pequeño. Ridículo. Imparable.</p>
                  <h2 className="logo">
                    Meme Evolution <span>Snake</span>
                  </h2>
                  <div className="bicho-preview" aria-hidden="true" />
                  <p className="hero__copy">
                    Guía a Mini Bicho Meme, devora objetos absurdos y evoluciona
                    hasta convertirte en Dios del Caos.
                  </p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={startGame}
                    disabled={!controller}
                    data-testid="start-button"
                  >
                    Jugar
                  </button>
                  <p className="hint">
                    WASD / flechas · desliza o usa los controles táctiles
                  </p>
                </div>
              </div>
            )}

            {screen === "game-over" && (
              <div className="screen-overlay" data-testid="game-over">
                <div className="defeat-card">
                  <p className="eyebrow">Fin de la evolución</p>
                  <h2>
                    Tu bicho <span>hizo crash</span>
                  </h2>
                  <p className="defeat-card__copy">
                    Sobreviviste {formatTime(elapsedMs)} y llegaste a{" "}
                    {evolution}.
                  </p>
                  <div className="result-grid" aria-label="Resultado final">
                    <div>
                      <strong>{score}</strong>
                      <span>Puntos</span>
                    </div>
                    <div>
                      <strong>{snapshot?.eaten ?? 0}</strong>
                      <span>Objetos</span>
                    </div>
                    <div>
                      <strong>{bestScore}</strong>
                      <span>Récord</span>
                    </div>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={startGame}
                    data-testid="restart-button"
                  >
                    Volver a jugar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="touch-controls" data-visible={screen === "playing"}>
            <button
              className="touch-button touch-button--up"
              type="button"
              aria-label="Mover arriba"
              onPointerDown={() => changeDirection("up")}
            >
              ↑
            </button>
            <button
              className="touch-button touch-button--left"
              type="button"
              aria-label="Mover a la izquierda"
              onPointerDown={() => changeDirection("left")}
            >
              ←
            </button>
            <button
              className="touch-button touch-button--down"
              type="button"
              aria-label="Mover abajo"
              onPointerDown={() => changeDirection("down")}
            >
              ↓
            </button>
            <button
              className="touch-button touch-button--right"
              type="button"
              aria-label="Mover a la derecha"
              onPointerDown={() => changeDirection("right")}
            >
              →
            </button>
          </div>

          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </section>
      </div>
    </main>
  );
}
