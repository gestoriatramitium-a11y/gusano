import { useEffect, useRef } from "react";

interface OnboardingOverlayProps {
  readonly engineReady: boolean;
  readonly onComplete: () => void;
}

export function OnboardingOverlay({
  engineReady,
  onComplete,
}: OnboardingOverlayProps) {
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (engineReady) startButtonRef.current?.focus();
  }, [engineReady]);

  return (
    <div
      className="screen-overlay screen-overlay--onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      data-testid="onboarding"
    >
      <section className="onboarding-card">
        <p className="eyebrow">Tutorial ultrarrápido</p>
        <h2 id="onboarding-title">Alimenta al bicho</h2>
        <ol className="onboarding-steps">
          <li>
            <span aria-hidden="true">↔</span>
            <div>
              <strong>Muévete</strong>
              <p>Usa flechas/WASD, desliza o toca los controles.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">🍕</span>
            <div>
              <strong>Come memes</strong>
              <p>El icono y la etiqueta indican su rareza y recompensa.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">⚡</span>
            <div>
              <strong>Crece y evoluciona</strong>
              <p>Llena la barra de XP sin tocar paredes ni tu cuerpo.</p>
            </div>
          </li>
        </ol>
        <p className="onboarding-goal">
          Primer objetivo: sigue el meme señalado en el tablero.
        </p>
        <button
          ref={startButtonRef}
          autoFocus
          className="primary-button"
          type="button"
          disabled={!engineReady}
          onClick={onComplete}
          data-testid="onboarding-start"
        >
          {engineReady ? "Entendido, jugar" : "Preparando el tablero…"}
        </button>
      </section>
    </div>
  );
}
