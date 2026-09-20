# Validación local

Fecha de la última ejecución: **20 de septiembre de 2026**.

La validación se realizó en Windows con Node.js 24.19.0. El proyecto fija Node.js 22.17.0 como versión mínima y como versión de CI; `package-lock.json` permite repetir la instalación con `npm ci`.

## Resultados

| Comprobación                                   | Resultado local                                                                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación limpia (`npm ci`)                  | Aprobada; 249 paquetes instalados y 0 vulnerabilidades notificadas                                                                      |
| Prettier (`npm run format:check`)              | Aprobado                                                                                                                                |
| ESLint (`npm run lint`)                        | Aprobado, 0 avisos permitidos                                                                                                           |
| TypeScript estricto (`npm run typecheck`)      | Aprobado                                                                                                                                |
| Vitest (`npm run test`)                        | 82 de 82 pruebas aprobadas en ocho archivos                                                                                             |
| Cobertura del núcleo (`npm run test:coverage`) | 96,98 % sentencias, 90,98 % ramas, 100 % funciones y 98,77 % líneas en `src/core/**/*.ts`                                               |
| Build (`npm run build`)                        | Aprobado con Vite 7.3.6                                                                                                                 |
| Playwright (`npm run test:e2e`)                | 10 de 10 recorridos aprobados: cinco casos en Chromium escritorio y Pixel 7                                                             |
| Consola y red                                  | Sin errores de consola, errores de página ni orígenes externos durante los recorridos E2E                                               |
| Revisión visual                                | Curvatura, orientación, HUD y confirmación de salida revisados en 1280 × 900 y 412 × 915; responsive cubierto en Pixel 7 por Playwright |

Los recorridos comprueban onboarding, una evolución visible por XP, una misión completada, un logro desbloqueado, resultado detallado, texto compartible, persistencia tras recarga, preferencias de accesibilidad, dos ciclos consecutivos de derrota y reinicio, y el flujo pausar → continuar → salir → remontar el motor en ambos dispositivos. El build comprobado contiene `dist/index.html`, CSS de 24,53 kB, JavaScript inicial de 271,18 kB (84,71 kB con gzip), Phaser diferido de 1.208,49 kB (332,41 kB gzip) y escena diferida de 11,19 kB (4,25 kB gzip). Vite solo emite el aviso informativo del chunk diferido grande; la compilación termina correctamente.

La inspección manual confirmó el cuerpo curvo con microsegmentos, la orientación progresiva de la cabeza y el diálogo de salida en escritorio y móvil. Una prueba sintética con CPU 4× en Chromium móvil tomó 180 frames mientras introducía giros: 16,55 ms de media, 16,7 ms p95 y 33,3 ms máximo, sin errores y manteniendo calidad normal. La automatización reproduce de forma determinista comer una recompensa, evolucionar, perder, reiniciar, abandonar sin registrar y conservar el progreso tanto en escritorio como en el perfil móvil.

## Alcance de la evidencia

Estas pruebas demuestran el estado local del commit preparado. El repositorio remoto existe, pero estas pruebas no demuestran una ejecución aprobada de GitHub Actions, una Pull Request ni que el despliegue público de Netlify haya terminado y funcione. Esos estados requieren sus correspondientes URL o registros verificables.
