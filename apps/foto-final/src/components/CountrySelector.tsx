import { useState } from "react";

import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  type CountryCode,
} from "../core/countries";

interface CountrySelectorProps {
  readonly currentCountryCode: CountryCode | null;
  readonly canCancel: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (countryCode: CountryCode) => void;
}

export function CountrySelector({
  currentCountryCode,
  canCancel,
  onCancel,
  onConfirm,
}: CountrySelectorProps) {
  const [selected, setSelected] = useState<CountryCode>(
    currentCountryCode ?? DEFAULT_COUNTRY_CODE,
  );
  const country = COUNTRIES.find((candidate) => candidate.code === selected)!;

  return (
    <div
      className="screen-overlay screen-overlay--country"
      data-testid="country-selector"
    >
      <section
        className="country-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="country-title"
      >
        <p className="eyebrow">Pasaporte meme</p>
        <h2 id="country-title">Elige tu país</h2>
        <p>Tu bandera viajará contigo y distinguirá a tu gusano.</p>
        <div className="country-grid" role="radiogroup" aria-label="País">
          {COUNTRIES.map((candidate) => (
            <button
              type="button"
              role="radio"
              aria-checked={selected === candidate.code}
              className="country-option"
              data-selected={selected === candidate.code ? "true" : "false"}
              data-testid={`country-${candidate.code}`}
              key={candidate.code}
              onClick={() => setSelected(candidate.code)}
            >
              <span aria-hidden="true">{candidate.flag}</span>
              <strong>{candidate.name}</strong>
            </button>
          ))}
        </div>
        <div className="country-choice" aria-live="polite">
          <span aria-hidden="true">{country.flag}</span>
          <div>
            <small>Representarás a</small>
            <strong>{country.name}</strong>
          </div>
        </div>
        <div className="country-actions">
          {canCancel && (
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Cancelar
            </button>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={() => onConfirm(selected)}
            data-testid="confirm-country"
          >
            Jugar con {country.flag}
          </button>
        </div>
      </section>
    </div>
  );
}
