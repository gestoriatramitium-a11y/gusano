# Meme Evolution Snake

MVP HTML5 para un jugador que combina el movimiento clásico de *Snake* con una criatura meme que crece y cambia de aspecto durante la partida. Todo se ejecuta en el navegador: no hay backend, base de datos, cuentas, multijugador ni recursos gráficos externos.

El jugador controla a **Mini Bicho Meme**, recoge objetos meme, aumenta su puntuación y longitud y desbloquea evoluciones visuales. La ronda termina al chocar; la pantalla de derrota muestra el resultado y permite volver a jugar de inmediato.

## Incluido en el MVP

- Portada con el logotipo **Meme Evolution Snake**.
- Movimiento continuo en una cuadrícula al estilo *Snake*.
- Controles de teclado y una interfaz táctil para móvil.
- Objetos meme dibujados por código.
- Crecimiento, puntuación y evoluciones visuales durante la partida.
- Detección de derrota y reinicio sin recargar la página.
- Diseño responsive para móvil y escritorio.
- Lógica del juego separada de Phaser y de la interfaz.
- Aplicación estática preparada para GitHub, CI y Netlify.

## Tecnologías

- React
- TypeScript estricto
- Phaser 3
- Vite
- Vitest
- Playwright
- ESLint y Prettier
- npm con `package-lock.json`

Los gráficos se generan con Phaser Canvas y CSS; el juego no descarga imágenes, tipografías ni otros assets externos.

## Ejecutar en local

Requisitos: Node.js 22 y npm.

```bash
cd apps/foto-final
npm install
npm run dev
```

Vite mostrará en la terminal la URL local de desarrollo.

## Comandos

Todos los comandos se ejecutan desde `apps/foto-final/`.

```bash
npm run dev          # servidor de desarrollo
npm run build        # compilación estática en dist/
npm run preview      # vista previa de la compilación
npm run format:check # comprobación de formato
npm run lint         # análisis estático
npm run typecheck    # comprobación de TypeScript
npm run test         # pruebas unitarias
npm run test:e2e     # pruebas de navegador
npm run check        # puerta de calidad agregada
```

Los resultados de estas comprobaciones deben comunicarse únicamente después de ejecutarlas; este documento no presupone que la puerta de calidad esté aprobada.

## Estructura

```text
apps/foto-final/
├── src/core/         # estado y reglas deterministas, sin Phaser
├── src/game/         # escena y representación Phaser
├── src/components/   # integración React y controles
├── tests/unit/       # pruebas de la lógica pura
├── tests/e2e/        # recorrido jugable en navegador
└── docs/             # arquitectura, trazabilidad y despliegue
```

## Despliegue

El `netlify.toml` de la raíz configura `apps/foto-final` como directorio base, ejecuta `npm run build` y publica `apps/foto-final/dist`. Consulta [la guía de despliegue](apps/foto-final/docs/DEPLOYMENT.md) para el flujo completo y las limitaciones del estado externo.

## Documentación

- [Arquitectura](apps/foto-final/docs/ARCHITECTURE.md)
- [Trazabilidad](apps/foto-final/docs/TRACEABILITY.md)
- [Validación local](apps/foto-final/docs/VALIDATION.md)
- [Despliegue](apps/foto-final/docs/DEPLOYMENT.md)

## Privacidad y alcance

El MVP no almacena secretos, credenciales, datos personales ni identificadores persistentes. No incorpora publicidad real, campañas, tienda, autenticación, funciones sociales ni servicios de servidor.
