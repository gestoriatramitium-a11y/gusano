import { ACHIEVEMENT_CATALOG, MISSION_CATALOG } from "../core/challenges";
import { EVOLUTIONS } from "../core/game";
import { getPlayerStats, type PlayerProgress } from "../core/progress";
import { formatDuration } from "../core/results";

interface ProgressPanelProps {
  readonly progress: PlayerProgress;
}

function evolutionName(id: PlayerProgress["highestEvolutionId"]): string {
  return (
    EVOLUTIONS.find((evolution) => evolution.id === id)?.name ??
    EVOLUTIONS[0]!.name
  );
}

export function ProgressPanel({ progress }: ProgressPanelProps) {
  const stats = getPlayerStats(progress);
  const unlocked = new Set(progress.unlockedAchievementIds);

  return (
    <aside className="local-progress" aria-label="Progreso local">
      <p className="panel-kicker">Tus hazañas</p>
      <div className="player-stats">
        <div>
          <strong data-testid="stats-games">{progress.gamesPlayed}</strong>
          <span>Partidas</span>
        </div>
        <div>
          <strong>{progress.totalFood}</strong>
          <span>Memes</span>
        </div>
        <div>
          <strong>{evolutionName(progress.highestEvolutionId)}</strong>
          <span>Evolución máxima</span>
        </div>
        <div>
          <strong>{formatDuration(progress.bestSurvivalMs)}</strong>
          <span>Mejor tiempo</span>
        </div>
      </div>

      <details className="challenge-center" data-testid="challenge-panel">
        <summary>Misiones, logros y métricas</summary>

        <section className="challenge-section" aria-labelledby="missions-title">
          <h3 id="missions-title">Misiones</h3>
          <div className="mission-list">
            {MISSION_CATALOG.map((mission) => {
              const state = progress.missions[mission.id];
              const percent = Math.floor(
                (Math.min(state.progress, mission.target) / mission.target) *
                  100,
              );
              return (
                <article
                  className={`mission-card ${state.completed ? "mission-card--done" : ""}`}
                  key={mission.id}
                  data-mission-id={mission.id}
                >
                  <div>
                    <strong>
                      {state.completed ? "✓ " : ""}
                      {mission.title}
                    </strong>
                    <span>
                      {state.progress}/{mission.target}
                    </span>
                  </div>
                  <p>{mission.description}</p>
                  <div className="objective__track" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className="challenge-section"
          aria-labelledby="achievements-title"
        >
          <h3 id="achievements-title">
            Logros · {progress.unlockedAchievementIds.length}/
            {ACHIEVEMENT_CATALOG.length}
          </h3>
          <div className="achievement-list">
            {ACHIEVEMENT_CATALOG.map((achievement) => {
              const isUnlocked = unlocked.has(achievement.id);
              return (
                <article
                  className={`achievement ${isUnlocked ? "achievement--unlocked" : ""}`}
                  key={achievement.id}
                  data-achievement-id={achievement.id}
                >
                  <span aria-hidden="true">
                    {isUnlocked ? achievement.icon : "🔒"}
                  </span>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="challenge-section" aria-labelledby="metrics-title">
          <h3 id="metrics-title">Métricas locales</h3>
          <div className="metric-grid">
            <span>
              Puntos totales <strong>{progress.metrics.totalScore}</strong>
            </span>
            <span>
              Puntuación media <strong>{stats.averageScore}</strong>
            </span>
            <span>
              Duración media{" "}
              <strong>{formatDuration(stats.averageDurationMs)}</strong>
            </span>
            <span>
              Comunes <strong>{stats.commonCollected}</strong>
            </span>
            <span>
              Raros <strong>{stats.rareCollected}</strong>
            </span>
            <span>
              Legendarios <strong>{stats.legendaryCollected}</strong>
            </span>
          </div>
          <div className="evolution-counts">
            {EVOLUTIONS.map((evolution) => (
              <span key={evolution.id}>
                {evolution.name}:{" "}
                {progress.metrics.evolutionReachedCounts[evolution.id]}
              </span>
            ))}
          </div>
          <p className="local-only-note">
            Solo se guarda en este navegador. No se envía ningún dato.
          </p>
        </section>
      </details>
    </aside>
  );
}
