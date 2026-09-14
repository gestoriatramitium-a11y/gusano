# Trazabilidad del MVP

Esta matriz relaciona cada requisito con su implementación y con la evidencia ejecutada. Los resultados locales y sus límites están registrados en `docs/VALIDATION.md`.

| Requisito                                  | Implementación                                                      | Evidencia prevista                                             |
| ------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Logo y pantalla inicial                    | `src/App.tsx`, `src/styles.css`                                     | `tests/e2e/smoke.spec.ts`                                      |
| Personaje inicial “Mini Bicho Meme”        | `src/App.tsx`, `src/game/MemeSnakeScene.ts`                         | Inspección visual y prueba E2E                                 |
| Movimiento continuo estilo Snake           | `src/core/game.ts`, `src/game/MemeSnakeScene.ts`                    | `tests/unit/game.test.ts`, `tests/e2e/smoke.spec.ts`           |
| Movimiento suave y respuesta de giros      | Interpolación en `MemeSnakeScene.ts`; cola en `src/core/game.ts`    | Pruebas unitarias de cola y revisión visual                    |
| Dificultad y velocidad progresivas         | `src/core/game.ts`                                                  | Pruebas unitarias de intervalos, límites y turbo               |
| Controles de teclado                       | `src/game/MemeSnakeScene.ts`                                        | `tests/e2e/smoke.spec.ts`                                      |
| Controles táctiles y móvil                 | `src/components/GameCanvas.tsx`, `src/App.tsx`, `src/styles.css`    | Proyecto móvil de Playwright e inspección responsive           |
| Objetos meme para comer                    | `src/core/game.ts`, `src/game/MemeSnakeScene.ts`                    | Prueba unitaria de aparición/consumo e inspección visual       |
| Rarezas y cuatro objetos destacados        | Catálogo ponderado de diez objetos en `src/core/game.ts`            | Pruebas de catálogo, pesos, efectos y semilla determinista     |
| Partículas, animación y feedback inmediato | `MemeSnakeScene.ts`, `src/App.tsx`, `src/audio/SynthAudio.ts`       | E2E de Café Infinito, revisión visual y del sintetizador       |
| Crecimiento al comer                       | `src/core/game.ts`                                                  | `tests/unit/game.test.ts`                                      |
| Evoluciones visuales                       | Regla en `src/core/game.ts`; dibujo en `src/game/MemeSnakeScene.ts` | Prueba unitaria de umbrales e inspección visual                |
| Barra y celebración de evolución           | `src/core/progress.ts`, `src/App.tsx`, `src/styles.css`             | Pruebas de progreso, E2E e inspección visual                   |
| Puntuación                                 | `src/core/game.ts`, presentación en `src/App.tsx`                   | Prueba unitaria y `tests/e2e/smoke.spec.ts`                    |
| Pantalla de derrota                        | Estado en `src/core/game.ts`; interfaz en `src/App.tsx`             | Prueba de colisión y `tests/e2e/smoke.spec.ts`                 |
| Botón volver a jugar                       | `src/App.tsx`, `src/components/GameCanvas.tsx`                      | `tests/e2e/smoke.spec.ts`                                      |
| Récord, estadísticas y objetivos locales   | `src/core/progress.ts`, `src/App.tsx`                               | `tests/unit/progress.test.ts` y persistencia E2E               |
| Resultado y reto compartible               | `src/core/progress.ts`, `src/App.tsx`                               | Prueba unitaria de texto y recorrido E2E                       |
| Gráficos sin assets externos               | `src/game/MemeSnakeScene.ts`, `src/styles.css`                      | Revisión del bundle y de solicitudes de red                    |
| Lógica determinista separada de Phaser     | `src/core/game.ts` sin imports de presentación                      | `npm run typecheck`, `npm run test` y revisión de dependencias |
| TypeScript estricto                        | Configuración TypeScript del paquete                                | `npm run typecheck`                                            |
| Formato y análisis estático                | Prettier y ESLint                                                   | `npm run format:check`, `npm run lint`                         |
| Build estático                             | Vite                                                                | `npm run build`; comprobar `dist/index.html` y `dist/assets/`  |
| Despliegue Netlify                         | `netlify.toml` de la raíz                                           | Build de Netlify o Deploy Preview real, si existe acceso       |
| CI de GitHub                               | `.github/workflows/ci.yml`                                          | Ejecución real del workflow en GitHub                          |
| Sin backend, base de datos o multijugador  | Alcance y arquitectura completamente cliente                        | Revisión del árbol, bundle y tráfico de red                    |

## Puerta de calidad

Desde `apps/foto-final/`:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Después del build también deben existir `dist/index.html` y, al menos, un archivo dentro de `dist/assets/`. Los resultados se registrarán cuando se ejecuten; no se debe inferir aprobación a partir de artefactos antiguos o de una instalación previa.
