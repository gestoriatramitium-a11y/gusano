import {
  EVOLUTIONS,
  type Evolution,
  type EvolutionId,
  type GameSnapshot,
} from "./game";

export const PLAYER_PROGRESS_VERSION = 1 as const;

const MAX_STORED_NUMBER = Number.MAX_SAFE_INTEGER;
const MONSTRUO_MEME_ID: EvolutionId = "monstruo-meme";
const TOTAL_MEMES_GOAL = 100;
const SURVIVAL_GOAL_MS = 5 * 60 * 1000;

export interface PlayerProgress {
  readonly version: typeof PLAYER_PROGRESS_VERSION;
  readonly bestScore: number;
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly highestEvolutionId: EvolutionId;
  readonly bestSurvivalMs: number;
}

export type CompletedRun = Readonly<
  Pick<GameSnapshot, "score" | "eaten" | "evolutionId" | "elapsedMs">
>;

export interface EvolutionProgress {
  readonly current: Evolution;
  readonly next: Evolution | null;
  readonly eatenInLevel: number;
  readonly eatenRequired: number;
  readonly percent: number;
  readonly isMaxLevel: boolean;
}

export type ObjectiveId =
  "reach-monstruo-meme" | "collect-100-memes" | "survive-5-minutes";

export type ObjectiveUnit = "evolutions" | "memes" | "milliseconds";

export interface ProgressObjective {
  readonly id: ObjectiveId;
  readonly title: string;
  readonly current: number;
  readonly target: number;
  readonly unit: ObjectiveUnit;
  readonly percent: number;
  readonly completed: boolean;
}

function safeNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_STORED_NUMBER, Math.max(0, Math.trunc(value)));
}

function parseLegacyScore(value: unknown): number {
  if (typeof value === "string" && value.trim() !== "") {
    return safeNonNegativeInteger(Number(value));
  }
  return safeNonNegativeInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvolutionId(value: unknown): value is EvolutionId {
  return EVOLUTIONS.some((evolution) => evolution.id === value);
}

function evolutionIndex(id: EvolutionId): number {
  return EVOLUTIONS.findIndex((evolution) => evolution.id === id);
}

function evolutionById(id: EvolutionId): Evolution {
  return EVOLUTIONS.find((evolution) => evolution.id === id) ?? EVOLUTIONS[0]!;
}

function normalizedProgress(progress: PlayerProgress): PlayerProgress {
  return {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: safeNonNegativeInteger(progress.bestScore),
    gamesPlayed: safeNonNegativeInteger(progress.gamesPlayed),
    totalFood: safeNonNegativeInteger(progress.totalFood),
    highestEvolutionId: isEvolutionId(progress.highestEvolutionId)
      ? progress.highestEvolutionId
      : EVOLUTIONS[0]!.id,
    bestSurvivalMs: safeNonNegativeInteger(progress.bestSurvivalMs),
  };
}

export function createInitialPlayerProgress(
  legacyBestScore: unknown = 0,
): PlayerProgress {
  return {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: parseLegacyScore(legacyBestScore),
    gamesPlayed: 0,
    totalFood: 0,
    highestEvolutionId: EVOLUTIONS[0]!.id,
    bestSurvivalMs: 0,
  };
}

/**
 * Parses a value previously serialized by `serializePlayerProgress`.
 * Unknown versions are intentionally reset so a future schema cannot be
 * mistaken for the current one. A separately read legacy score may be passed
 * in to preserve the MVP record during migration.
 */
export function parsePlayerProgress(
  serialized: string | null | undefined,
  legacyBestScore: unknown = 0,
): PlayerProgress {
  const fallback = createInitialPlayerProgress(legacyBestScore);
  if (!serialized) return fallback;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || parsed.version !== PLAYER_PROGRESS_VERSION) {
      return fallback;
    }

    return {
      version: PLAYER_PROGRESS_VERSION,
      bestScore: safeNonNegativeInteger(parsed.bestScore, fallback.bestScore),
      gamesPlayed: safeNonNegativeInteger(parsed.gamesPlayed),
      totalFood: safeNonNegativeInteger(parsed.totalFood),
      highestEvolutionId: isEvolutionId(parsed.highestEvolutionId)
        ? parsed.highestEvolutionId
        : EVOLUTIONS[0]!.id,
      bestSurvivalMs: safeNonNegativeInteger(parsed.bestSurvivalMs),
    };
  } catch {
    return fallback;
  }
}

export function serializePlayerProgress(progress: PlayerProgress): string {
  return JSON.stringify(normalizedProgress(progress));
}

/** Call exactly once when a run transitions to game over. */
export function recordCompletedRun(
  progress: PlayerProgress,
  run: CompletedRun,
): PlayerProgress {
  const current = normalizedProgress(progress);
  const runEvolutionId = isEvolutionId(run.evolutionId)
    ? run.evolutionId
    : EVOLUTIONS[0]!.id;
  const highestEvolutionId =
    evolutionIndex(runEvolutionId) > evolutionIndex(current.highestEvolutionId)
      ? runEvolutionId
      : current.highestEvolutionId;

  return {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: Math.max(current.bestScore, safeNonNegativeInteger(run.score)),
    gamesPlayed: Math.min(MAX_STORED_NUMBER, current.gamesPlayed + 1),
    totalFood: Math.min(
      MAX_STORED_NUMBER,
      current.totalFood + safeNonNegativeInteger(run.eaten),
    ),
    highestEvolutionId,
    bestSurvivalMs: Math.max(
      current.bestSurvivalMs,
      safeNonNegativeInteger(run.elapsedMs),
    ),
  };
}

export function getEvolutionProgress(eatenValue: number): EvolutionProgress {
  const eaten = safeNonNegativeInteger(eatenValue);
  let currentIndex = 0;
  for (let index = EVOLUTIONS.length - 1; index >= 0; index -= 1) {
    const candidate = EVOLUTIONS[index];
    if (candidate && eaten >= candidate.minEaten) {
      currentIndex = index;
      break;
    }
  }

  const current = EVOLUTIONS[currentIndex]!;
  const next = EVOLUTIONS[currentIndex + 1] ?? null;
  if (!next) {
    return {
      current,
      next: null,
      eatenInLevel: Math.max(0, eaten - current.minEaten),
      eatenRequired: 0,
      percent: 100,
      isMaxLevel: true,
    };
  }

  const eatenRequired = next.minEaten - current.minEaten;
  const eatenInLevel = Math.min(
    eatenRequired,
    Math.max(0, eaten - current.minEaten),
  );
  return {
    current,
    next,
    eatenInLevel,
    eatenRequired,
    percent: Math.floor((eatenInLevel / eatenRequired) * 100),
    isMaxLevel: false,
  };
}

function objective(
  id: ObjectiveId,
  title: string,
  currentValue: number,
  target: number,
  unit: ObjectiveUnit,
): ProgressObjective {
  const current = Math.min(target, safeNonNegativeInteger(currentValue));
  return {
    id,
    title,
    current,
    target,
    unit,
    percent: Math.floor((current / target) * 100),
    completed: current >= target,
  };
}

export function getProgressObjectives(
  progressValue: PlayerProgress,
): readonly ProgressObjective[] {
  const progress = normalizedProgress(progressValue);
  const monsterIndex = evolutionIndex(MONSTRUO_MEME_ID);
  return [
    objective(
      "reach-monstruo-meme",
      "Consigue nivel Monstruo Meme",
      evolutionIndex(progress.highestEvolutionId),
      monsterIndex,
      "evolutions",
    ),
    objective(
      "collect-100-memes",
      "Recoge 100 memes",
      progress.totalFood,
      TOTAL_MEMES_GOAL,
      "memes",
    ),
    objective(
      "survive-5-minutes",
      "Sobrevive 5 minutos",
      progress.bestSurvivalMs,
      SURVIVAL_GOAL_MS,
      "milliseconds",
    ),
  ];
}

function formatRunTime(milliseconds: number): string {
  const totalSeconds = Math.floor(safeNonNegativeInteger(milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createShareText(run: CompletedRun): string {
  const evolution = evolutionById(run.evolutionId);
  const level = safeNonNegativeInteger(run.eaten);
  const score = safeNonNegativeInteger(run.score);
  return [
    `He creado un ${evolution.name} nivel ${level} 😂`,
    `${score} puntos · ${formatRunTime(run.elapsedMs)}`,
    "¿Puedes superarme?",
  ].join("\n");
}
