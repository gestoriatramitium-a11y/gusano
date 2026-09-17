import type { GameSnapshot } from "../core/game";
import type { EffectiveGraphicsQuality } from "../core/preferences";
import { formatDuration } from "../core/results";

interface DebugPanelProps {
  readonly snapshot: GameSnapshot | null;
  readonly quality: EffectiveGraphicsQuality;
}

export function DebugPanel({ snapshot, quality }: DebugPanelProps) {
  return (
    <aside className="debug-panel" aria-label="Panel de balance">
      <strong>DEBUG BALANCE</strong>
      <span>Tiempo: {formatDuration(snapshot?.elapsedMs ?? 0)}</span>
      <span>XP: {snapshot?.experience ?? 0}</span>
      <span>Evolución: {snapshot?.evolutionName ?? "Mini Bicho Meme"}</span>
      <span>Velocidad: {snapshot?.tickMs ?? "—"} ms/tick</span>
      <span>Mejor velocidad: {snapshot?.fastestTickMs ?? "—"} ms/tick</span>
      <span>
        Objeto: {snapshot?.food.kind ?? "—"} · calidad {quality}
      </span>
    </aside>
  );
}
