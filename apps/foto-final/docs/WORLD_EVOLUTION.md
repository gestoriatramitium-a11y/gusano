# Fase 3: World Evolution

## Alcance

World Evolution añade competición simulada completamente local. No existe red, servidor, cuenta, ranking ni multijugador: los rivales son agentes deterministas ejecutados en el navegador y el país elegido se guarda únicamente en `localStorage`.

## Bots

`src/core/world.ts` mantiene el estado puro del mundo y `src/core/worldConfig.ts` concentra sus parámetros. La misma semilla, estado del jugador y tiempo producen el mismo resultado.

Hay tres tamaños:

| Tipo    | Longitud inicial | Cadencia | Escala visual |
| ------- | ---------------- | -------- | ------------- |
| Pequeño | 4                | 2 ticks  | 0,72          |
| Medio   | 7                | 2 ticks  | 0,92          |
| Gigante | 10               | 3 ticks  | 1,15          |

Cada agente recibe nombre, país, bandera y uno de cuatro perfiles:

- **Agresivo:** prioriza comida y se acerca más al jugador.
- **Explorador:** introduce más variación y recorre el mapa.
- **Cobarde:** pondera con fuerza paredes, cuerpos y distancia de seguridad.
- **Equilibrado:** combina alimento, espacio y seguridad.

La decisión evalúa primero movimientos legales, paredes, cuerpo propio, otros bots y jugador. Después puntúa seguridad, cercanía de comida, distancia al jugador y exploración. Los bots pueden recoger el mismo objeto visible que persigue el jugador; al hacerlo crecen, generan un aviso y el núcleo del jugador reubica la comida sin alterar sus puntos ni su XP. No son obstáculos letales para el jugador en esta fase, evitando introducir una regla de derrota nueva sin telemetría de balance.

En calidad normal se simulan seis bots; en reducida, tres. Una invasión añade hasta dos rivales temporales con un máximo global de ocho.

## Países e identidad

La primera partida solicita país. Se incluyen España, México, Argentina, Colombia, Brasil, Estados Unidos, Reino Unido, Francia, Alemania, Italia, Japón y Corea del Sur. La preferencia v2 migra el esquema anterior y conserva tutorial, movimiento reducido y calidad gráfica.

La bandera del jugador se dibuja sobre la cabeza, acompaña la interpolación y se orienta suavemente con la trayectoria. Cada bot muestra bandera, nombre y evolución estimada. Colores primario y secundario quedan centralizados para patrones corporales y accesorios posteriores.

## Mundo y biomas

El tablero conserva las reglas y colisiones deterministas del Snake existente, pero se presenta como cuatro zonas:

1. **Pradera Meme:** vegetación, flores y piedras.
2. **Ciudad Fast Food:** carteles, patatas fritas y residuos urbanos.
3. **Laboratorio Cringe:** matraces, antenas y ambiente tecnológico.
4. **Zona Caos:** cristales, glitches y colores inestables.

La decoración se genera una vez por semilla y se dibuja en una capa estática. Hay 36 elementos en calidad normal y 18 en reducida. Las capas dinámicas separan efectos mundiales, bots, objetos y jugador para evitar recrear objetos Phaser cada frame; las etiquetas se reutilizan.

## Eventos

Tras un intervalo determinista de 18 a 30 segundos puede comenzar uno de cuatro eventos configurables:

- **Lluvia de objetos:** feedback ambiental de recompensas.
- **Modo caos:** distorsión visual y mayor variación en la IA.
- **Portales meme:** un par de portales puede transportar bots.
- **Invasión bot:** añade rivales agresivos temporales.

Cada evento tiene duración, nombre y color propios. Al finalizar se limpian portales, partículas visuales y bots temporales. Los efectos ambientales escalan con la evolución del jugador, pero se reducen cuando está activa la preferencia de menos movimiento.

## Rendimiento y límites

- **Auto:** elige normal o reducida según CPU, memoria, densidad y puntero táctil.
- **Normal:** seis bots, 36 decoraciones y efectos completos.
- **Reducida:** tres bots, 18 decoraciones y menos etiquetas/partículas.
- El mundo tiene un máximo de ocho bots y no crea timers independientes: avanza con el mismo tick controlado por la escena.
- Todo el dibujo usa Canvas, texto y primitivas locales; no se descargan banderas ni assets externos.

La siguiente iteración debería medir sesiones reales locales para ajustar densidad, legibilidad de etiquetas y agresividad. Ranking online, cuentas, backend, monetización y multijugador siguen fuera de alcance.
