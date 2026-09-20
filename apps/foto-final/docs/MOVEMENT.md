# Movimiento y navegación — Fase 2C

Fecha de validación: **20 de septiembre de 2026**.

## Estrategia de movimiento

El núcleo continúa avanzando una celda por tick. Esa cuadrícula sigue siendo la única autoridad para semilla, comida, crecimiento, puntuación, límites y colisiones. La mejora se concentra en la representación de Phaser:

- `interpolateSnakeAnchors` calcula la posición fraccionaria de cada anclaje entre el estado anterior y el actual;
- `createSmoothSnakePath` convierte cada espacio lógico en dos, tres o cuatro microsegmentos mediante una curva Catmull-Rom;
- la cabeza se orienta con la tangente real de la curva, en vez de saltar visualmente entre cuatro ángulos;
- el cuerpo se estrecha hacia la cola y recibe un desplazamiento perpendicular inferior a un píxel para producir elasticidad sin afectar las colisiones;
- las posiciones duplicadas que aparecen durante el crecimiento se eliminan solo de la curva visual;
- la densidad baja automáticamente para cuerpos de más de 90 segmentos y para calidad reducida.

La cola de controles acepta tres giros válidos. El núcleo sigue rechazando inversiones y consume cada giro en orden, por lo que pulsaciones rápidas dejan de perderse sin introducir trayectorias imposibles.

## Navegación y limpieza

Durante una partida aparece **Inicio**. Al pulsarlo, el motor deja de acumular tiempo y abre una confirmación con las acciones **Continuar jugando** y **Salir al inicio**.

Salir desmonta `GameCanvas`; su limpieza destruye la instancia de Phaser, la escena, entradas, eventos, tweens, timers y objetos temporales. React cancela sus timers, detiene la vibración, cierra Web Audio y descarta el snapshot de la carrera abandonada. Esa carrera no incrementa partidas ni modifica el récord. Al jugar de nuevo se crea una instancia limpia.

## Evidencia local

- Curva recta, giros consecutivos, interpolación parcial, duplicados de crecimiento y cuerpo de 120 anclajes: pruebas unitarias.
- Pausa, reanudación, salida, ausencia del canvas, progreso sin registrar y nuevo montaje: Playwright en escritorio y Pixel 7.
- Inspección visual: curva y orientación revisadas en 1280 × 900 y 412 × 915.
- Perfil sintético móvil con CPU limitada 4×, 180 frames y giros durante la muestra: 16,55 ms de media, 16,7 ms p95 y 33,3 ms máximo; calidad normal conservada y cero errores de página.

La muestra equivalente anterior registrada fue 16,79 ms de media, 20 ms p95 y 48,1 ms máximo. Ambas son mediciones sintéticas locales; sirven para detectar una regresión grande, no sustituyen pruebas en dispositivos físicos ni constituyen métricas de jugadores.
