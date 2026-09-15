import {
  ACHIEVEMENT_CATALOG,
  MISSION_CATALOG,
  completedMissionIds,
  evaluateMissions,
  findNewAchievements,
  mergeAchievementIds,
  type AchievementId,
  type ChallengeMetrics,
  type MissionId,
  type MissionState,
} from "./challenges";
import {
  EVOLUTIONS,
  type Evolution,
  type EvolutionId,
  type GameSnapshot,
  type RarityCounts,
} from "./game";

export const PLAYER_PROGRESS_VERSION = 2 as const;
const MAX_STORED_NUMBER = Number.MAX_SAFE_INTEGER;

export type EvolutionCounts = Readonly<Record<EvolutionId, number>>;

export interface PlayerMetrics {
  readonly measuredGames: number;
  readonly totalScore: number;
  readonly totalDurationMs: number;
  readonly bestFoodInRun: number;
  readonly recordsBroken: number;
  readonly collectedByRarity: RarityCounts;
  readonly evolutionReachedCounts: EvolutionCounts;
}

export interface PlayerProgress {
  readonly version: typeof PLAYER_PROGRESS_VERSION;
  readonly bestScore: number;
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly highestEvolutionId: EvolutionId;
  readonly bestSurvivalMs: number;
  readonly metrics: PlayerMetrics;
  readonly missions: Readonly<Record<MissionId, MissionState>>;
  readonly unlockedAchievementIds: readonly AchievementId[];
}

export type CompletedRun = Readonly<
  Pick<
    GameSnapshot,
    | "score"
    | "eaten"
    | "experience"
    | "evolutionId"
    | "elapsedMs"
    | "collectedByRarity"
  >
>;

export interface ProgressUpdate {
  readonly progress: PlayerProgress;
  readonly previousBestScore: number;
  readonly isNewRecord: boolean;
  readonly newlyCompletedMissionIds: readonly MissionId[];
  readonly newlyUnlockedAchievementIds: readonly AchievementId[];
}

export interface EvolutionProgress {
  readonly current: Evolution;
  readonly next: Evolution | null;
  readonly experienceInLevel: number;
  readonly experienceRequired: number;
  readonly percent: number;
  readonly isMaxLevel: boolean;
}

export interface PlayerStats {
  readonly averageScore: number;
  readonly averageDurationMs: number;
  readonly commonCollected: number;
  readonly rareCollected: number;
  readonly legendaryCollected: number;
}

function safeNonNegativeInteger(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_STORED_NUMBER, Math.max(0, Math.trunc(value)));
}

function safeAdd(first: number, second: number): number {
  return Math.min(MAX_STORED_NUMBER, first + second);
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

function emptyRarityCounts(): RarityCounts {
  return { normal: 0, rare: 0, legendary: 0 };
}

function emptyEvolutionCounts(): EvolutionCounts {
  return {
    "mini-bicho": 0,
    "gusano-legendario": 0,
    "serpiente-influencer": 0,
    "monstruo-meme": 0,
    "dios-del-caos": 0,
  };
}

function parseRarityCounts(value: unknown): RarityCounts {
  if (!isRecord(value)) return emptyRarityCounts();
  return {
    normal: safeNonNegativeInteger(value.normal),
    rare: safeNonNegativeInteger(value.rare),
    legendary: safeNonNegativeInteger(value.legendary),
  };
}

function parseEvolutionCounts(value: unknown): EvolutionCounts {
  if (!isRecord(value)) return emptyEvolutionCounts();
  return Object.fromEntries(
    EVOLUTIONS.map((evolution) => [
      evolution.id,
      safeNonNegativeInteger(value[evolution.id]),
    ]),
  ) as unknown as EvolutionCounts;
}

function parseAchievementIds(value: unknown): readonly AchievementId[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(value);
  return ACHIEVEMENT_CATALOG.map((achievement) => achievement.id).filter((id) =>
    known.has(id),
  );
}

function parseMissionStates(
  value: unknown,
): Partial<Record<MissionId, MissionState>> {
  if (!isRecord(value)) return {};
  const parsed: Partial<Record<MissionId, MissionState>> = {};
  for (const mission of MISSION_CATALOG) {
    const candidate = value[mission.id];
    if (!isRecord(candidate)) continue;
    parsed[mission.id] = {
      progress: safeNonNegativeInteger(candidate.progress),
      completed: candidate.completed === true,
    };
  }
  return parsed;
}

function createEmptyMetrics(): PlayerMetrics {
  return {
    measuredGames: 0,
    totalScore: 0,
    totalDurationMs: 0,
    bestFoodInRun: 0,
    recordsBroken: 0,
    collectedByRarity: emptyRarityCounts(),
    evolutionReachedCounts: emptyEvolutionCounts(),
  };
}

function toChallengeMetrics(
  progress: Pick<
    PlayerProgress,
    "bestScore" | "gamesPlayed" | "totalFood" | "highestEvolutionId" | "metrics"
  >,
): ChallengeMetrics {
  return {
    gamesPlayed: progress.gamesPlayed,
    totalFood: progress.totalFood,
    bestFoodInRun: progress.metrics.bestFoodInRun,
    bestScore: progress.bestScore,
    highestEvolutionRank: Math.max(
      0,
      evolutionIndex(progress.highestEvolutionId),
    ),
    rareCollected: progress.metrics.collectedByRarity.rare,
    legendaryCollected: progress.metrics.collectedByRarity.legendary,
    recordsBroken: progress.metrics.recordsBroken,
  };
}

function normalizeProgress(progress: PlayerProgress): PlayerProgress {
  const highestEvolutionId = isEvolutionId(progress.highestEvolutionId)
    ? progress.highestEvolutionId
    : EVOLUTIONS[0]!.id;
  const metrics: PlayerMetrics = {
    measuredGames: safeNonNegativeInteger(progress.metrics.measuredGames),
    totalScore: safeNonNegativeInteger(progress.metrics.totalScore),
    totalDurationMs: safeNonNegativeInteger(progress.metrics.totalDurationMs),
    bestFoodInRun: safeNonNegativeInteger(progress.metrics.bestFoodInRun),
    recordsBroken: safeNonNegativeInteger(progress.metrics.recordsBroken),
    collectedByRarity: parseRarityCounts(progress.metrics.collectedByRarity),
    evolutionReachedCounts: parseEvolutionCounts(
      progress.metrics.evolutionReachedCounts,
    ),
  };
  const base = {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: safeNonNegativeInteger(progress.bestScore),
    gamesPlayed: safeNonNegativeInteger(progress.gamesPlayed),
    totalFood: safeNonNegativeInteger(progress.totalFood),
    highestEvolutionId,
    bestSurvivalMs: safeNonNegativeInteger(progress.bestSurvivalMs),
    metrics,
  };
  return {
    ...base,
    missions: evaluateMissions(toChallengeMetrics(base), progress.missions),
    unlockedAchievementIds: parseAchievementIds(
      progress.unlockedAchievementIds,
    ),
  };
}

export function createInitialPlayerProgress(
  legacyBestScore: unknown = 0,
): PlayerProgress {
  const metrics = createEmptyMetrics();
  const base = {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: parseLegacyScore(legacyBestScore),
    gamesPlayed: 0,
    totalFood: 0,
    highestEvolutionId: EVOLUTIONS[0]!.id,
    bestSurvivalMs: 0,
    metrics,
  };
  return {
    ...base,
    missions: evaluateMissions(toChallengeMetrics(base)),
    unlockedAchievementIds: [],
  };
}

function migrateVersionOne(parsed: Record<string, unknown>): PlayerProgress {
  const initial = createInitialPlayerProgress(parsed.bestScore);
  const migrated = {
    ...initial,
    bestScore: safeNonNegativeInteger(parsed.bestScore),
    gamesPlayed: safeNonNegativeInteger(parsed.gamesPlayed),
    totalFood: safeNonNegativeInteger(parsed.totalFood),
    highestEvolutionId: isEvolutionId(parsed.highestEvolutionId)
      ? parsed.highestEvolutionId
      : initial.highestEvolutionId,
    bestSurvivalMs: safeNonNegativeInteger(parsed.bestSurvivalMs),
  };
  return normalizeProgress(migrated);
}

function parseVersionTwo(parsed: Record<string, unknown>): PlayerProgress {
  const initial = createInitialPlayerProgress();
  const metricsValue = isRecord(parsed.metrics) ? parsed.metrics : {};
  const metrics: PlayerMetrics = {
    measuredGames: safeNonNegativeInteger(metricsValue.measuredGames),
    totalScore: safeNonNegativeInteger(metricsValue.totalScore),
    totalDurationMs: safeNonNegativeInteger(metricsValue.totalDurationMs),
    bestFoodInRun: safeNonNegativeInteger(metricsValue.bestFoodInRun),
    recordsBroken: safeNonNegativeInteger(metricsValue.recordsBroken),
    collectedByRarity: parseRarityCounts(metricsValue.collectedByRarity),
    evolutionReachedCounts: parseEvolutionCounts(
      metricsValue.evolutionReachedCounts,
    ),
  };
  const base = {
    bestScore: safeNonNegativeInteger(parsed.bestScore),
    gamesPlayed: safeNonNegativeInteger(parsed.gamesPlayed),
    totalFood: safeNonNegativeInteger(parsed.totalFood),
    highestEvolutionId: isEvolutionId(parsed.highestEvolutionId)
      ? parsed.highestEvolutionId
      : initial.highestEvolutionId,
    metrics,
  };
  return normalizeProgress({
    version: PLAYER_PROGRESS_VERSION,
    ...base,
    bestSurvivalMs: safeNonNegativeInteger(parsed.bestSurvivalMs),
    missions: evaluateMissions(
      toChallengeMetrics(base),
      parseMissionStates(parsed.missions),
    ),
    unlockedAchievementIds: parseAchievementIds(parsed.unlockedAchievementIds),
  });
}

export function parsePlayerProgress(
  serialized: string | null | undefined,
  legacyBestScore: unknown = 0,
): PlayerProgress {
  const fallback = createInitialPlayerProgress(legacyBestScore);
  if (!serialized) return fallback;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed)) return fallback;
    if (parsed.version === 1) return migrateVersionOne(parsed);
    if (parsed.version === PLAYER_PROGRESS_VERSION)
      return parseVersionTwo(parsed);
    return fallback;
  } catch {
    return fallback;
  }
}

export function serializePlayerProgress(progress: PlayerProgress): string {
  return JSON.stringify(normalizeProgress(progress));
}

export function completeRun(
  progressValue: PlayerProgress,
  run: CompletedRun,
): ProgressUpdate {
  const current = normalizeProgress(progressValue);
  const score = safeNonNegativeInteger(run.score);
  const eaten = safeNonNegativeInteger(run.eaten);
  const elapsedMs = safeNonNegativeInteger(run.elapsedMs);
  const runEvolutionId = isEvolutionId(run.evolutionId)
    ? run.evolutionId
    : EVOLUTIONS[0]!.id;
  const runEvolutionRank = evolutionIndex(runEvolutionId);
  const highestEvolutionId =
    runEvolutionRank > evolutionIndex(current.highestEvolutionId)
      ? runEvolutionId
      : current.highestEvolutionId;
  const isNewRecord = score > current.bestScore;
  const collectedByRarity: RarityCounts = {
    normal: safeAdd(
      current.metrics.collectedByRarity.normal,
      safeNonNegativeInteger(run.collectedByRarity.normal),
    ),
    rare: safeAdd(
      current.metrics.collectedByRarity.rare,
      safeNonNegativeInteger(run.collectedByRarity.rare),
    ),
    legendary: safeAdd(
      current.metrics.collectedByRarity.legendary,
      safeNonNegativeInteger(run.collectedByRarity.legendary),
    ),
  };
  const evolutionReachedCounts = Object.fromEntries(
    EVOLUTIONS.map((evolution, index) => [
      evolution.id,
      safeAdd(
        current.metrics.evolutionReachedCounts[evolution.id],
        index <= runEvolutionRank ? 1 : 0,
      ),
    ]),
  ) as unknown as EvolutionCounts;
  const metrics: PlayerMetrics = {
    measuredGames: safeAdd(current.metrics.measuredGames, 1),
    totalScore: safeAdd(current.metrics.totalScore, score),
    totalDurationMs: safeAdd(current.metrics.totalDurationMs, elapsedMs),
    bestFoodInRun: Math.max(current.metrics.bestFoodInRun, eaten),
    recordsBroken: safeAdd(current.metrics.recordsBroken, isNewRecord ? 1 : 0),
    collectedByRarity,
    evolutionReachedCounts,
  };
  const base = {
    version: PLAYER_PROGRESS_VERSION,
    bestScore: Math.max(current.bestScore, score),
    gamesPlayed: safeAdd(current.gamesPlayed, 1),
    totalFood: safeAdd(current.totalFood, eaten),
    highestEvolutionId,
    bestSurvivalMs: Math.max(current.bestSurvivalMs, elapsedMs),
    metrics,
  };
  const challengeMetrics = toChallengeMetrics(base);
  const missions = evaluateMissions(challengeMetrics, current.missions);
  const previouslyCompleted = new Set(completedMissionIds(current.missions));
  const newlyCompletedMissionIds = completedMissionIds(missions).filter(
    (id) => !previouslyCompleted.has(id),
  );
  const newlyUnlockedAchievementIds = findNewAchievements(
    challengeMetrics,
    current.unlockedAchievementIds,
  );
  const next: PlayerProgress = {
    ...base,
    missions,
    unlockedAchievementIds: mergeAchievementIds(
      current.unlockedAchievementIds,
      newlyUnlockedAchievementIds,
    ),
  };
  return {
    progress: next,
    previousBestScore: current.bestScore,
    isNewRecord,
    newlyCompletedMissionIds,
    newlyUnlockedAchievementIds,
  };
}

/** Compatibility helper for callers that only need the updated state. */
export function recordCompletedRun(
  progress: PlayerProgress,
  run: CompletedRun,
): PlayerProgress {
  return completeRun(progress, run).progress;
}

export function getPlayerStats(progressValue: PlayerProgress): PlayerStats {
  const progress = normalizeProgress(progressValue);
  const measuredGames = progress.metrics.measuredGames;
  return {
    averageScore:
      measuredGames > 0
        ? Math.round(progress.metrics.totalScore / measuredGames)
        : 0,
    averageDurationMs:
      measuredGames > 0
        ? Math.round(progress.metrics.totalDurationMs / measuredGames)
        : 0,
    commonCollected: progress.metrics.collectedByRarity.normal,
    rareCollected: progress.metrics.collectedByRarity.rare,
    legendaryCollected: progress.metrics.collectedByRarity.legendary,
  };
}

export function getEvolutionProgress(
  experienceValue: number,
): EvolutionProgress {
  const experience = safeNonNegativeInteger(experienceValue);
  let currentIndex = 0;
  for (let index = EVOLUTIONS.length - 1; index >= 0; index -= 1) {
    const candidate = EVOLUTIONS[index];
    if (candidate && experience >= candidate.minExperience) {
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
      experienceInLevel: Math.max(0, experience - current.minExperience),
      experienceRequired: 0,
      percent: 100,
      isMaxLevel: true,
    };
  }
  const experienceRequired = next.minExperience - current.minExperience;
  const experienceInLevel = Math.min(
    experienceRequired,
    Math.max(0, experience - current.minExperience),
  );
  return {
    current,
    next,
    experienceInLevel,
    experienceRequired,
    percent: Math.floor((experienceInLevel / experienceRequired) * 100),
    isMaxLevel: false,
  };
}
