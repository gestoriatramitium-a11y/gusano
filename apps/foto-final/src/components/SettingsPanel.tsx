import type {
  EffectiveGraphicsQuality,
  GraphicsQualityPreference,
  PlayerPreferences,
} from "../core/preferences";

interface SettingsPanelProps {
  readonly preferences: PlayerPreferences;
  readonly effectiveQuality: EffectiveGraphicsQuality;
  readonly systemReducedMotion: boolean;
  readonly onQualityChange: (quality: GraphicsQualityPreference) => void;
  readonly onReduceMotionChange: (reduced: boolean) => void;
  readonly onShowTutorial: () => void;
}

export function SettingsPanel({
  preferences,
  effectiveQuality,
  systemReducedMotion,
  onQualityChange,
  onReduceMotionChange,
  onShowTutorial,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-panel__heading">
        <h3 id="settings-title">Experiencia</h3>
        <button type="button" onClick={onShowTutorial}>
          Cómo jugar
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
