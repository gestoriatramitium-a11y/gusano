import { describe, expect, it } from "vitest";

import {
  RESULT_PHRASE_CATALOG,
  classifyResult,
  compareWithPreviousBest,
  createShareText,
  formatDuration,
  selectResultPhrase,
  type ResultContext,
} from "../../src/core/results";

const baseResult: ResultContext = {
  score: 60,
  eaten: 4,
  experience: 8,
  evolutionId: "gusano-legendario",
  elapsedMs: 20_000,
  collectedByRarity: { normal: 4, rare: 0, legendary: 0 },
  previousBestScore: 100,
  isNewRecord: false,
};

describe("frases meme de resultados", () => {
  it.each([
    [{ score: 0, eaten: 0 }, "rough"],
    [{ score: 90, eaten: 5 }, "normal"],
    [{ score: 300 }, "good"],
    [{ isNewRecord: true }, "new-record"],
    [{ evolutionId: "monstruo-meme" }, "advanced-evolution"],
    [{ evolutionId: "dios-del-caos" }, "chaos-god"],
    [
      { collectedByRarity: { normal: 0, rare: 0, legendary: 1 } },
      "legendary-find",
    ],
  ] as const)("clasifica el contexto como %s", (changes, category) => {
    expect(classifyResult({ ...baseResult, ...changes })).toBe(category);
  });

  it("elige una frase determinista del catálogo correspondiente", () => {
    const first = selectResultPhrase(baseResult);
    const second = selectResultPhrase({ ...baseResult });
    const catalog = RESULT_PHRASE_CATALOG.find(
      (entry) => entry.category === first.category,
    )!;

    expect(second).toEqual(first);
    expect(catalog.phrases).toContain(first.text);
  });
});

describe("presentación y texto compartible", () => {
  it("compara puntuación con el récord anterior", () => {
    expect(compareWithPreviousBest(140, 100)).toEqual({
      difference: 40,
      label: "Has mejorado tu marca en 40 puntos.",
    });
    expect(compareWithPreviousBest(80, 100).label).toContain("20 puntos");
    expect(compareWithPreviousBest(100, 100).label).toContain("igualado");
    expect(compareWithPreviousBest(0, 0).label).toBe(
      "Tu primera marca empieza aquí.",
    );
  });

  it("formatea una duración estable", () => {
    expect(formatDuration(125_999)).toBe("02:05");
    expect(formatDuration(Number.NaN)).toBe("00:00");
  });

  it("incluye puntuación, evolución, frase e invitación sin URL obligatoria", () => {
    const text = createShareText(
      { ...baseResult, score: 275, evolutionId: "serpiente-influencer" },
      "El algoritmo empieza a tenerte miedo.",
    );

    expect(text).toContain("275 puntos");
    expect(text).toContain("Serpiente Influencer");
    expect(text).toContain("El algoritmo empieza a tenerte miedo.");
    expect(text).toContain("¿Puedes superar mi resultado?");
    expect(text).not.toMatch(/https?:/);
  });

  it("permite añadir posteriormente la URL pública", () => {
    expect(
      createShareText(baseResult, "Caos.", " https://example.com/game "),
    ).toContain("https://example.com/game");
  });
});
