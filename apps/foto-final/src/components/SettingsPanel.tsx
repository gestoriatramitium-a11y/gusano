import type {
  EffectiveGraphicsQuality,
  GraphicsQualityPreference,
  PlayerPreferences,
} from "../core/preferences";
import { getCountry } from "../core/countries";

interface SettingsPanelProps {
  readonly preferences: PlayerPreferences;
  readonly effectiveQuality: EffectiveGraphicsQuality;
  readonly systemReducedMotion: boolean;
  readonly onQualityChange: (quality: GraphicsQualityPreference) => void;
  readonly onReduceMotionChange: (reduced: boolean) => void;
  readonly onShowTutorial: () => void;
  readonly onChooseCountry: () => void;
}

export function SettingsPanel({
  preferences,
  effectiveQuality,
  systemReducedMotion,
  onQualityChange,
  onReduceMotionChange,
  onShowTutorial,
  onChooseCountry,
}: SettingsPanelProps) {
  const country = preferences.countryCode
    ? getCountry(preferences.countryCode)
    : null;
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-panel__heading">
        <h3 id="settings-title">Experiencia</h3>
        <button type="button" onClick={onShowTutorial}>
          Cómo jugar
        </button>
      </div>
      <div className="setting-row">
        <span>
          País
          <small>
            {country ? `${country.flag} ${country.name}` : "Sin elegir"}
          </small>
        </span>
        <button
          type="button"
          onClick={onChooseCountry}
          data-testid="change-country"
        >
          Cambiar
        </button>
      </div>
      <label className="setting-row">
        <span>
          Calidad gráfica
          <small>
            Activa: {effectiveQuality === "normal" ? "normal" : "reducida"}
          </small>
        </span>
        <select
          value={preferences.graphicsQuality}
          onChange={(event) =>
            onQualityChange(
              event.currentTarget.value as GraphicsQualityPreference,
            )
          }
          data-testid="quality-select"
        >
          <option value="auto">Auto</option>
          <option value="normal">Normal</option>
          <option value="reduced">Reducida</option>
        </select>
      </label>
      <label className="setting-row setting-row--checkbox">
        <span>
          Reducir efectos y movimiento
          {systemReducedMotion && <small>Tu sistema ya lo solicita</small>}
        </span>
        <input
          type="checkbox"
          checked={preferences.reduceMotion}
          onChange={(event) =>
            onReduceMotionChange(event.currentTarget.checked)
          }
          data-testid="reduce-motion-toggle"
        />
      </label>
    </section>
  );
}
