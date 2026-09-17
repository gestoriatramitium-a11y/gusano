# Balance y rendimiento

Fecha del ajuste: **17 de septiembre de 2026**.

Los valores jugables viven en `src/core/balance.ts`. Las cifras de tiempo de esta página son estimaciones analíticas para orientar el playtesting, no métricas de jugadores reales.

## Comparación de configuración

| Parámetro                   |                          Antes |                          Ahora | Motivo                                                                                            |
| --------------------------- | -----------------------------: | -----------------------------: | ------------------------------------------------------------------------------------------------- |
| XP de evoluciones           |           0 / 8 / 20 / 38 / 62 |           0 / 8 / 22 / 42 / 70 | Mantener una primera evolución rápida y separar progresivamente los logros intermedios y finales. |
| Tick por evolución          | 150 / 140 / 128 / 116 / 104 ms | 165 / 154 / 143 / 132 / 120 ms | Dar más tiempo para leer el tablero, especialmente en táctil.                                     |
| Intervalo de dificultad     |                           15 s |                           20 s | Hacer perceptible la aceleración sin castigar demasiado pronto.                                   |
| Reducción por nivel         |                           3 ms |                           2 ms | Suavizar cada escalón de dificultad.                                                              |
| Niveles máximos             |                             12 |                             10 | Limitar la aceleración acumulada.                                                                 |
| Tick mínimo normal          |                          78 ms |                          96 ms | Evitar finales injustos en pantallas pequeñas.                                                    |
| Multiplicador Café Infinito |                           0,75 |                           0,78 | Conservar la sensación de turbo con más control.                                                  |
| Tick mínimo con turbo       |                          58 ms |                          74 ms | Evitar picos difíciles de responder en móviles modestos.                                          |

La aparición sigue siendo inmediata después de comer y existe un único objeto activo. No se ha añadido un temporizador artificial.

## Distribución de rarezas

| Rareza     | Peso anterior | Probabilidad anterior | Peso nuevo | Probabilidad nueva |
| ---------- | ------------: | --------------------: | ---------: | -----------------: |
| Común      |      77 / 106 |               72,64 % |   84 / 108 |            77,78 % |
| Rara       |      25 / 106 |               23,58 % |   21 / 108 |            19,44 % |
| Legendaria |       4 / 106 |                3,77 % |    3 / 108 |             2,78 % |

La Patata Dorada pasa de peso 3 a 2,5 y Super Meme de 1 a 0,5. En promedio aparece una recompensa legendaria cada 36 objetos. Sigue siendo posible verla en una sesión buena, pero deja de dominar la progresión.

Los pesos comunes cambian a 25 / 22 / 21 / 16 y los raros a 7 / 6 / 4 / 4. Puntos, XP, crecimiento y duración de efectos de cada objeto no cambian; se reduce su impacto mediante frecuencia, no mediante una recompensa menos satisfactoria.

## Ritmo esperado

Con la nueva distribución, el valor medio por objeto es:

- 21,01 puntos antes de multiplicadores;
- 2,57 XP;
- 1,21 segmentos de crecimiento.

La distribución anterior producía 23,25 puntos, 2,74 XP y 1,27 segmentos. La reducción moderada evita que una cadena afortunada acelere demasiado puntuación, longitud y evolución a la vez.

| Evolución            |  XP | Objetos medios acumulados | Tiempo orientativo con ruta competente |
| -------------------- | --: | ------------------------: | -------------------------------------: |
| Gusano Legendario    |   8 |                         4 |                                12–20 s |
| Serpiente Influencer |  22 |                         9 |                                30–50 s |
| Monstruo Meme        |  42 |                        17 |                                55–95 s |
| Dios del Caos        |  70 |                        28 |                               85–150 s |

La estimación usa la distancia media del tablero y añade margen para decisiones humanas y rutas seguras. El crecimiento, el cuerpo propio y el aumento gradual de velocidad elevan el riesgo real. El objetivo de sesión se mantiene en **2–5 minutos** para jugadores que ya dominan los controles; principiantes pueden perder antes y Dios del Caos no está garantizado.

## Instrumentación local

El progreso v3 añade XP total, XP máximo, XP medio y menor intervalo de tick alcanzado. Se conservan duración, puntuación, objetos, rarezas y evoluciones por partida. Todo permanece en `localStorage` y no sale del dispositivo.

En desarrollo, `npm run dev -- --host` seguido de `?debug=1` muestra un panel mínimo con tiempo, XP, evolución, velocidad, objeto actual y calidad gráfica. Vite elimina la condición visible en producción.

## Perfil de rendimiento

El menú ya no importa Phaser. El motor y la escena se descargan al pulsar **Jugar**.

| Medición de producción  |       Antes |                        Ahora |
| ----------------------- | ----------: | ---------------------------: |
| JavaScript inicial      | 1.479,63 kB |                    269,54 kB |
| JavaScript inicial gzip |   417,33 kB |                     84,33 kB |
| Phaser diferido         | No separado | 1.208,49 kB / 332,41 kB gzip |
| Escena diferida         | No separada |      10,15 kB / 3,79 kB gzip |

El JavaScript total apenas cambia; la mejora está en diferir aproximadamente el 80 % de la descarga comprimida hasta que el jugador manifiesta intención de jugar.

Con CPU limitada a 4× en Chromium móvil, una muestra de 180 frames produjo 16,79 ms de media, 20 ms en percentil 95 y 48,1 ms máximo, sin errores. Es una prueba sintética local, no sustituye dispositivos físicos.
