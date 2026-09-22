import type { Position } from "../core/game";

export interface WorldMetrics {
  readonly cell: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

export interface CameraScroll {
  readonly x: number;
  readonly y: number;
}

export function createWorldMetrics(
  width: number,
  height: number,
  cell: number,
): WorldMetrics {
  return {
    cell,
    offsetX: cell,
    offsetY: cell,
    pixelWidth: width * cell,
    pixelHeight: height * cell,
  };
}

export function positionToWorldPixels(
  position: Position,
  metrics: WorldMetrics,
): Position {
  return {
    x: metrics.offsetX + position.x * metrics.cell + metrics.cell / 2,
    y: metrics.offsetY + position.y * metrics.cell + metrics.cell / 2,
  };
}

export function clampCameraScroll(
  target: Position,
  metrics: WorldMetrics,
  viewportWidth: number,
  viewportHeight: number,
): CameraScroll {
  const worldRight = metrics.offsetX + metrics.pixelWidth;
  const worldBottom = metrics.offsetY + metrics.pixelHeight;
  return {
    x: Math.max(
      0,
      Math.min(worldRight - viewportWidth, target.x - viewportWidth / 2),
    ),
    y: Math.max(
      0,
      Math.min(worldBottom - viewportHeight, target.y - viewportHeight / 2),
    ),
  };
}
