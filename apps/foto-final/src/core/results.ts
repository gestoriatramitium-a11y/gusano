import { EVOLUTIONS, type EvolutionId, type RarityCounts } from "./game";

export type ResultCategory =
  | "rough"
  | "normal"
  | "good"
  | "new-record"
  | "advanced-evolution"
  | "chaos-god"
  | "legendary-find";

export interface ResultPhraseDefinition {
  readonly category: ResultCategory;
  readonly phrases: readonly string[];
}

export const RESULT_PHRASE_CATALOG: readonly ResultPhraseDefinition[] =
  Object.freeze([
    {
      category: "rough",
      phrases: [
        "El calcetín tenía más futuro.",
        "Duraste menos que un meme explicado.",
        "La pared ganó por experiencia.",
      ],
    },
    {
      category: "normal",
      phrases: [
        "Caos correcto. Dignidad discutible.",
        "Internet ha visto cosas peores.",
        "Buen intento. El algoritmo pide otra partida.",
      ],
    },
    {
      category: "good",
      phrases: [
        "Has evolucionado más que mi grupo de WhatsApp.",
        "Nivel de poder: Wi-Fi del vecino.",
        "El algoritmo empieza a tenerte miedo.",
      ],
    },
    {
      category: "new-record",
      phrases: [
        "Nuevo récord. Tu yo anterior solicita revancha.",
        "Rompiste el récord y un poco la realidad.",
        "Tu mejor partida acaba de quedar obsoleta.",
      ],
    },
    {
      category: "advanced-evolution",
      phrases: [
        "Internet todavía no está preparado para ti.",
        "Demasiada evolución para una sola pantalla.",
        "El laboratorio pide que devuelvas al monstruo.",
      ],
    },
    {
      category: "chaos-god",
      phrases: [
        "Dios del Caos desbloqueado. La humanidad ha perdido.",
        "Llegaste al final. Ahora tú eres el problema.",
        "El caos te ha elegido como administrador.",
      ],
    },
    {
      category: "legendary-find",
      phrases: [
        "Encontraste una leyenda y luego una pared.",
        "Ese brillo legendario casi justificó todo.",
        "Botín legendario. Decisiones normales no incluidas.",
      ],
    },
  ]);

export interface ResultRun {
  readonly score: number;
  readonly eaten: number;
  readonly experience: number;
  readonly evolutionId: EvolutionId;
  readonly elapsedMs: number;
  readonly collectedByRarity: RarityCounts;
}

export interface ResultContext extends ResultRun {
  readonly previousBestScore: number;
  readonly isNewRecord: boolean;
}

export interface ResultPhrase {
  readonly category: ResultCategory;
  readonly text: string;
}

function safeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function evolutionRank(id: EvolutionId): number {
  return Math.max(
    0,
    EVOLUTIONS.findIndex((evolution) => evolution.id === id),
  );
}

export function classifyResult(context: ResultContext): ResultCategory {
  const rank = evolutionRank(context.evolutionId);
  if (context.evolutionId === "dios-del-caos") return "chaos-god";
  if (context.isNewRecord) return "new-record";
  if (rank >= 3) return "advanced-evolution";
  if (safeInteger(context.collectedByRarity.legendary) > 0)
    return "legendary-find";
  if (safeInteger(context.score) >= 250 || rank >= 2) return "good";
  if (safeInteger(context.score) < 40 && safeInteger(context.eaten) < 3)
    return "rough";
  return "normal";
}

export function selectResultPhrase(context: ResultContext): ResultPhrase {
  const category = classifyResult(context);
  const definition = RESULT_PHRASE_CATALOG.find(
    (candidate) => candidate.category === category,
  )!;
  const index =
    (safeInteger(context.score) +
      safeInteger(context.experience) +
      safeInteger(context.eaten) +
      Math.floor(safeInteger(context.elapsedMs) / 1000)) %
    definition.phrases.length;
  return { category, text: definition.phrases[index]! };
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(safeInteger(milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface ScoreComparison {
  readonly difference: number;
  readonly label: string;
}

export function compareWithPreviousBest(
  scoreValue: number,
  previousBestValue: number,
): ScoreComparison {
  const score = safeInteger(scoreValue);
  const previousBest = safeInteger(previousBestValue);
  const difference = score - previousBest;
  if (difference > 0) {
    return {
      difference,
      label: `Has mejorado tu marca en ${difference} puntos.`,
    };
  }
  if (difference < 0) {
    return {
      difference,
      label: `Te faltaron ${Math.abs(difference)} puntos para tu récord.`,
    };
  }
  return {
    difference: 0,
    label:
      previousBest === 0
        ? "Tu primera marca empieza aquí."
        : "Has igualado tu récord personal.",
  };
}

export function createShareText(
  context: ResultContext,
  phrase: string,
  publicUrl?: string,
): string {
  const evolution =
    EVOLUTIONS.find((candidate) => candidate.id === context.evolutionId) ??
    EVOLUTIONS[0]!;
  const lines = [
    `He conseguido ${safeInteger(context.score)} puntos en Meme Evolution Snake 😂`,
    `Evolución: ${evolution.name} · ${safeInteger(context.experience)} XP`,
    phrase,
    "¿Puedes superar mi resultado?",
  ];
  if (publicUrl?.trim()) lines.push(publicUrl.trim());
  return lines.join("\n");
}
