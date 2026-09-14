# Arquitectura de Meme Evolution Snake

## Objetivo

La aplicación es un juego HTML5 estático y autónomo. React gestiona la interfaz y el ciclo de montaje; Phaser dibuja y anima la partida; un módulo TypeScript puro decide el estado del juego. Esta separación permite comprobar las reglas sin iniciar un navegador ni depender del reloj o de la física de Phaser.

## Capas

### Lógica determinista

`src/core/game.ts` contiene los tipos, la configuración y las transiciones del juego: cuadrícula, serpiente, cola de direcciones, catálogo de objetos, aparición ponderada de rarezas, experiencia, crecimiento, efectos temporizados, dificultad, puntuación, evolución y derrota. Cada comida declara puntos, XP, peso, crecimiento, color, escala y comportamiento visual. Cada evolución declara su umbral de XP, velocidad, tamaño, colores y efecto; por tanto se pueden equilibrar o ampliar los catálogos sin cambiar el algoritmo de transición. La siguiente situación depende únicamente del estado anterior y de una entrada explícita. La semilla y el tiempo transcurrido forman parte del estado para que la colocación de objetos, los efectos y la aceleración puedan reproducirse en pruebas.

Esta capa no importa React, Phaser, APIs del DOM ni almacenamiento del navegador.

`src/core/progress.ts` contiene el esquema versionado y las operaciones puras para acumular récord, partidas, comida, evolución máxima, supervivencia, objetivos y texto compartible. La capa React es la única que lee o escribe este estado en `localStorage` y migra el récord del MVP anterior.

### Escena Phaser

`src/game/MemeSnakeScene.ts` adapta la lógica pura al bucle visual. Sus responsabilidades son:

- traducir teclado, gestos o controles de la interfaz a direcciones válidas;
- avanzar el estado al intervalo que decide el núcleo;
- interpolar posiciones entre pulsos para suavizar el movimiento sin alterar la cuadrícula lógica;
- dibujar el tablero, las cinco evoluciones y las diez comidas con primitivas Canvas;
- reflejar crecimiento, rarezas, partículas, efectos activos, evolución y derrota;
- publicar hacia React los cambios necesarios para la interfaz.

La escena no debe duplicar las reglas del núcleo. Un cambio visual no puede alterar por sí solo la puntuación, las colisiones o la semilla.

### Integración React

`src/components/GameCanvas.tsx` crea el contenedor de Phaser, instancia una única partida y destruye la instancia al desmontarse. `src/App.tsx` compone portada, marcador, barra de evolución, efectos activos, estadísticas, objetivos y estados de inicio o derrota. `src/audio/SynthAudio.ts` genera respuestas sonoras cortas mediante Web Audio sin archivos externos. `src/styles.css` resuelve transiciones, layout, controles táctiles, áreas seguras, estados de foco y adaptación a móvil.

React y Phaser se comunican mediante una interfaz pequeña de eventos y comandos; React no modifica directamente objetos internos de la escena.

## Flujo de una partida

1. La portada presenta el nombre, Mini Bicho Meme y la acción de comenzar.
2. Al iniciar se crea un estado determinista y se monta la escena.
3. Cada entrada solicita un cambio de dirección; una cola corta conserva giros rápidos y el núcleo rechaza inversiones imposibles.
4. Cada pulso avanza una celda y evalúa comida, puntos, XP, multiplicadores, efectos, dificultad, crecimiento, evolución y colisiones.
5. Phaser interpola el resultado y emite feedback visual; React actualiza marcador, anuncios y efectos sonoros.
6. Una colisión lleva al estado de derrota y detiene el avance.
7. Volver a jugar crea un estado inicial nuevo sin recargar la aplicación.

## Representación y responsive

El tablero mantiene una relación de aspecto estable mediante el escalado de Phaser. El shell React limita su tamaño en escritorio y usa el ancho disponible en pantallas estrechas. Los controles tienen objetivos táctiles amplios y respetan `env(safe-area-inset-*)`. La dirección también se puede cambiar con teclado para no depender del puntero.

No se cargan assets remotos. Personajes, objetos, logotipo y efectos se construyen con Canvas, texto y CSS, lo que evita dependencias de red y problemas de licencia o CORS.

## Calidad y límites

`tests/unit/game.test.ts` cubre las reglas de partida y la configuración de puntos, XP, rareza y aspecto; `tests/unit/progress.test.ts` cubre persistencia defensiva, barra de evolución, objetivos y texto compartible. La cobertura instrumentada se limita a `src/core/**/*.ts` y exige al menos un 90 % en ramas, funciones, líneas y sentencias. `tests/e2e/smoke.spec.ts` cubre el recorrido visible en navegadores de escritorio y móvil contra la vista previa del `dist` de producción: portada, acción principal visible, controles, dos ciclos de derrota/reinicio, persistencia, Café Infinito y una evolución visual real.

La compilación es una SPA estática. No existen endpoints, funciones de servidor, cuentas, telemetría remota, base de datos ni sincronización multijugador. Las estadísticas no personales permanecen solo en el `localStorage` del navegador y se pueden eliminar borrando los datos locales del sitio.
