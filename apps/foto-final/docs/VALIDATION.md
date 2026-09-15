# Validación local

Fecha de la última ejecución: **15 de septiembre de 2026**.

La validación se realizó en Windows con Node.js 24.19.0. El proyecto fija Node.js 22.17.0 como versión mínima y como versión de CI; `package-lock.json` permite repetir la instalación con `npm ci`.

## Resultados

| Comprobación                                   | Resultado local                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Instalación limpia (`npm ci`)                  | Aprobada; 249 paquetes instalados y 0 vulnerabilidades notificadas                                                             |
| Prettier (`npm run format:check`)              | Aprobado                                                                                                                       |
| ESLint (`npm run lint`)                        | Aprobado, 0 avisos permitidos                                                                                                  |
| TypeScript estricto (`npm run typecheck`)      | Aprobado                                                                                                                       |
| Vitest (`npm run test`)                        | 69 de 69 pruebas aprobadas en cinco archivos                                                                                   |
| Cobertura del núcleo (`npm run test:coverage`) | 96,73 % sentencias, 90,05 % ramas, 100 % funciones y 98,66 % líneas en `src/core/**/*.ts`                                      |
| Build (`npm run build`)                        | Aprobado con Vite 7.3.6                                                                                                        |
| Playwright (`npm run test:e2e`)                | 6 de 6 recorridos aprobados: tres casos en Chromium escritorio y Pixel 7                                                       |
| Consola y red                                  | Sin errores de consola, errores de página ni orígenes externos durante los recorridos E2E                                      |
| Revisión visual                                | Portada, panel de progreso, partida, resultado y compartir revisados localmente; responsive cubierto en Pixel 7 por Playwright |

Los recorridos comprueban una evolución visible por XP, una misión completada, un logro desbloqueado, resultado detallado, texto compartible, persistencia tras recarga y dos ciclos consecutivos de derrota y reinicio en ambos dispositivos. El build comprobado contiene `dist/index.html`, una hoja CSS de 20,26 kB y un bundle JavaScript de 1.479,63 kB (417,33 kB con gzip). Phaser representa la mayor parte del bundle; Vite emite un aviso informativo por superar 500 kB sin comprimir, pero la compilación termina correctamente.

La inspección manual confirmó la jerarquía visual de la portada y de resultados, la legibilidad del panel desplegable de misiones/logros/métricas y la preparación visible del texto de compartir. La automatización reproduce de forma determinista comer una recompensa, evolucionar, perder, reiniciar y conservar el progreso tanto en escritorio como en el perfil móvil.

## Alcance de la evidencia

Estas pruebas demuestran el estado local del commit preparado. No demuestran una ejecución de GitHub Actions, un repositorio remoto, una Pull Request, un Deploy Preview ni un despliegue público en Netlify. Esos estados permanecen pendientes hasta disponer de un remoto y de las correspondientes URL verificables.
