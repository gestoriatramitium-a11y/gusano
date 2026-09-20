import type { GameSnapshot } from "../core/game";
import {
  compareWithPreviousBest,
  formatDuration,
  type ResultPhrase,
} from "../core/results";

interface ResultScreenProps {
  readonly snapshot: GameSnapshot;
  readonly phrase: ResultPhrase;
  readonly previousBestScore: number;
  readonly personalBest: number;
  readonly isNewRecord: boolean;
  readonly sharePreview: string;
  readonly shareStatus: string;
  readonly onHome: () => void;
  readonly onRestart: () => void;
  readonly onShare: () => void;
}

export function ResultScreen({
  snapshot,
  phrase,
  previousBestScore,
  personalBest,
  isNewRecord,
  sharePreview,
  shareStatus,
  onHome,
  onRestart,
  onShare,
}: ResultScreenProps) {
  const comparison = compareWithPreviousBest(snapshot.score, previousBestScore);

  return (
    <div
      className="screen-overlay screen-overlay--defeat"
      data-testid="game-over"
      role="dialog"
      aria-modal="true"
      aria-label="Resultado final de la partida"
    >
      <div
        className={`defeat-card ${isNewRecord ? "defeat-card--record" : ""}`}
      >
        <p className="eyebrow">Fin de la evolución</p>
        {isNewRecord && (
          <div className="record-burst" data-testid="new-record">
            <span aria-hidden="true">🏆</span>
            ¡Nuevo récord!
          </div>
        )}

        <div className="final-score" data-testid="final-score">
          <span>Tu puntuación</span>
          <strong>{snapshot.score}</strong>
        </div>
        <p
          className={`score-comparison ${comparison.difference > 0 ? "score-comparison--positive" : ""}`}
        >
          {comparison.label}
        </p>
        <blockquote className="result-phrase" data-testid="result-phrase">
          “{phrase.text}”
        </blockquote>

        <div className="result-detail-grid" aria-label="Resultado final">
          <div>
            <span>Récord personal</span>
            <strong>{personalBest}</strong>
            <small>Anterior: {previousBestScore}</small>
          </div>
          <div>
            <span>Evolución máxima</span>
            <strong>{snapshot.evolutionName}</strong>
          </div>
          <div>
            <span>Experiencia</span>
            <strong>{snapshot.experience} XP</strong>
          </div>
          <div>
            <span>Objetos</span>
            <strong>{snapshot.eaten}</strong>
          </div>
          <div>
            <span>Duración</span>
            <strong>{formatDuration(snapshot.elapsedMs)}</strong>
          </div>
          <div>
            <span>Rarezas</span>
            <strong>
              {snapshot.collectedByRarity.normal}·
              {snapshot.collectedByRarity.rare}·
              {snapshot.collectedByRarity.legendary}
            </strong>
            <small>común · rara · legendaria</small>
          </div>
        </div>

        <div className="defeat-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onRestart}
            data-testid="restart-button"
          >
            Volver a jugar
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onShare}
            data-testid="share-button"
          >
            Compartir resultado
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onHome}
            data-testid="result-home-button"
          >
            Inicio
          </button>
        </div>

        {sharePreview && (
          <div className="share-result" data-testid="share-result">
            <label htmlFor="share-text">Tu reto está listo</label>
            <textarea id="share-text" readOnly value={sharePreview} rows={5} />
            <span>{shareStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
