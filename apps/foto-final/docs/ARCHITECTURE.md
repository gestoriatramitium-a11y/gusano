# Arquitectura de Meme Evolution Snake

## Objetivo

La aplicación es un juego HTML5 estático y autónomo. React gestiona la interfaz y el ciclo de montaje; Phaser dibuja y anima la partida; un módulo TypeScript puro decide el estado del juego. Esta separación permite comprobar las reglas sin iniciar un navegador ni depender del reloj o de la física de Phaser.

## Capas

### Lógica determinista

`src/core/game.ts` contiene los tipos, la configuración y las transiciones del juego: cuadrícula, serpiente, cola de direcciones, catálogo de objetos, aparición ponderada de rarezas, experiencia, crecimiento, efectos temporizados, dificultad, puntuación, evolución y derrota. Cada comida declara puntos, XP, peso, crecimiento, color, escala y comportamiento visual. Cada evolución declara su umbral de XP, velocidad, tamaño, colores y efecto; por tanto se pueden equilibrar o ampliar los catálogos sin cambiar el algoritmo de transición. La siguiente situación depende únicamente del estado anterior y de una entrada explícita. La semilla y el tiempo transcurrido forman parte del estado para que la colocación de objetos, los efectos y la aceleración puedan reproducirse en pruebas.

Esta capa no importa React, Phaser, APIs del DOM ni almacenamiento del navegador.

`src/core/balance.ts` centraliza tablero, probabilidades, recompensas, crecimiento, efectos, evoluciones y velocidad. `src/core/world.ts` ejecuta en paralelo la simulación determinista de bots, biomas, decoración y eventos, y `src/core/worldConfig.ts` concentra sus parámetros. Los bots pueden reclamar la comida compartida, pero no cambian las colisiones del jugador. `src/core/countries.ts` define las identidades internacionales. `src/core/progress.ts` contiene el esquema de persistencia local v3 y las operaciones puras para acumular récord, partidas, comida, XP, velocidad máxima alcanzada, evolución máxima, supervivencia y métricas de balance. Migra los esquemas v1 y v2 sin inventar medias a partir de datos históricos incompletos. `src/core/challenges.ts` define y evalúa misiones y logros desde métricas compartidas; `src/core/results.ts` clasifica el rendimiento, selecciona frases deterministas y construye el texto compartible. `src/core/preferences.ts` valida país, onboarding, reducción de movimiento y calidad gráfica. La capa React es la única que lee o escribe estos estados en `localStorage`.

### Escena Phaser

`src/game/MemeSnakeScene.ts` adapta la lógica pura al bucle visual. Sus responsabilidades son:

- traducir teclado, gestos o controles de la interfaz a direcciones válidas;
- avanzar el estado al intervalo que decide el núcleo;
- interpolar posiciones entre pulsos para suavizar el movimiento sin alterar la cuadrícula lógica;
- convertir los anclajes interpolados en una curva de microsegmentos y orientar la cabeza con su tangente;
- dibujar el tablero, cuatro biomas, bots identificados, las cinco evoluciones y las diez comidas con primitivas Canvas;
- reflejar crecimiento, rarezas, partículas, efectos activos, evolución y derrota;
- publicar hacia React los cambios necesarios para la interfaz.

`src/game/snakeVisuals.ts` contiene las funciones puras de interpolación, suavizado y dirección de la curva. La escena no debe duplicar las reglas del núcleo. Un cambio visual no puede alterar por sí solo la puntuación, las colisiones o la semilla.

### Integración React

`src/components/GameCanvas.tsx` carga Phaser y la escena de forma diferida al pulsar Jugar, crea el contenedor, instancia una única partida y destruye la instancia al desmontarse. `src/App.tsx` coordina el ciclo de pantallas, onboarding, selección de país, preferencias y persistencia; `src/components/CountrySelector.tsx` resuelve la identidad inicial sin dependencias remotas. `src/components/ProgressPanel.tsx` presenta estadísticas, misiones y logros, y `src/components/ResultScreen.tsx` presenta el cierre de partida. `src/components/OnboardingOverlay.tsx`, `SettingsPanel.tsx` y `DebugPanel.tsx` cubren la ayuda inicial, la accesibilidad/calidad y la inspección exclusiva de desarrollo. `src/utils/shareResult.ts` aísla Web Share y su fallback al portapapeles. `src/audio/SynthAudio.ts` genera respuestas sonoras cortas mediante Web Audio sin archivos externos. `src/styles.css` resuelve transiciones, layout, controles táctiles, áreas seguras, estados de foco y adaptación a móvil.

React y Phaser se comunican mediante una interfaz pequeña de eventos y comandos; React no modifica directamente objetos internos de la escena.

## Flujo de una partida

1. La portada presenta el nombre, Mini Bicho Meme y la acción de comenzar.
2. La primera partida solicita país y guarda la identidad únicamente en el navegador.
3. Al iniciar se crean los estados deterministas del jugador y del mundo y se monta la escena.
4. Cada entrada solicita un cambio de dirección; una cola corta conserva giros rápidos y el núcleo rechaza inversiones imposibles.
5. Cada pulso avanza jugador y mundo; los bots evalúan supervivencia, amenazas, alimento y oportunidades.
6. Phaser interpola el resultado y emite feedback visual; React actualiza marcador, anuncios y efectos sonoros.
7. Una colisión lleva al estado de derrota, registra una única sesión local y evalúa nuevas misiones y logros.
8. La pantalla final muestra rendimiento, comparación con el récord, frase contextual y un reto compartible mediante Web Share o portapapeles.
9. Volver a jugar crea estados iniciales nuevos sin recargar la aplicación; récord, identidad, métricas y desbloqueos permanecen en el navegador.
10. Inicio pausa la carrera y pide confirmación; salir desmonta Phaser, cancela efectos transitorios y vuelve a la portada sin registrar la carrera abandonada.

## Representación y responsive

El tablero mantiene una relación de aspecto estable mediante el escalado de Phaser. El shell React limita su tamaño en escritorio y usa el ancho disponible en pantallas estrechas. Los controles tienen objetivos táctiles amplios y respetan `env(safe-area-inset-*)`. La dirección también se puede cambiar con teclado para no depender del puntero.

No se cargan assets remotos. Personajes, objetos, logotipo y efectos se construyen con Canvas, texto y CSS, lo que evita dependencias de red y problemas de licencia o CORS.

## Calidad y límites

Las pruebas unitarias separan reglas de juego, persistencia, desafíos, resultados y adaptadores de compartir. La cobertura instrumentada se limita a `src/core/**/*.ts` y exige al menos un 90 % en ramas, funciones, líneas y sentencias. `tests/e2e/smoke.spec.ts` cubre el recorrido visible en navegadores de escritorio y móvil contra la vista previa del `dist` de producción: portada, controles, feedback, evolución, resultado, compartir, desbloqueos, reinicio y persistencia.

La compilación es una SPA estática. No existen endpoints, funciones de servidor, cuentas, telemetría remota, base de datos ni sincronización multijugador. Las estadísticas no personales permanecen solo en el `localStorage` del navegador y se pueden eliminar borrando los datos locales del sitio. El menú inicial no descarga Phaser: Vite separa el motor y la escena en chunks diferidos, reduciendo el JavaScript inicial; el tamaño total sigue documentado en `docs/BALANCE.md`.
