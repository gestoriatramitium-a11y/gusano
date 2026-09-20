import { describe, expect, it } from "vitest";

import {
  createSmoothSnakePath,
  directionAlongPath,
  interpolateSnakeAnchors,
} from "../../src/game/snakeVisuals";

describe("representación visual suave de la serpiente", () => {
  it("interpola el avance sin alterar los anclajes lógicos", () => {
    const previous = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const current = [
      { x: 3, y: 2 },
      { x: 2, y: 2 },
    ];

    expect(interpolateSnakeAnchors(previous, current, 0.25)).toEqual([
      { x: 2.25, y: 2 },
      { x: 1.25, y: 2 },
    ]);
    expect(previous[0]).toEqual({ x: 2, y: 2 });
    expect(current[0]).toEqual({ x: 3, y: 2 });
  });

  it("genera microsegmentos rectos para movimiento lento o rápido", () => {
    const path = createSmoothSnakePath(
      [
        { x: 4, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
      ],
      4,
    );

    expect(path).toHaveLength(9);
    expect(path[0]).toEqual({ x: 4, y: 2 });
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
    expect(path.every((point) => point.y === 2)).toBe(true);
  });

  it("redondea giros consecutivos manteniendo cabeza y cola", () => {
    const anchors = [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
    ];
    const path = createSmoothSnakePath(anchors, 4);

    expect(path[0]).toEqual(anchors[0]);
    expect(path.at(-1)).toEqual(anchors.at(-1));
    expect(path.length).toBeGreaterThan(anchors.length * 3);
    expect(path.some((point) => point.x % 1 !== 0 && point.y % 1 !== 0)).toBe(
      true,
    );
  });

  it("elimina duplicados de crecimiento y conserva un coste lineal", () => {
    const longSnake = Array.from({ length: 120 }, (_, index) => ({
      x: 120 - index,
      y: 5,
    }));
    longSnake.push({ ...longSnake.at(-1)! }, { ...longSnake.at(-1)! });

    const path = createSmoothSnakePath(longSnake, 2);
    expect(path).toHaveLength(239);
    expect(directionAlongPath(path)).toEqual({ x: 1, y: 0 });
  });
});
