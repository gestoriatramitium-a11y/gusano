export interface VisualPoint {
  readonly x: number;
  readonly y: number;
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function samePoint(a: VisualPoint, b: VisualPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

function catmullRom(
  p0: VisualPoint,
  p1: VisualPoint,
  p2: VisualPoint,
  p3: VisualPoint,
  amount: number,
): VisualPoint {
  const squared = amount * amount;
  const cubed = squared * amount;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * amount +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * squared +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * cubed),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * amount +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * squared +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * cubed),
  };
}

export function interpolateSnakeAnchors(
  previous: readonly VisualPoint[],
  current: readonly VisualPoint[],
  progress: number,
): readonly VisualPoint[] {
  const amount = Math.max(0, Math.min(1, progress));
  return current.map((target, index) => {
    const origin = previous[Math.min(index, previous.length - 1)] ?? target;
    return {
      x: interpolate(origin.x, target.x, amount),
      y: interpolate(origin.y, target.y, amount),
    };
  });
}

export function createSmoothSnakePath(
  anchors: readonly VisualPoint[],
  subdivisions: number,
): readonly VisualPoint[] {
  if (anchors.length < 2) return [...anchors];

  const distinct = anchors.filter(
    (point, index) => index === 0 || !samePoint(point, anchors[index - 1]!),
  );
  if (distinct.length < 2) return [distinct[0]!];

  const steps = Math.max(1, Math.floor(subdivisions));
  const path: VisualPoint[] = [];
  for (let index = 0; index < distinct.length - 1; index += 1) {
    const p0 = distinct[Math.max(0, index - 1)]!;
    const p1 = distinct[index]!;
    const p2 = distinct[index + 1]!;
    const p3 = distinct[Math.min(distinct.length - 1, index + 2)]!;
    for (let step = 0; step < steps; step += 1) {
      path.push(catmullRom(p0, p1, p2, p3, step / steps));
    }
  }
  path.push(distinct.at(-1)!);
  return path;
}

export function directionAlongPath(path: readonly VisualPoint[]): VisualPoint {
  const head = path[0];
  const follower = path.find(
    (point, index) => index > 0 && head && !samePoint(head, point),
  );
  if (!head || !follower) return { x: 1, y: 0 };
  const x = head.x - follower.x;
  const y = head.y - follower.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}
