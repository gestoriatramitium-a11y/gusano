import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SynthAudio } from "./audio/SynthAudio";
import { DebugPanel } from "./components/DebugPanel";
import { GameCanvas, type GameController } from "./components/GameCanvas";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { ProgressPanel } from "./components/ProgressPanel";
import { ResultScreen } from "./components/ResultScreen";
import { SettingsPanel } from "./components/SettingsPanel";
import { ACHIEVEMENT_CATALOG, MISSION_CATALOG } from "./core/challenges";
import {
  EVOLUTIONS,
  FOOD_CATALOG,
  type Direction,
  type GameEvent,
  type GameSnapshot,
  type TimedEffectKind,
} from "./core/game";
import {
  completeRun,
  createInitialPlayerProgress,
  getEvolutionProgress,
  parsePlayerProgress,
  serializePlayerProgress,
  type PlayerProgress,
} from "./core/progress";
import {
  DEFAULT_PLAYER_PREFERENCES,
  parsePlayerPreferences,
  resolveGraphicsQuality,
  serializePlayerPreferences,
  shouldReduceMotion,
  type EffectiveGraphicsQuality,
  type GraphicsQualityPreference,
  type PlayerPreferences,
} from "./core/preferences";
import {
  createShareText,
  formatDuration,
  selectResultPhrase,
  type ResultContext,
} from "./core/results";
import { shareResultText } from "./utils/shareResult";

const LEGACY_BEST_SCORE_KEY = "meme-evolution-snake:best-score";
const PREVIOUS_PLAYER_PROGRESS_KEY = "meme-evolution-snake:player-progress:v1";
const SECOND_PLAYER_PROGRESS_KEY = "meme-evolution-snake:player-progress:v2";
const PLAYER_PROGRESS_KEY = "meme-evolution-snake:player-progress:v3";
const PLAYER_PREFERENCES_KEY = "meme-evolution-snake:preferences:v1";

const EAT_MESSAGES = [
  "¡Ese meme estaba delicioso!",
  "Tu poder absurdo aumenta",
  "Nutrición cuestionable. Resultado excelente.",
  "¡ÑAM! La ciencia no puede explicarlo.",
] as const;

type Screen = "start" | "onboarding" | "playing" | "game-over";

interface UnlockNotice {
  readonly id: string;
  readonly kind: "achievement" | "mission";
  readonly title: string;
}

function readPlayerProgress(): PlayerProgress {
  try {
    return parsePlayerProgress(
      localStorage.getItem(PLAYER_PROGRESS_KEY) ??
        localStorage.getItem(SECOND_PLAYER_PROGRESS_KEY) ??
        localStorage.getItem(PREVIOUS_PLAYER_PROGRESS_KEY),
      localStorage.getItem(LEGACY_BEST_SCORE_KEY),
    );
  } catch {
    return createInitialPlayerProgress();
  }
}

function readPlayerPreferences(): PlayerPreferences {
  try {
    return parsePlayerPreferences(localStorage.getItem(PLAYER_PREFERENCES_KEY));
  } catch {
    return DEFAULT_PLAYER_PREFERENCES;
  }
}

function storePlayerPreferences(preferences: PlayerPreferences): void {
  try {
    localStorage.setItem(
      PLAYER_PREFERENCES_KEY,
      serializePlayerPreferences(preferences),
    );
  } catch {
    // Las preferencias siguen activas durante la sesión.
  }
}

function detectGraphicsQuality(
  preference: GraphicsQualityPreference,
): EffectiveGraphicsQuality {
  const navigatorWithMemory = navigator as Navigator & {
    readonly deviceMemory?: number;
  };
  return resolveGraphicsQuality(preference, {
    hardwareConcurrency: navigator.hardwareConcurrency,
    ...(typeof navigatorWithMemory.deviceMemory === "number"
      ? { deviceMemoryGb: navigatorWithMemory.deviceMemory }
      : {}),
    devicePixelRatio: window.devicePixelRatio,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
  });
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

function effectLabel(effect: TimedEffectKind): string {
  return effect === "speed-boost" ? "☕ Turbo café" : "⚡ Puntos x2";
}

export function App() {
  const [controller, setController] = useState<GameController | null>(null);
  const [engineRequested, setEngineRequested] = useState(false);
  const [engineError, setEngineError] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [progress, setProgress] = useState(readPlayerProgress);
  const [announcement, setAnnouncement] = useState("");
  const [celebration, setCelebration] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [preferences, setPreferences] = useState(readPlayerPreferences);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [effectiveQuality, setEffectiveQuality] =
    useState<EffectiveGraphicsQuality>(() =>
      detectGraphicsQuality(readPlayerPreferences().graphicsQuality),
    );
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const [previousBestScore, setPreviousBestScore] = useState(
    progress.bestScore,
  );
  const [unlockNotices, setUnlockNotices] = useState<readonly UnlockNotice[]>(
    [],
  );
  const announcementTimer = useRef<number | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const runRecorded = useRef(false);
  const pendingStart = useRef(false);
  const progressRef = useRef(progress);
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

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const reduceMotion = shouldReduceMotion(preferences, systemReducedMotion);

  useEffect(() => {
    storePlayerPreferences(preferences);
    controller?.setVisualPreferences(
      preferences.graphicsQuality,
      effectiveQuality,
      reduceMotion,
    );
  }, [controller, effectiveQuality, preferences, reduceMotion]);

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
        const update = completeRun(progressRef.current, nextSnapshot);
        const achievementNotices = update.newlyUnlockedAchievementIds.map(
          (id): UnlockNotice => ({
            id,
            kind: "achievement",
            title:
              ACHIEVEMENT_CATALOG.find((achievement) => achievement.id === id)
                ?.title ?? id,
          }),
        );
        const missionNotices = update.newlyCompletedMissionIds.map(
          (id): UnlockNotice => ({
            id,
            kind: "mission",
            title:
              MISSION_CATALOG.find((mission) => mission.id === id)?.title ?? id,
          }),
        );
        setPreviousBestScore(update.previousBestScore);
        setIsNewRecord(update.isNewRecord);
        setUnlockNotices([...achievementNotices, ...missionNotices]);
        progressRef.current = update.progress;
        storePlayerProgress(update.progress);
        setProgress(update.progress);
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
        if (!reduceMotion)
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
        if (!reduceMotion) navigator.vibrate?.([45, 30, 70]);
        if (celebrationTimer.current !== null)
          window.clearTimeout(celebrationTimer.current);
        celebrationTimer.current = window.setTimeout(
          () => setCelebration(null),
          reduceMotion ? 180 : 900,
        );
      } else if (event.type === "game-over") {
        audio.current?.playGameOver();
        if (!reduceMotion) navigator.vibrate?.([90, 45, 120]);
      }
    },
    [announce, reduceMotion],
  );

  const beginRun = useCallback(
    (gameController: GameController) => {
      audio.current ??= new SynthAudio();
      audio.current.setMuted(!soundEnabled);
      void audio.current.unlock();
      runRecorded.current = false;
      setPreviousBestScore(progressRef.current.bestScore);
      setIsNewRecord(false);
      setUnlockNotices([]);
      setAnnouncement("");
      setCelebration(null);
      setSharePreview("");
      setCopyStatus("");
      setScreen("playing");
      gameController.startRun();
    },
    [soundEnabled],
  );

  useEffect(() => {
    if (!controller || !pendingStart.current) return;
    pendingStart.current = false;
    beginRun(controller);
  }, [beginRun, controller]);

  const requestStart = useCallback(() => {
    setEngineError(false);
    setEngineRequested(true);
    if (!preferences.tutorialSeen) {
      setScreen("onboarding");
      return;
    }
    if (controller) beginRun(controller);
    else pendingStart.current = true;
  }, [beginRun, controller, preferences.tutorialSeen]);

  const returnToStart = useCallback(() => {
    pendingStart.current = false;
    runRecorded.current = false;
    if (announcementTimer.current !== null) {
      window.clearTimeout(announcementTimer.current);
      announcementTimer.current = null;
    }
    if (celebrationTimer.current !== null) {
      window.clearTimeout(celebrationTimer.current);
      celebrationTimer.current = null;
    }
    navigator.vibrate?.(0);
    audio.current?.close();
    audio.current = null;
    setExitConfirmationOpen(false);
    setAnnouncement("");
    setCelebration(null);
    setSharePreview("");
    setCopyStatus("");
    setSnapshot(null);
    setEngineRequested(false);
    setScreen("start");
  }, []);

  const requestReturnToStart = useCallback(() => {
    if (screen === "playing" && snapshot?.status === "playing") {
      controller?.setPaused(true);
      setExitConfirmationOpen(true);
      return;
    }
    returnToStart();
  }, [controller, returnToStart, screen, snapshot?.status]);

  const continueRun = useCallback(() => {
    controller?.setPaused(false);
    setExitConfirmationOpen(false);
  }, [controller]);

  const completeOnboarding = useCallback(() => {
    if (!controller) return;
    setPreferences((current) => ({ ...current, tutorialSeen: true }));
    beginRun(controller);
  }, [beginRun, controller]);

  const showTutorial = useCallback(() => {
    pendingStart.current = false;
    setEngineRequested(true);
    setScreen("onboarding");
  }, []);

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
    const context: ResultContext = {
      ...snapshot,
      previousBestScore,
      isNewRecord,
    };
    const phrase = selectResultPhrase(context);
    const text = createShareText(context, phrase.text);
    setSharePreview(text);
    const outcome = await shareResultText(text, {
      ...(typeof navigator.share === "function"
        ? {
            nativeShare: (shareText: string) =>
              navigator.share({
                title: "Meme Evolution Snake",
                text: shareText,
              }),
          }
        : {}),
      ...(typeof navigator.clipboard?.writeText === "function"
        ? {
            copyText: (shareText: string) =>
              navigator.clipboard.writeText(shareText),
          }
        : {}),
    });
    const statuses = {
      shared: "¡Resultado compartido! El caos viaja.",
      copied: "¡Reto copiado! Ya puedes compartirlo donde quieras.",
      manual: "Copia el texto de abajo para compartir tu reto.",
      cancelled: "Compartición cancelada. El reto sigue preparado.",
    } as const;
    setCopyStatus(statuses[outcome]);
    announce(statuses[outcome], 2200);
  }, [announce, isNewRecord, previousBestScore, snapshot]);

  const score = snapshot?.score ?? 0;
  const currentEvolution = snapshot?.evolutionName ?? "Mini Bicho Meme";
  const elapsedMs = snapshot?.elapsedMs ?? 0;
  const evolutionProgress = getEvolutionProgress(snapshot?.experience ?? 0);
  const resultPhrase = useMemo(
    () =>
      snapshot
        ? selectResultPhrase({
            ...snapshot,
            previousBestScore,
            isNewRecord,
          })
        : null,
    [isNewRecord, previousBestScore, snapshot],
  );
  const debugEnabled =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  return (
    <main
      className="app-shell"
      data-reduce-motion={reduceMotion ? "true" : "false"}
      data-screen={screen}
    >
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
              {screen === "playing" && (
                <button
                  className="home-button"
                  type="button"
                  onClick={requestReturnToStart}
                  data-testid="home-button"
                >
                  Inicio
                </button>
              )}
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
              <span className="status-pill" data-testid="quality-indicator">
                {screen === "playing"
                  ? `Caos ${Math.min(99, (snapshot?.difficultyLevel ?? 0) + 1)} · ${effectiveQuality === "reduced" ? "Eco" : "Normal"}`
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
              <strong className="hud__value">
                {formatDuration(elapsedMs)}
              </strong>
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
            {engineRequested ? (
              <GameCanvas
                onController={handleController}
                onEvent={handleEvent}
                onSnapshot={handleSnapshot}
                onQualityChange={setEffectiveQuality}
                onLoadError={() => setEngineError(true)}
                qualityPreference={preferences.graphicsQuality}
                effectiveQuality={effectiveQuality}
                reduceMotion={reduceMotion}
              />
            ) : (
              <div className="canvas-shell canvas-shell--deferred" />
            )}

            <p className="sr-only" id="game-instructions">
              Controla la serpiente con flechas o WASD. En móvil, desliza o usa
              los cuatro botones. Recoge memes para ganar puntos y experiencia;
              evita las paredes y tu propio cuerpo.
            </p>

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

            {exitConfirmationOpen && (
              <div
                className="screen-overlay screen-overlay--exit"
                data-testid="exit-confirmation"
              >
                <div
                  className="exit-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="exit-dialog-title"
                >
                  <span className="exit-dialog__icon" aria-hidden="true">
                    ↩
                  </span>
                  <h2 id="exit-dialog-title">¿Salir de la partida?</h2>
                  <p>
                    Esta carrera no se guardará. Tu récord anterior seguirá a
                    salvo.
                  </p>
                  <div className="exit-dialog__actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={continueRun}
                      autoFocus
                      data-testid="continue-button"
                    >
                      Continuar jugando
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={returnToStart}
                      data-testid="confirm-exit-button"
                    >
                      Salir al inicio
                    </button>
                  </div>
                </div>
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
                      onClick={requestStart}
                      disabled={engineError}
                      data-testid="start-button"
                    >
                      {engineRequested && !controller
                        ? "Preparando…"
                        : engineError
                          ? "Error al cargar"
                          : "Jugar"}
                    </button>
                    <p className="hint">
                      WASD / flechas · desliza o usa los controles táctiles
                    </p>
                  </div>

                  <div className="menu-side">
                    <ProgressPanel progress={progress} />
                    <SettingsPanel
                      preferences={preferences}
                      effectiveQuality={effectiveQuality}
                      systemReducedMotion={systemReducedMotion}
                      onQualityChange={(graphicsQuality) => {
                        setPreferences((current) => ({
                          ...current,
                          graphicsQuality,
                        }));
                        setEffectiveQuality(
                          detectGraphicsQuality(graphicsQuality),
                        );
                      }}
                      onReduceMotionChange={(reduce) =>
                        setPreferences((current) => ({
                          ...current,
                          reduceMotion: reduce,
                        }))
                      }
                      onShowTutorial={showTutorial}
                    />
                  </div>
                </div>
              </div>
            )}

            {screen === "onboarding" && (
              <OnboardingOverlay
                engineReady={controller !== null}
                onComplete={completeOnboarding}
              />
            )}

            {screen === "game-over" && snapshot && resultPhrase && (
              <ResultScreen
                snapshot={snapshot}
                phrase={resultPhrase}
                previousBestScore={previousBestScore}
                personalBest={progress.bestScore}
                isNewRecord={isNewRecord}
                sharePreview={sharePreview}
                shareStatus={copyStatus}
                onHome={requestReturnToStart}
                onRestart={requestStart}
                onShare={() => void copyResult()}
              />
            )}
          </div>

          {unlockNotices.length > 0 && screen === "game-over" && (
            <div
              className="unlock-stack"
              role="status"
              aria-label="Nuevos desbloqueos"
              data-testid="unlock-notifications"
            >
              {unlockNotices.slice(0, 3).map((notice) => (
                <div
                  className={`unlock-notice unlock-notice--${notice.kind}`}
                  key={`${notice.kind}-${notice.id}`}
                >
                  <span>
                    {notice.kind === "achievement" ? "Logro" : "Misión"}
                  </span>
                  <strong>{notice.title}</strong>
                </div>
              ))}
              {unlockNotices.length > 3 && (
                <div className="unlock-notice unlock-notice--more">
                  <strong>+{unlockNotices.length - 3} desbloqueos más</strong>
                </div>
              )}
            </div>
          )}

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
          {debugEnabled && (
            <DebugPanel snapshot={snapshot} quality={effectiveQuality} />
          )}
        </section>
      </div>
    </main>
  );
}
