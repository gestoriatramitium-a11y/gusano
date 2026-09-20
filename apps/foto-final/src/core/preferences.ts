import { isCountryCode, type CountryCode } from "./countries";

export const PLAYER_PREFERENCES_VERSION = 2 as const;

export type GraphicsQualityPreference = "auto" | "normal" | "reduced";
export type EffectiveGraphicsQuality = "normal" | "reduced";

export interface PlayerPreferences {
  readonly version: typeof PLAYER_PREFERENCES_VERSION;
  readonly tutorialSeen: boolean;
  readonly reduceMotion: boolean;
  readonly graphicsQuality: GraphicsQualityPreference;
  readonly countryCode: CountryCode | null;
}

export interface DeviceSignals {
  readonly hardwareConcurrency?: number;
  readonly deviceMemoryGb?: number;
  readonly devicePixelRatio?: number;
  readonly coarsePointer?: boolean;
}

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = Object.freeze({
  version: PLAYER_PREFERENCES_VERSION,
  tutorialSeen: false,
  reduceMotion: false,
  graphicsQuality: "auto",
  countryCode: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGraphicsQuality(value: unknown): value is GraphicsQualityPreference {
  return value === "auto" || value === "normal" || value === "reduced";
}

export function parsePlayerPreferences(
  serialized: string | null | undefined,
): PlayerPreferences {
  if (!serialized) return DEFAULT_PLAYER_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== 2)) {
      return DEFAULT_PLAYER_PREFERENCES;
    }
    return {
      version: PLAYER_PREFERENCES_VERSION,
      tutorialSeen: parsed.tutorialSeen === true,
      reduceMotion: parsed.reduceMotion === true,
      graphicsQuality: isGraphicsQuality(parsed.graphicsQuality)
        ? parsed.graphicsQuality
        : "auto",
      countryCode: isCountryCode(parsed.countryCode)
        ? parsed.countryCode
        : null,
    };
  } catch {
    return DEFAULT_PLAYER_PREFERENCES;
  }
}

export function serializePlayerPreferences(
  preferences: PlayerPreferences,
): string {
  return JSON.stringify(preferences);
}

export function resolveGraphicsQuality(
  preference: GraphicsQualityPreference,
  signals: DeviceSignals,
): EffectiveGraphicsQuality {
  if (preference !== "auto") return preference;
  const limitedCpu =
    typeof signals.hardwareConcurrency === "number" &&
    signals.hardwareConcurrency <= 4;
  const limitedMemory =
    typeof signals.deviceMemoryGb === "number" && signals.deviceMemoryGb <= 4;
  const demandingTouchDisplay =
    signals.coarsePointer === true &&
    typeof signals.devicePixelRatio === "number" &&
    signals.devicePixelRatio >= 3;
  return limitedCpu || limitedMemory || demandingTouchDisplay
    ? "reduced"
    : "normal";
}

export function shouldReduceMotion(
  preference: PlayerPreferences,
  systemPrefersReducedMotion: boolean,
): boolean {
  return preference.reduceMotion || systemPrefersReducedMotion;
}
