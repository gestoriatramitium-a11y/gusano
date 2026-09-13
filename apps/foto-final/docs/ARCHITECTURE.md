# Arquitectura de Meme Evolution Snake

## Objetivo

La aplicación es un juego HTML5 estático y autónomo. React gestiona la interfaz y el ciclo de montaje; Phaser dibuja y anima la partida; un módulo TypeScript puro decide el estado del juego. Esta separación permite comprobar las reglas sin iniciar un navegador ni depender del reloj o de la física de Phaser.

## Capas

### Lógica determinista

`src/core/game.ts` contiene los tipos y transiciones del juego: cuadrícula, serpiente, dirección, aparición de objetos, crecimiento, puntuación, evolución y derrota. La siguiente situación depende únicamente del estado anterior y de una entrada explícita. La semilla forma parte del estado para que la colocación de objetos pueda reproducirse en pruebas.

Esta capa no importa React, Phaser, APIs del DOM ni almacenamiento del navegador.

### Escena Phaser

`src/game/MemeSnakeScene.ts` adapta la lógica pura al bucle visual. Sus responsabilidades son:

- traducir teclado, gestos o controles de la interfaz a direcciones válidas;
- avanzar el estado a intervalos controlados;
- dibujar el tablero, Mini Bicho Meme, su cuerpo y los objetos con primitivas Canvas;
- reflejar crecimiento, evolución y derrota;
- publicar hacia React los cambios necesarios para la interfaz.

La escena no debe duplicar las reglas del núcleo. Un cambio visual no puede alterar por sí solo la puntuación, las colisiones o la semilla.

### Integración React

`src/components/GameCanvas.tsx` crea el contenedor de Phaser, instancia una única partida y destruye la instancia al desmontarse. `src/App.tsx` compone portada, marcador, ayuda y estados de inicio o derrota. `src/styles.css` resuelve layout, controles táctiles, áreas seguras, estados de foco y adaptación a móvil.

React y Phaser se comunican mediante una interfaz pequeña de eventos y comandos; React no modifica directamente objetos internos de la escena.

## Flujo de una partida

1. La portada presenta el nombre, Mini Bicho Meme y la acción de comenzar.
2. Al iniciar se crea un estado determinista y se monta la escena.
3. Cada entrada solicita un cambio de dirección; el núcleo rechaza el giro opuesto inmediato.
4. Cada pulso avanza una celda y evalúa comida, crecimiento, evolución y colisiones.
5. React actualiza el marcador con los eventos de la escena.
6. Una colisión lleva al estado de derrota y detiene el avance.
7. Volver a jugar crea un estado inicial nuevo sin recargar la aplicación.

## Representación y responsive

El tablero mantiene una relación de aspecto estable mediante el escalado de Phaser. El shell React limita su tamaño en escritorio y usa el ancho disponible en pantallas estrechas. Los controles tienen objetivos táctiles amplios y respetan `env(safe-area-inset-*)`. La dirección también se puede cambiar con teclado para no depender del puntero.

No se cargan assets remotos. Personajes, objetos, logotipo y efectos se construyen con Canvas, texto y CSS, lo que evita dependencias de red y problemas de licencia o CORS.

## Calidad y límites

`tests/unit/game.test.ts` cubre las reglas puras y los casos límite. `tests/e2e/smoke.spec.ts` cubre el recorrido visible en un navegador real, incluidos inicio, control, puntuación o crecimiento, derrota y reinicio según los puntos de prueba disponibles.

La compilación es una SPA estática. No existen endpoints, funciones de servidor, cuentas, telemetría remota, base de datos ni sincronización multijugador. Cualquier estado temporal pertenece exclusivamente a la sesión del navegador.
