export interface ChallengeMetrics {
  readonly gamesPlayed: number;
  readonly totalFood: number;
  readonly bestFoodInRun: number;
  readonly bestScore: number;
  readonly highestEvolutionRank: number;
  readonly rareCollected: number;
  readonly legendaryCollected: number;
  readonly recordsBroken: number;
}

export type ChallengeMetric = keyof ChallengeMetrics;

export type MissionId =
  | "eat-10"
  | "score-100"
  | "reach-worm"
  | "reach-influencer"
  | "collect-rare"
  | "collect-legendary"
  | "play-3"
  | "beat-record";

export interface MissionDefinition {
  readonly id: MissionId;
  readonly title: string;
  readonly description: string;
  readonly condition: ChallengeMetric;
  readonly target: number;
}

export interface MissionState {
  readonly progress: number;
  readonly completed: boolean;
}

export const MISSION_CATALOG: readonly MissionDefinition[] = Object.freeze([
  {
    id: "eat-10",
    title: "Bufé de internet",
    description: "Come 10 objetos en una sola partida.",
    condition: "bestFoodInRun",
    target: 10,
  },
  {
    id: "score-100",
    title: "Tres dígitos de caos",
    description: "Consigue al menos 100 puntos.",
    condition: "bestScore",
    target: 100,
  },
  {
    id: "reach-worm",
    title: "Gusano certificado",
    description: "Alcanza Gusano Legendario.",
    condition: "highestEvolutionRank",
    target: 1,
  },
  {
    id: "reach-influencer",
    title: "Ya tienes representante",
    description: "Alcanza Serpiente Influencer.",
    condition: "highestEvolutionRank",
    target: 2,
  },
  {
    id: "collect-rare",
    title: "Olfato para lo raro",
    description: "Recoge una recompensa rara.",
    condition: "rareCollected",
    target: 1,
  },
  {
    id: "collect-legendary",
    title: "Eso brillaba demasiado",
    description: "Recoge una recompensa legendaria.",
    condition: "legendaryCollected",
    target: 1,
  },
  {
    id: "play-3",
    title: "Una más y lo dejo",
    description: "Juega 3 partidas.",
    condition: "gamesPlayed",
    target: 3,
  },
  {
    id: "beat-record",
    title: "Yo contra mi yo de ayer",
    description: "Supera un récord de una partida anterior.",
    condition: "recordsBroken",
    target: 1,
  },
]);

export type AchievementId =
  | "first-bite"
  | "first-evolution"
  | "influencer"
  | "meme-monster"
  | "chaos-god"
  | "legendary-hunter"
  | "new-record"
  | "chaos-addict";

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly condition: ChallengeMetric;
  readonly target: number;
  readonly icon: string;
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] =
  Object.freeze([
    {
      id: "first-bite",
      title: "Primer Bocado",
      description: "El comienzo de una dieta cuestionable.",
      condition: "totalFood",
      target: 1,
      icon: "🍕",
    },
    {
      id: "first-evolution",
      title: "Primera Evolución",
      description: "Mini Bicho ya no paga alquiler.",
      condition: "highestEvolutionRank",
      target: 1,
      icon: "✨",
    },
    {
      id: "influencer",
      title: "Influencer",
      description: "Evolucionaste antes que el algoritmo.",
      condition: "highestEvolutionRank",
      target: 2,
      icon: "📱",
    },
    {
      id: "meme-monster",
      title: "Monstruo Meme",
      description: "Demasiado poderoso para un solo timeline.",
      condition: "highestEvolutionRank",
      target: 3,
      icon: "👹",
    },
    {
      id: "chaos-god",
      title: "Dios del Caos",
      description: "La humanidad ha perdido oficialmente.",
      condition: "highestEvolutionRank",
      target: 4,
      icon: "🌌",
    },
    {
      id: "legendary-hunter",
      title: "Cazador Legendario",
      description: "Encontraste algo que casi no debía aparecer.",
      condition: "legendaryCollected",
      target: 1,
      icon: "🏆",
    },
    {
      id: "new-record",
      title: "Nuevo Récord",
      description: "Humillaste a tu versión anterior.",
      condition: "recordsBroken",
      target: 1,
      icon: "🚀",
    },
    {
      id: "chaos-addict",
      title: "Adicto al Caos",
      description: "Completa 10 partidas. Sí, diez.",
      condition: "gamesPlayed",
      target: 10,
      icon: "🌀",
    },
  ]);

function safeMetric(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function evaluateMissions(
  metrics: ChallengeMetrics,
  previous: Partial<Record<MissionId, MissionState>> = {},
): Record<MissionId, MissionState> {
  const states = {} as Record<MissionId, MissionState>;
  for (const mission of MISSION_CATALOG) {
    const progress = Math.min(
      mission.target,
      safeMetric(metrics[mission.condition]),
    );
    states[mission.id] = {
      progress,
      completed:
        previous[mission.id]?.completed === true || progress >= mission.target,
    };
  }
  return states;
}

export function findNewAchievements(
  metrics: ChallengeMetrics,
  unlockedIds: readonly AchievementId[],
): readonly AchievementId[] {
  const unlocked = new Set(unlockedIds);
  return ACHIEVEMENT_CATALOG.filter(
    (achievement) =>
      !unlocked.has(achievement.id) &&
      safeMetric(metrics[achievement.condition]) >= achievement.target,
  ).map((achievement) => achievement.id);
}

export function mergeAchievementIds(
  current: readonly AchievementId[],
  newlyUnlocked: readonly AchievementId[],
): readonly AchievementId[] {
  const known = new Set<AchievementId>([
    ...current.filter((id) =>
      ACHIEVEMENT_CATALOG.some((achievement) => achievement.id === id),
    ),
    ...newlyUnlocked,
  ]);
  return ACHIEVEMENT_CATALOG.map((achievement) => achievement.id).filter((id) =>
    known.has(id),
  );
}

export function completedMissionIds(
  states: Readonly<Record<MissionId, MissionState>>,
): readonly MissionId[] {
  return MISSION_CATALOG.filter((mission) => states[mission.id].completed).map(
    (mission) => mission.id,
  );
}
