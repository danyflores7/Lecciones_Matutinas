# Lecciones y Matutinas para computadora (Mac y Windows)

La misma app del teléfono dentro de una ventana. Trae **todo incluido**: el texto de
todo el año, la voz de Jorge (2,695 audios), la Biblia completa y los datos de búsqueda.
**No necesita internet** y no hay nada que descargar.

## Cómo instalarla (para quien la va a usar)

**Windows** — abre `Lecciones-y-Matutinas-…-win-x64.exe` y sigue el instalador.
Si Windows muestra "Windows protegió su PC", pulsa **Más información → Ejecutar de todas formas**
(sale porque el programa no está firmado con un certificado comercial).

**Mac** — abre el `.dmg` y arrastra *Lecciones y Matutinas* a *Aplicaciones*.
La primera vez, haz **clic derecho (o Control+clic) sobre el programa → Abrir → Abrir**
(macOS avisa porque el programa no está firmado con una cuenta de Apple Developer).
Mac con chip Apple (M1, M2, M3…): archivo `…-mac-arm64.dmg`. Mac con Intel: `…-mac-x64.dmg`.

## Diferencias con el teléfono

- **Modo por voz:** en la computadora no se dicta; se **escribe** lo que quieres escuchar
  ("la matutina de hoy", "lección 3", "dónde se cita Juan 3 16"…) y la voz de Jorge lo lee.
- **Compartir** se convierte en **Copiar** (copia el versículo para pegarlo).
- No hay recordatorio por notificación (eso es del teléfono).
- El tamaño de la letra, el progreso de las lecciones y la bienvenida se guardan en esa computadora.

## Para el mantenedor

```bash
cd desktop
npm install                 # una vez
node scripts/preparar.mjs   # exporta la app web y trae audio + Biblia del branch "audio"
npm run iniciar             # abre el programa en modo desarrollo
npm run prueba              # prueba de humo: lo abre y lo maneja como una persona (≈1 min)
npm run dist:mac            # instaladores de Mac  -> desktop/dist/*.dmg
npm run dist:win            # instalador de Windows -> desktop/dist/*.exe
```

- La app es **la misma** que la del teléfono (`mobile/`); lo propio de la computadora está en los
  archivos `*.web.ts` (`lib/audio.web.ts`, `lib/datos.web.ts`, `lib/notifications.web.ts`) y en
  `desktop/main.js` (sirve todo con el protocolo `app://matutinas/`).
- **Windows se compila y se prueba en GitHub** (máquina Windows real): Actions → *Programa de
  escritorio* → *Run workflow*. Deja los instaladores y capturas como "artifacts".
- Cuando cambie el contenido o el audio: publica en el branch `audio` y vuelve a compilar.
- La versión (`package.json` de esta carpeta) se mantiene igual a la de la app del teléfono.
