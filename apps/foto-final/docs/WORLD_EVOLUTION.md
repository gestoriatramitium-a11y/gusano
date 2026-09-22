# Fase 3: World Evolution

## Alcance

World Evolution añade competición simulada completamente local. No existe red, servidor, cuenta, ranking ni multijugador: los rivales son agentes deterministas ejecutados en el navegador y el país elegido se guarda únicamente en `localStorage`.

## Bots

`src/core/world.ts` mantiene el estado puro del mundo y `src/core/worldConfig.ts` concentra sus parámetros. La misma semilla, estado del jugador y tiempo producen el mismo resultado.

Hay tres tamaños, con ritmos y límites distintos:

| Tipo    | Longitud inicial | Máximo | Cadencia | Escala visual |
| ------- | ---------------- | ------ | -------- | ------------- |
| Pequeño | 4                | 11     | 1 tick   | 0,72          |
| Medio   | 7                | 19     | 2 ticks  | 0,92          |
| Gigante | 10               | 32     | 3 ticks  | 1,36          |

Cada agente recibe nombre, país, bandera y uno de cuatro perfiles:

- **Agresivo:** prioriza comida y se acerca más al jugador.
- **Explorador:** introduce más variación y recorre el mapa.
- **Cobarde:** pondera con fuerza paredes, cuerpos y distancia de seguridad.
- **Equilibrado:** combina alimento, espacio y seguridad.

La decisión evalúa primero movimientos legales, paredes, cuerpos rivales y jugador. Después puntúa seguridad, cercanía de comida, distancia al jugador y exploración. Los bots pueden recoger comida ambiental y restos de una muerte; sus parámetros de riesgo, tamaño y oportunidad están centralizados en `worldConfig.ts`. Los agentes lejanos avanzan a media cadencia para mantener estable el coste de CPU.

En calidad normal se simulan doce bots; en reducida, seis. Una invasión añade hasta cuatro rivales temporales con un máximo global de dieciséis. Cada aparición tiene 3,5 segundos de protección.

## Colisiones, muertes y restos

La regla competitiva es simétrica y determinista: una cabeza que entra en el cuerpo de otro gusano elimina al gusano que impacta. Los choques cabeza contra cabeza, cuerpo contra cuerpo, proximidad y la propia estela no provocan derrota. El jugador conserva protección de aparición durante 3,5 segundos.

Cuando cae un bot, `world.ts` crea una explosión visual breve y deja restos con recompensas limitadas según el tamaño: 4, 7 u 11 objetos. Cada resto tiene puntos, XP, crecimiento, rareza, caducidad y fuente (`remains`), y el jugador los recoge mediante el mismo sistema de eventos que la comida normal. La bolsa ambiental está limitada a 56 objetos y se repone de forma determinista.

## Países e identidad

La primera partida solicita país. Se incluyen España, México, Argentina, Colombia, Brasil, Estados Unidos, Reino Unido, Francia, Alemania, Italia, Japón y Corea del Sur. La preferencia v2 migra el esquema anterior y conserva tutorial, movimiento reducido y calidad gráfica.

La bandera del jugador se dibuja sobre la cabeza, acompaña la interpolación y se orienta suavemente con la trayectoria. Cada bot muestra bandera, nombre y evolución estimada. Colores primario y secundario quedan centralizados para patrones corporales y accesorios posteriores.

## Mundo y biomas

El tablero lógico es de 72 × 48 celdas, mayor que el viewport. `src/game/worldCamera.ts` mantiene una escala de 30 px por celda, limita el scroll a los bordes y sigue la cabeza con interpolación de cámara; el HUD React permanece fijo fuera del canvas. El tablero se presenta como cuatro zonas:

1. **Pradera Meme:** vegetación, flores y piedras.
2. **Ciudad Fast Food:** carteles, patatas fritas y residuos urbanos.
3. **Laboratorio Cringe:** matraces, antenas y ambiente tecnológico.
4. **Zona Caos:** cristales, glitches y colores inestables.

La decoración se genera una vez por semilla y se dibuja solo dentro de la ventana visible. Hay 150 elementos en calidad normal y 72 en reducida. Las capas dinámicas separan efectos mundiales, bots, objetos, restos y jugador para evitar recrear objetos Phaser cada frame; las etiquetas se reutilizan y los bots lejanos se omiten visualmente.

## Eventos

Tras un intervalo determinista de 18 a 30 segundos puede comenzar uno de cuatro eventos configurables:

- **Lluvia de objetos:** feedback ambiental de recompensas.
- **Modo caos:** distorsión visual y mayor variación en la IA.
- **Portales meme:** un par de portales puede transportar bots.
- **Invasión bot:** añade rivales agresivos temporales.

Cada evento tiene duración, nombre y color propios. Al finalizar se limpian portales, partículas visuales y bots temporales. Los efectos ambientales escalan con la evolución del jugador, pero se reducen cuando está activa la preferencia de menos movimiento.

## Rendimiento y límites

- **Auto:** cambia a reducida si la cadencia media cae por debajo del umbral configurado.
- **Normal:** doce bots, 150 decoraciones, restos completos y etiquetas reutilizadas.
- **Reducida:** seis bots, 72 decoraciones, menos partículas y etiquetas ocultas.
- El mundo tiene un máximo de dieciséis bots y no crea timers independientes: avanza con el mismo tick controlado por la escena.
- Todo el dibujo usa Canvas, texto y primitivas locales; no se descargan banderas ni assets externos.

La siguiente iteración debería medir sesiones reales locales para ajustar densidad, legibilidad de etiquetas y agresividad. Ranking online, cuentas, backend, monetización y multijugador siguen fuera de alcance.
