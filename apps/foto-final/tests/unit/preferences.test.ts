import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYER_PREFERENCES,
  parsePlayerPreferences,
  resolveGraphicsQuality,
  serializePlayerPreferences,
  shouldReduceMotion,
} from "../../src/core/preferences";

describe("preferencias locales", () => {
  it("crea valores seguros y rechaza datos desconocidos", () => {
    expect(parsePlayerPreferences(null)).toBe(DEFAULT_PLAYER_PREFERENCES);
    expect(parsePlayerPreferences("contenido roto")).toBe(
      DEFAULT_PLAYER_PREFERENCES,
    );
    expect(parsePlayerPreferences(JSON.stringify({ version: 99 }))).toBe(
      DEFAULT_PLAYER_PREFERENCES,
    );
  });

  it("persiste onboarding, calidad, país y reducción de movimiento", () => {
    const preferences = {
      ...DEFAULT_PLAYER_PREFERENCES,
      tutorialSeen: true,
      reduceMotion: true,
      graphicsQuality: "reduced" as const,
      countryCode: "JP" as const,
    };
    expect(
      parsePlayerPreferences(serializePlayerPreferences(preferences)),
    ).toEqual(preferences);
  });

  it("migra preferencias v1 sin inventar una identidad", () => {
    expect(
      parsePlayerPreferences(
        JSON.stringify({
          version: 1,
          tutorialSeen: true,
          graphicsQuality: "normal",
        }),
      ),
    ).toEqual({
      ...DEFAULT_PLAYER_PREFERENCES,
      tutorialSeen: true,
      graphicsQuality: "normal",
    });
  });

  it("descarta códigos de país desconocidos", () => {
    expect(
      parsePlayerPreferences(
        JSON.stringify({
          version: 2,
          countryCode: "XX",
        }),
      ).countryCode,
    ).toBeNull();
  });

  it("normaliza una calidad gráfica inválida", () => {
    expect(
      parsePlayerPreferences(
        JSON.stringify({
          version: 1,
          tutorialSeen: true,
          graphicsQuality: "ultra-imposible",
        }),
      ),
    ).toMatchObject({ tutorialSeen: true, graphicsQuality: "auto" });
  });
});

describe("calidad automática y movimiento", () => {
  it("respeta una selección gráfica explícita", () => {
    expect(resolveGraphicsQuality("normal", { hardwareConcurrency: 2 })).toBe(
      "normal",
    );
    expect(resolveGraphicsQuality("reduced", {})).toBe("reduced");
  });

  it("reduce calidad automática en dispositivos modestos", () => {
    expect(resolveGraphicsQuality("auto", { hardwareConcurrency: 4 })).toBe(
      "reduced",
    );
    expect(resolveGraphicsQuality("auto", { deviceMemoryGb: 4 })).toBe(
      "reduced",
    );
    expect(
      resolveGraphicsQuality("auto", {
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
        coarsePointer: true,
        devicePixelRatio: 3,
      }),
    ).toBe("reduced");
    expect(
      resolveGraphicsQuality("auto", {
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
        devicePixelRatio: 2,
      }),
    ).toBe("normal");
  });

  it("combina preferencia manual y preferencia del sistema", () => {
    expect(shouldReduceMotion(DEFAULT_PLAYER_PREFERENCES, false)).toBe(false);
    expect(shouldReduceMotion(DEFAULT_PLAYER_PREFERENCES, true)).toBe(true);
    expect(
      shouldReduceMotion(
        { ...DEFAULT_PLAYER_PREFERENCES, reduceMotion: true },
        false,
      ),
    ).toBe(true);
  });
});
