# Validación local

Fecha de la última ejecución: **20 de septiembre de 2026**.

La validación se realizó en Windows con Node.js 24.19.0. El proyecto fija Node.js 22.17.0 como versión mínima y como versión de CI; `package-lock.json` permite repetir la instalación con `npm ci`.

## Resultados

| Comprobación                                   | Resultado local                                                                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación limpia (`npm ci`)                  | Aprobada; 249 paquetes instalados y 0 vulnerabilidades notificadas                                                                     |
| Prettier (`npm run format:check`)              | Aprobado                                                                                                                               |
| ESLint (`npm run lint`)                        | Aprobado, 0 avisos permitidos                                                                                                          |
| TypeScript estricto (`npm run typecheck`)      | Aprobado                                                                                                                               |
| Vitest (`npm run test`)                        | 97 de 97 pruebas aprobadas en nueve archivos                                                                                           |
| Cobertura del núcleo (`npm run test:coverage`) | 97,60 % sentencias, 91,04 % ramas, 100 % funciones y 98,65 % líneas en `src/core/**/*.ts`                                              |
| Build (`npm run build`)                        | Aprobado con Vite 7.3.6                                                                                                                |
| Playwright (`npm run test:e2e`)                | 14 de 14 recorridos aprobados: siete casos en Chromium escritorio y Pixel 7                                                            |
| Consola y red                                  | Sin errores de consola, errores de página ni orígenes externos durante los recorridos E2E                                              |
| Revisión visual                                | Cuatro biomas, tamaños de bots, banderas gráficas, HUD y salida revisados en escritorio; responsive cubierto en Pixel 7 por Playwright |

Los recorridos comprueban selección y persistencia de país, onboarding, una evolución visible por XP, una misión completada, un logro desbloqueado, resultado detallado, texto compartible, persistencia tras recarga, preferencias de accesibilidad, dos ciclos consecutivos de derrota y reinicio, y el flujo pausar → continuar → salir → remontar el motor en ambos dispositivos. El build comprobado contiene `dist/index.html`, CSS de 26,27 kB, JavaScript inicial de 275,35 kB (86,02 kB con gzip), Phaser diferido de 1.208,49 kB (332,41 kB gzip) y escena diferida de 25,27 kB (9,18 kB gzip). Vite solo emite el aviso informativo del chunk diferido grande; la compilación termina correctamente.

La inspección manual confirmó cuatro biomas diferenciados, decoración procedural, bots de longitudes distintas y banderas dibujadas sobre jugador y rivales. La medición E2E final de 120 frames con seis bots y giros consecutivos obtuvo 16,98 ms de media y 16,80 ms p95 en Chromium escritorio, y 17,13 ms de media y 16,80 ms p95 en Pixel 7. Frente a la referencia de la iteración anterior en móvil (16,55 ms de media y 16,7 ms p95), la diferencia media fue de 0,58 ms y el p95 permaneció prácticamente igual; no es un benchmark de hardware independiente, sino una regresión reproducible en el mismo entorno. La automatización reproduce de forma determinista comer una recompensa, evolucionar, perder, reiniciar, abandonar sin registrar y conservar el progreso tanto en escritorio como en el perfil móvil.

## Alcance de la evidencia

Estas pruebas demuestran el estado local del commit preparado. El repositorio remoto existe, pero estas pruebas no demuestran una ejecución aprobada de GitHub Actions, una Pull Request ni que el despliegue público de Netlify haya terminado y funcione. Esos estados requieren sus correspondientes URL o registros verificables.
