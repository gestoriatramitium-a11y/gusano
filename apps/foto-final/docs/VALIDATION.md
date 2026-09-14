# Validación local

Fecha de la última ejecución: **14 de septiembre de 2026**.

La validación se realizó en Windows con Node.js 24.19.0. El proyecto fija Node.js 22.17.0 como versión mínima y como versión de CI; `package-lock.json` permite repetir la instalación con `npm ci`.

## Resultados

| Comprobación                                   | Resultado local                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Instalación limpia (`npm ci`)                  | Aprobada; 249 paquetes instalados y 0 vulnerabilidades notificadas                        |
| Prettier (`npm run format:check`)              | Aprobado                                                                                  |
| ESLint (`npm run lint`)                        | Aprobado, 0 avisos permitidos                                                             |
| TypeScript estricto (`npm run typecheck`)      | Aprobado                                                                                  |
| Vitest (`npm run test`)                        | 46 de 46 pruebas aprobadas en dos archivos                                                |
| Cobertura del núcleo (`npm run test:coverage`) | 96,9 % sentencias, 91,53 % ramas, 100 % funciones y 98,05 % líneas en `src/core/**/*.ts`  |
| Build (`npm run build`)                        | Aprobado con Vite 7.3.6                                                                   |
| Playwright (`npm run test:e2e`)                | 4 de 4 recorridos aprobados: dos casos en Chromium escritorio y Pixel 7                   |
| Consola y red                                  | Sin errores de consola, errores de página ni orígenes externos durante los recorridos E2E |
| Revisión visual                                | Portada, partida y derrota revisadas en 1440×900, Pixel 7, 320×568 y paisaje 844×390      |

El build comprobado contiene `dist/index.html`, una hoja CSS y un bundle JavaScript. Phaser representa la mayor parte del bundle; Vite emite un aviso informativo por superar 500 kB sin comprimir, pero la compilación termina correctamente y el JavaScript resultante ocupa aproximadamente 413 kB comprimido con gzip.

## Alcance de la evidencia

Estas pruebas demuestran el estado local del commit preparado. No demuestran una ejecución de GitHub Actions, un repositorio remoto, una Pull Request, un Deploy Preview ni un despliegue público en Netlify. Esos estados permanecen pendientes hasta disponer de un remoto y de las correspondientes URL verificables.
