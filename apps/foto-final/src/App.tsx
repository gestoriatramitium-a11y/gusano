import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SynthAudio } from "./audio/SynthAudio";
import { GameCanvas, type GameController } from "./components/GameCanvas";
import {
  EVOLUTIONS,
  FOOD_CATALOG,
  type Direction,
  type GameEvent,
  type GameSnapshot,
  type TimedEffectKind,
} from "./core/game";
import {
  createInitialPlayerProgress,
  createShareText,
  getEvolutionProgress,
  getProgressObjectives,
  parsePlayerProgress,
  recordCompletedRun,
  serializePlayerProgress,
  type PlayerProgress,
  type ProgressObjective,
} from "./core/progress";

const LEGACY_BEST_SCORE_KEY = "meme-evolution-snake:best-score";
const PLAYER_PROGRESS_KEY = "meme-evolution-snake:player-progress:v1";

const EAT_MESSAGES = [
  "¡Ese meme estaba delicioso!",
  "Tu poder absurdo aumenta",
  "Nutrición cuestionable. Resultado excelente.",
  "¡ÑAM! La ciencia no puede explicarlo.",
] as const;

const DEFEAT_MESSAGES = [
  "Tu bicho necesitaba más memes.",
  "El universo no estaba preparado.",
  "Has muerto con dignidad... más o menos.",
] as const;

type Screen = "start" | "playing" | "game-over";

function readPlayerProgress(): PlayerProgress {
  try {
    return parsePlayerProgress(
      localStorage.getItem(PLAYER_PROGRESS_KEY),
      localStorage.getItem(LEGACY_BEST_SCORE_KEY),
    );
  } catch {
    return createInitialPlayerProgress();
  }
}

function storePlayerProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(
      PLAYER_PROGRESS_KEY,
      serializePlayerProgress(progress),
    );
    localStorage.setItem(LEGACY_BEST_SCORE_KEY, String(progress.bestScore));
  } catch {
    // La partida continúa si el navegador bloquea el almacenamiento local.
  }
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function evolutionName(id: PlayerProgress["highestEvolutionId"]): string {
  return (
    EVOLUTIONS.find((evolution) => evolution.id === id)?.name ??
    "Mini Bicho Meme"
  );
}

function effectLabel(effect: TimedEffectKind): string {
  return effect === "speed-boost" ? "☕ Turbo café" : "⚡ Puntos x2";
}

function objectiveValue(objective: ProgressObjective): string {
  if (objective.unit === "milliseconds") {
    return `${formatTime(objective.current)} / ${formatTime(objective.target)}`;
  }
  if (objective.unit === "memes")
    return `${objective.current} / ${objective.target}`;
  return `${objective.percent}%`;
}

export function App() {
  const [controller, setController] = useState<GameController | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [progress, setProgress] = useState(readPlayerProgress);
  const [announcement, setAnnouncement] = useState("");
  const [celebration, setCelebration] = useState<string | null>(null);
  const [defeatMessage, setDefeatMessage] = useState<string>(
    DEFEAT_MESSAGES[0],
  );
  const [sharePreview, setSharePreview] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const announcementTimer = useRef<number | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const runRecorded = useRef(false);
  const progressRef = useRef(progress);
  const bestBeforeRun = useRef(progress.bestScore);
  const audio = useRef<SynthAudio | null>(null);

  useEffect(
    () => () => {
      if (announcementTimer.current !== null)
        window.clearTimeout(announcementTimer.current);
      if (celebrationTimer.current !== null)
        window.clearTimeout(celebrationTimer.current);
      audio.current?.close();
    },
    [],
  );

  const announce = useCallback((message: string, duration = 1900) => {
    setAnnouncement(message);
    if (announcementTimer.current !== null)
      window.clearTimeout(announcementTimer.current);
    announcementTimer.current = window.setTimeout(
      () => setAnnouncement(""),
      duration,
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
      if (!runRecorded.current) {
        runRecorded.current = true;
        setIsNewRecord(
          nextSnapshot.score > 0 && nextSnapshot.score > bestBeforeRun.current,
        );
        const updated = recordCompletedRun(progressRef.current, nextSnapshot);
        progressRef.current = updated;
        storePlayerProgress(updated);
        setProgress(updated);
      }
    } else if (nextSnapshot.status === "playing") {
      setScreen("playing");
    }
  }, []);

  const handleEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === "ate") {
        audio.current?.playFood(event.kind);
        const food = FOOD_CATALOG[event.kind];
        const baseMessage =
          event.rarity === "legendary"
            ? `¡${food.name.toUpperCase()}! Esto no debería existir.`
            : EAT_MESSAGES[event.tick % EAT_MESSAGES.length];
        announce(
          `${baseMessage} +${event.points}${event.multiplier > 1 ? " x2" : ""} · +${event.experience} XP`,
        );
        navigator.vibrate?.(event.rarity === "legendary" ? [55, 25, 90] : 35);
      } else if (event.type === "effect-started") {
        announce(
          event.effect === "speed-boost"
            ? "¡CAFÉ INFINITO! Turbo absurdo durante 6 segundos."
            : "¡Has absorbido demasiado cringe! Puntos x2.",
          2400,
        );
      } else if (event.type === "effect-expired") {
        announce(
          event.effect === "speed-boost"
            ? "El café abandonó tu sistema."
            : "El cringe vuelve a niveles legales.",
        );
      } else if (event.type === "evolved") {
        const nextEvolution = EVOLUTIONS.find(
          (candidate) => candidate.id === event.to,
        );
        const name = nextEvolution?.name ?? "Poder meme desbloqueado";
        setCelebration(name);
        audio.current?.playEvolution();
        navigator.vibrate?.([45, 30, 70]);
        if (celebrationTimer.current !== null)
          window.clearTimeout(celebrationTimer.current);
        celebrationTimer.current = window.setTimeout(
          () => setCelebration(null),
          900,
        );
      } else if (event.type === "game-over") {
        setDefeatMessage(DEFEAT_MESSAGES[event.tick % DEFEAT_MESSAGES.length]!);
        audio.current?.playGameOver();
        navigator.vibrate?.([90, 45, 120]);
      }
    },
    [announce],
  );

  const startGame = useCallback(() => {
    if (!controller) return;
    audio.current ??= new SynthAudio();
    audio.current.setMuted(!soundEnabled);
    void audio.current.unlock();
    runRecorded.current = false;
    bestBeforeRun.current = progress.bestScore;
    setIsNewRecord(false);
    setAnnouncement("");
    setCelebration(null);
    setSharePreview("");
    setCopyStatus("");
    setScreen("playing");
    controller.startRun();
  }, [controller, progress.bestScore, soundEnabled]);

  const changeDirection = useCallback(
    (direction: Direction) => controller?.changeDirection(direction),
    [controller],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      audio.current ??= new SynthAudio();
      audio.current.setMuted(!next);
      return next;
    });
  }, []);

  const copyResult = useCallback(async () => {
    if (!snapshot) return;
    const text = createShareText(snapshot);
    setSharePreview(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("¡Reto copiado! Ya puedes compartirlo donde quieras.");
      announce("¡Resultado copiado!", 2200);
    } catch {
      setCopyStatus("Copia el texto de abajo para compartir tu reto.");
      announce("Texto listo para copiar.", 2200);
    }
  }, [announce, snapshot]);

  const score = snapshot?.score ?? 0;
  const currentEvolution = snapshot?.evolutionName ?? "Mini Bicho Meme";
  const elapsedMs = snapshot?.elapsedMs ?? 0;
  const evolutionProgress = getEvolutionProgress(snapshot?.experience ?? 0);
  const objectives = useMemo(() => getProgressObjectives(progress), [progress]);

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
            <div className="header-actions">
              <button
                className="sound-button"
                type="button"
                aria-label={
                  soundEnabled ? "Silenciar sonidos" : "Activar sonidos"
                }
                aria-pressed={!soundEnabled}
                onClick={toggleSound}
              >
                {soundEnabled ? "🔊" : "🔇"}
              </button>
              <span className="status-pill">
                {screen === "playing"
                  ? `Caos ${Math.min(99, (snapshot?.difficultyLevel ?? 0) + 1)}`
                  : "Modo local"}
              </span>
            </div>
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
              <strong className="hud__value">{progress.bestScore}</strong>
            </div>
            <div className="hud__item hud__item--evolution">
              <span className="hud__label">Evolución</span>
              <strong className="hud__value">{currentEvolution}</strong>
            </div>
            <div className="hud__item">
              <span className="hud__label">Tiempo</span>
              <strong className="hud__value">{formatTime(elapsedMs)}</strong>
            </div>
          </div>

          <div
            className="evolution-meter"
            role="progressbar"
            aria-label="Progreso de evolución"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={evolutionProgress.percent}
            data-testid="evolution-meter"
          >
            <div className="evolution-meter__meta">
              <span>{evolutionProgress.current.name}</span>
              <strong>
                {evolutionProgress.next
                  ? `${evolutionProgress.percent}% · ${evolutionProgress.experienceInLevel}/${evolutionProgress.experienceRequired} XP → ${evolutionProgress.next.name}`
                  : "Poder máximo desbloqueado"}
              </strong>
            </div>
            <div className="evolution-meter__track">
              <span style={{ width: `${evolutionProgress.percent}%` }} />
            </div>
          </div>

          {screen === "playing" &&
            (snapshot?.activeEffects.length ?? 0) > 0 && (
              <div className="effect-rack" aria-label="Efectos activos">
                {snapshot?.activeEffects.map((effect) => (
                  <span
                    className={`effect-chip effect-chip--${effect.kind}`}
                    key={effect.kind}
                  >
                    {effectLabel(effect.kind)} ·{" "}
                    {Math.max(
                      1,
                      Math.ceil((effect.expiresAtMs - elapsedMs) / 1000),
                    )}
                    s
                  </span>
                ))}
              </div>
            )}

          <div className="play-area">
            <GameCanvas
              onController={handleController}
              onEvent={handleEvent}
              onSnapshot={handleSnapshot}
            />

            {announcement && screen === "playing" && (
              <div
                className="game-toast"
                role="status"
                data-testid="game-toast"
              >
                {announcement}
              </div>
            )}

            {celebration && (
              <div
                className="evolution-celebration"
                aria-live="assertive"
                data-testid="evolution-celebration"
              >
                <span>¡Evolución!</span>
                <strong>{celebration}</strong>
              </div>
            )}

            {screen === "start" && (
              <div
                className="screen-overlay screen-overlay--menu"
                data-testid="start-screen"
              >
                <div className="menu-panel">
                  <div className="hero">
                    <p className="eyebrow">Pequeño. Ridículo. Imparable.</p>
                    <h2 className="logo">
                      Meme Evolution <span>Snake</span>
                    </h2>
                    <div className="bicho-preview" aria-hidden="true" />
                    <p className="hero__copy">
                      Come rarezas, encadena giros y evoluciona antes de que el
                      caos te alcance.
                    </p>
                    <div className="record-callout">
                      <span>Tu récord</span>
                      <strong>{progress.bestScore}</strong>
                    </div>
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

                  <aside
                    className="local-progress"
                    aria-label="Tus hazañas locales"
                  >
                    <p className="panel-kicker">Tus hazañas</p>
                    <div className="player-stats">
                      <div>
                        <strong data-testid="stats-games">
                          {progress.gamesPlayed}
                        </strong>
                        <span>Partidas</span>
                      </div>
                      <div>
                        <strong>{progress.totalFood}</strong>
                        <span>Memes</span>
                      </div>
                      <div>
                        <strong>
                          {evolutionName(progress.highestEvolutionId)}
                        </strong>
                        <span>Evolución máxima</span>
                      </div>
                      <div>
                        <strong>{formatTime(progress.bestSurvivalMs)}</strong>
                        <span>Mejor tiempo</span>
                      </div>
                    </div>
                    <div className="objective-list">
                      {objectives.map((objective) => (
                        <article
                          className={`objective ${objective.completed ? "objective--done" : ""}`}
                          key={objective.id}
                        >
                          <div>
                            <strong>
                              {objective.completed ? "✓ " : ""}
                              {objective.title}
                            </strong>
                            <span>{objectiveValue(objective)}</span>
                          </div>
                          <div className="objective__track">
                            <span style={{ width: `${objective.percent}%` }} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </aside>
                </div>
              </div>
            )}

            {screen === "game-over" && (
              <div
                className="screen-overlay screen-overlay--defeat"
                data-testid="game-over"
              >
                <div className="defeat-card">
                  <p className="eyebrow">Fin de la evolución</p>
                  <h2>
                    Has creado un <span>{currentEvolution}</span> nivel{" "}
                    {snapshot?.eaten ?? 0}
                  </h2>
                  <p className="defeat-card__copy">{defeatMessage}</p>
                  {isNewRecord && (
                    <p className="new-record">🏆 ¡Nuevo récord personal!</p>
                  )}
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
                      <strong>{formatTime(elapsedMs)}</strong>
                      <span>Tiempo</span>
                    </div>
                  </div>
                  <div className="defeat-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={startGame}
                      data-testid="restart-button"
                    >
                      Volver a jugar
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void copyResult()}
                      data-testid="share-button"
                    >
                      Compartir
                    </button>
                  </div>
                  {sharePreview && (
                    <div className="share-result" data-testid="share-result">
                      <label htmlFor="share-text">Tu reto está listo</label>
                      <textarea
                        id="share-text"
                        readOnly
                        value={sharePreview}
                        rows={3}
                      />
                      <span>{copyStatus}</span>
                    </div>
                  )}
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
            {announcement || copyStatus}
          </p>
        </section>
      </div>
    </main>
  );
}
