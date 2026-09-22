import { describe, expect, it } from "vitest";

import {
  clampCameraScroll,
  createWorldMetrics,
  positionToWorldPixels,
} from "../../src/game/worldCamera";

describe("cámara del mundo ampliado", () => {
  it("mantiene una escala fija y convierte celdas a coordenadas de mundo", () => {
    const metrics = createWorldMetrics(72, 48, 30);

    expect(metrics.pixelWidth).toBe(2160);
    expect(metrics.pixelHeight).toBe(1440);
    expect(positionToWorldPixels({ x: 0, y: 0 }, metrics)).toEqual({
      x: 45,
      y: 45,
    });
  });

  it("limita la cámara a los bordes sin perder el seguimiento central", () => {
    const metrics = createWorldMetrics(72, 48, 30);

    expect(clampCameraScroll({ x: 45, y: 45 }, metrics, 900, 620)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampCameraScroll({ x: 1125, y: 765 }, metrics, 900, 620)).toEqual({
      x: 675,
      y: 455,
    });
  });
});
