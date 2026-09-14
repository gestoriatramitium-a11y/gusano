# Despliegue en GitHub y Netlify

Meme Evolution Snake se publica como sitio estático. Netlify no necesita funciones, variables de entorno, base de datos ni servicios externos.

## Comprobación local

Ejecuta desde la raíz del repositorio:

```bash
cd apps/foto-final
npm ci
npm run test:coverage
npm run check
```

La prueba E2E sirve el `dist` ya compilado mediante `vite preview`; por ello debe ejecutarse después de `npm run build` o como parte de `npm run check`.

Si las comprobaciones terminan correctamente, verifica que el build contiene el documento y sus assets:

```bash
npm run build
test -f dist/index.html
test -n "$(find dist/assets -type f -print -quit)"
```

En PowerShell, las dos últimas comprobaciones equivalen a:

```powershell
Test-Path dist/index.html
Get-ChildItem dist/assets -File
```

No se debe publicar un `dist` residual: el directorio tiene que proceder del commit que se desea desplegar.

## GitHub

El trabajo se realiza en la rama `codex/foto-final-mvp` sin reescribir el historial. Antes del push:

1. Revisa que no haya secretos, credenciales, datos personales ni archivos generados añadidos por error.
2. Ejecuta la puerta de calidad.
3. Comprueba el diff y crea un commit descriptivo.
4. Publica la rama en el remoto configurado y abre una Pull Request hacia `main`.

El workflow `.github/workflows/ci.yml` instala con `npm ci`, ejecuta formato, lint, tipos, pruebas unitarias con umbral de cobertura, build y Playwright, y verifica que `dist/index.html` y los assets existen. Solo una ejecución real en GitHub permite afirmar que CI está aprobada.

## Netlify mediante Git

1. Importa en Netlify el repositorio de GitHub.
2. Permite que Netlify lea el `netlify.toml` situado en la raíz.
3. Confirma los valores resueltos:
   - Base directory: `apps/foto-final`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node.js: `22.17.0`
4. Despliega una rama o Pull Request y abre la URL generada.
5. Comprueba portada, teclado, controles táctiles, puntuación, derrota y reinicio en la URL publicada.
6. Revisa consola y red para confirmar que no hay errores ni recursos externos inesperados.

La redirección SPA devuelve `index.html` para rutas desconocidas. Netlify revalida ese documento en cada visita y conserva los assets con nombre versionado en caché inmutable durante un año. El despliegue no incluye las funciones Netlify antiguas que puedan existir fuera de `apps/foto-final`.

## Despliegue manual opcional

Tras ejecutar `npm run build`, el contenido publicable es únicamente `apps/foto-final/dist/`. Puede arrastrarse ese directorio a Netlify Drop, aunque el flujo recomendado es el despliegue continuo desde GitHub para mantener trazabilidad entre commit, CI y publicación.

## Estado externo

Un build local correcto no demuestra que exista un repositorio remoto, una Pull Request, un Deploy Preview o una publicación en producción. Esos estados deben informarse con su URL o evidencia real; si no hay acceso o credenciales, deben quedar explícitamente pendientes.
