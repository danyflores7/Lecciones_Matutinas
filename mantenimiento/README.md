# Manual de mantenimiento: Lecciones y Matutinas

Para el mantenedor (hoy, Daniel) dentro de 6 meses, o para quien lo reemplace.
Verificado contra el código de `main` en `e4e9dd5` (v16 en curso, 15-oct-2026).

| Documento | Para qué sirve |
|---|---|
| Este archivo | Cómo está armado y **manual de operación**: las tareas frecuentes paso a paso |
| [arquitectura.md](arquitectura.md) | Vistas 4+1, estilo, patrones y escenarios de atributo de calidad |
| [decisiones/](decisiones/) | ADR: por qué está hecho así (0001 a 0007) |
| [requisitos.md](requisitos.md) | Historias de usuario RF-01 a RF-13, RNF-01 a RNF-06 y matriz de trazabilidad |
| [riesgos.md](riesgos.md) | Registro de riesgos con exposición, respuesta y disparador |
| [forma-de-trabajo.md](forma-de-trabajo.md) | Kanban personal, Definición de Terminado, checklist de publicación, deuda técnica |
| [../CHANGELOG.md](../CHANGELOG.md) | Qué cambió en cada versión (v1 a v16) |

ADR: [0001 voz por reglas](decisiones/0001-parser-de-voz-por-reglas.md) ·
[0002 contenido local](decisiones/0002-contenido-local-y-copia-incluida.md) ·
[0003 audio por hash](decisiones/0003-audio-neural-por-hash-en-cdn-con-respaldo-tts.md) ·
[0004 Android sin prebuild](decisiones/0004-android-sin-prebuild-y-reconocedor-sin-extras.md) ·
[0005 Supabase gratuito](decisiones/0005-supabase-gratuito-con-tarea-anti-pausa.md) ·
[0006 frases compartidas](decisiones/0006-frases-fijas-compartidas-app-generador.md) ·
[0007 lección vigente](decisiones/0007-leccion-vigente-proximo-sabado.md)

## Cómo está armado (en 10 líneas)

1. App Android hecha con Expo SDK 56 + TypeScript en `mobile/` (rutas de Expo Router en `mobile/app/`, lógica en `mobile/lib/`).
2. El contenido (matutinas, lecciones, preguntas, citas) vive en **Supabase** (plan gratuito, 4 tablas de solo lectura para `anon`).
3. Al abrir con internet, la app baja **todo** el texto y lo guarda en el teléfono (`lib/contenido.ts`); sin internet usa lo guardado.
4. Además trae una copia dentro del APK (`mobile/assets/contenido.json`): funciona desde el primer arranque sin red o con Supabase pausado.
5. La voz "Jorge" son mp3 pregenerados con edge-tts (`tools/gen-audio/generar.ts`), nombrados por el **SHA-1 del texto hablado**.
6. Los mp3 y los datos de búsqueda (Biblia completa, relacionados) están en el branch `audio` de GitHub y se sirven por jsDelivr.
7. Si un mp3 no está o no hay red, se lee con la voz del sistema (`lib/voz.ts`, función `decir()` → `hablarTTS()`).
8. El modo por voz usa el reconocedor de Google del teléfono y un intérprete **por reglas, sin IA** (`lib/comandos.ts`).
9. La carpeta nativa `mobile/android/` **no está en git** (la ignora `mobile/.gitignore`) y se edita a mano: no se usa `expo prebuild`.
10. Una tarea de GitHub Actions (`.github/workflows/mantener-supabase.yml`) consulta Supabase lunes y jueves para que no se pause.

**Datos de referencia**

| Qué | Valor |
|---|---|
| Repositorio | `github.com/danyflores7/Lecciones_Matutinas` (branches `main` y `audio`) |
| Paquete Android | `com.appiglesia.matutinas` |
| Supabase | proyecto `vyughgekzftsgkfcuyeq` (tablas `versiculos_dia`, `lecciones`, `lecciones_preguntas`, `citas_texto`) |
| CDN de audio | `https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/v1/<sha1>.mp3` |
| CDN de datos | `...@audio/datos/v1/{biblia,relacionados_versiculos,relacionadas_preguntas}.json` |
| Archivos secretos (fuera de git, **no subir nunca**) | `Matutinas-upload-key.jks`, `CLAVES-keystore.txt`, `mobile/.env`, `legal/autorizacion-iglesia.md` |

## Antes de cualquier tarea

```bash
cd /Users/danielfloresrojas/Documents_local/App_Iglesia
git pull
# Llave anónima de solo lectura (pública; es la misma que usa la tarea anti-pausa)
export SB_URL=https://vyughgekzftsgkfcuyeq.supabase.co
export SB_KEY=$(grep -o 'eyJ[A-Za-z0-9._-]*' .github/workflows/mantener-supabase.yml)
```

Para **escribir** en la base se usa el panel de Supabase con tu cuenta (la llave anónima solo lee, por RLS).

**Revisar que todo está sano** (lo mismo corre la integración continua, `.github/workflows/calidad.yml`, en cada push a `main`):

```bash
cd mobile
npm ci                        # solo si es un clon nuevo
npx tsc --noEmit              # tipos de la app
npm test                      # 73 pruebas (node:test + tsx), nombres con el ID del requisito
npm run verificar-version     # app.json y android/app/build.gradle con la misma versión
npm run complejidad           # informativo: funciones con mayor complejidad ciclomática
cd ..
```

Solo las pruebas de un requisito: `cd mobile && npx tsx --test --test-name-pattern="RF-06" tests/*.test.ts`.

---

## Tarea 1. Agregar o corregir notas de la matutina

La nota es la columna `versiculos_dia.nota` (texto, puede ser nula). Se muestra en el recuadro
"Nota del día" (`components/VistaMatutina.tsx`), se lee al final de la matutina como
`Nota. <texto>` (`lib/segmentos.ts`, `segmentosMatutina`) y por voz con "la nota de la matutina de hoy".

1. **Editar en Supabase**: panel → Table Editor → `versiculos_dia` → filtra por `fecha` → edita `nota`.
   O en SQL Editor (usa `$$...$$` si el texto lleva comillas):
   ```sql
   update versiculos_dia set nota = $$Texto de la nota$$ where fecha = '2026-10-20';
   update versiculos_dia set nota = null where fecha = '2026-10-21';   -- quitar
   ```
2. **Ya llega a los teléfonos con internet**: al abrir la app, `sincronizarContenido()` (llamada en `app/_layout.tsx`) baja todo. No hace falta publicar versión para el texto.
3. **Regenerar la copia incluida** (para instalaciones nuevas sin internet):
   ```bash
   npx tsx tools/datos/snapshot_contenido.ts
   # imprime: contenido.json: 365 matutinas (N con nota), 30 lecciones, ...
   git add mobile/assets/contenido.json && git commit -m "Contenido: notas de matutina de octubre"
   ```
   Viaja en la siguiente versión de la app.
4. **Generar el audio** (la nota cambia el texto hablado, así que tiene un hash nuevo):
   ```bash
   LIMIT=3 npx tsx tools/gen-audio/generar.ts   # prueba con 3
   npx tsx tools/gen-audio/generar.ts           # todo lo que falte
   ```
   Solo genera los textos que no tienen mp3 en `tools/gen-audio/out/v1/`. Si un clip falla, el script lo borra; vuelve a correrlo.
   **Si sale error 403** (pasó el 15-oct-2026): `python3 -m pip install --user -U edge-tts` y repite.
5. **Publicar el audio en el branch `audio`** (con un git worktree, para no cambiar de branch en `main`):
   ```bash
   git fetch origin audio
   git worktree add ../App_Iglesia-audio audio        # solo la primera vez
   cd ../App_Iglesia-audio && git pull
   rsync -a --ignore-existing ../App_Iglesia/tools/gen-audio/out/v1/ v1/
   git add v1 && git commit -m "Audio: notas de matutina de octubre" && git push origin audio
   cd ../App_Iglesia
   ```
6. **Comprobar** un clip (hash del texto exacto, sin espacios al inicio o final):
   ```bash
   H=$(node -e 'console.log(require("crypto").createHash("sha1").update(process.argv[1].trim()).digest("hex"))' "Nota. Texto de la nota")
   curl -sI "https://cdn.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/v1/$H.mp3" | head -1   # HTTP 200
   ```
   Si da 404 justo después de subir, el CDN aún tiene la rama en caché: espera unas horas o purga con
   `curl "https://purge.jsdelivr.net/gh/danyflores7/Lecciones_Matutinas@audio/v1/$H.mp3"`.
   Mientras tanto la app lee ese segmento con la voz del sistema (no falla).

## Tarea 2. Cargar el siguiente semestre (o año)

1. **Transcribir** el cuaderno (fotos en carpetas como `Matitinas_segundo_semestre_2026\/` y `Lecciones_Julio-diciembre/`)
   al formato de `db/seed_versiculos_2026_2.sql` y `db/seed_lecciones_2026_2.sql`.
   Ojo: `db/_build_sem2.py` y `db/_build_lecciones_sem2.py` leen JSON de una carpeta temporal (`SCRATCH = /private/tmp/...`)
   que **ya no existe**. Copia el script, cambia `SCRATCH` a una carpeta del repo (p. ej. `db/fuentes/2027_1/`) y guarda ahí los JSON.
2. **Revisar las citas** antes de cargar: nombre de libro completo ("Hebreos 4:14", no "Heb. 4:14") y capítulo/verso que existan.
   Este riesgo ya se materializó (riesgo R-08 en [riesgos.md](riesgos.md)); la mitigación es una prueba automática
   sobre `mobile/assets/contenido.json` que se corre con `npm test` después del snapshot.
3. **Cargar en Supabase** (SQL Editor). Cuidado con el comportamiento de los seeds:
   - matutinas: `on conflict (fecha) do nothing` → **no corrige** filas existentes; para corregir usa `update`.
   - lecciones: `on conflict (fecha) do update`; las preguntas se borran y se vuelven a insertar por fecha.
   - pon `semestre` (p. ej. `'2027-1'`). El número de lección se repite entre semestres; la voz toma la de fecha más reciente (`resolverLeccion` en `app/asistente.tsx`).
4. Copia incluida y audio: pasos 3 a 6 de la Tarea 1 (para un semestre son unos 1,300 clips; tarda).
5. **Datos de búsqueda**: las preguntas similares se precalculan por `id` de pregunta (`tools/datos/build_relacionadas.py`, que lee
   exportaciones `lecciones.json`, `lecciones_preguntas.json` y `citas_texto.json` en `tools/datos/`).
   **Limitación importante:** `descargarDatos()` en `lib/biblia.ts` solo baja un archivo si **no existe** en el teléfono. Para que
   los teléfonos reciban el archivo nuevo hay que publicarlo en `datos/v2/` y cambiar `BASE` y la carpeta en `lib/biblia.ts`
   (requiere versión nueva). Sin esto, las preguntas nuevas no tienen similares (no falla, devuelve lista vacía).
6. **Textos con el año fijo** en `app/(tabs)/index.tsx`: "Año 2026" y "El plan cargado va del 1 de enero al 31 de diciembre de 2026."
7. Publica versión (Tarea 3).

## Tarea 3. Publicar una versión

Usa **`tools/publicar.sh` (ver encabezado del script)**; requisitos, variables y qué hacer si falla cada paso
están en `tools/README-publicar.md`. En resumen: `tools/publicar.sh 1.13.0` (o `--sin-build` para una prueba en
seco) sube el versionCode en `mobile/app.json` **y** en `mobile/android/app/build.gradle` (los dos, porque no hay
prebuild), regenera la copia incluida, corre `tsc` y `npm test`, compila y firma con la llave de subida
(contraseña en `MATUTINAS_KEY_PASS`, mejor desde el Llavero de macOS) y verifica firma y versión. No hace commit
ni push: imprime los comandos sugeridos.
Antes y después sigue el [checklist de publicación](forma-de-trabajo.md#checklist-de-publicación).
Convención de nombres: **App vN = versionCode N−1** desde v6 (v15 = versionCode 14; v16 = versionCode 15, 1.13.0,
archivo `Matutinas-v16.aab`).

## Tarea 4. Si Supabase se pausa

Síntomas: correo de GitHub "Run failed" de la tarea **Mantener Supabase activo**, correo de Supabase de proyecto pausado,
o las notas nuevas no llegan. Desde v16 los miembros **siguen usando la app** (copia incluida + lo sincronizado).

1. Entra a supabase.com → proyecto `vyughgekzftsgkfcuyeq` → **Restore project**. Espera a que diga activo.
2. Comprueba:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
     "$SB_URL/rest/v1/versiculos_dia?select=fecha&limit=1"    # 200
   ```
3. GitHub → Actions → **Mantener Supabase activo** → *Run workflow* (tiene `workflow_dispatch`). Debe salir verde.
4. Averigua por qué no corrió: GitHub **desactiva las tareas programadas de un repo público tras 60 días sin actividad**.
   Si aparece "This scheduled workflow is disabled", actívala de nuevo (botón *Enable workflow*).
5. Si el proyecto ya no se puede restaurar: crea uno nuevo, corre `db/seed_*.sql`, agrega lo que los seeds no traen
   (`alter table versiculos_dia add column if not exists nota text;`, política de lectura para `anon` en `versiculos_dia`,
   quitar `unique` de `lecciones.numero`) y recupera las notas desde `mobile/assets/contenido.json` (es una copia completa).
   Luego cambia la URL y la llave en `mobile/.env` y en la tarea, y publica versión.

## Tarea 5. Un miembro reporta un problema

Pídele (de preferencia por escrito):

1. **Los datos de soporte**: Inicio → Ajustes → sección **"Acerca de la app"** → botón
   **"Enviar estos datos (si algo falla)"** (lo manda por WhatsApp, correo, etc.). Trae versión y versionCode,
   sistema y nivel de API de Android (no la marca ni el modelo: pregúntalos), de dónde viene el contenido ("actualizado" o "el que trae la app") y su fecha,
   matutinas con nota y lecciones, espacio del audio (y si está completo) y si la Biblia para buscar ya se descargó
   (`armarDiagnostico()` en `app/ajustes.tsx`). En versiones anteriores a v16 no existe: pide la versión en
   Play Store → Lecciones y Matutinas → Acerca de esta app, y la marca y modelo del teléfono.
2. **Qué quería hacer, qué esperaba y qué pasó.** Si fue por voz: la frase exacta y lo que aparece en "Escuché: …".
3. **Captura de pantalla** y día y hora aproximados.
4. ¿Tenía internet (wifi o datos)? ¿Usa TalkBack o letra grande?

Pistas rápidas:

| Síntoma | Causa probable | Ver |
|---|---|---|
| Se queda en "Escuchando…" | Reconocedor de Google del teléfono; app de Google desactualizada | [ADR 0004](decisiones/0004-android-sin-prebuild-y-reconocedor-sin-extras.md) |
| "Este teléfono no tiene el reconocimiento de voz en español" | Falta o está desactualizada la app de Google | `errorDeMicrofono()` en `app/asistente.tsx` |
| Una parte suena con voz robótica | Ese clip no está en el CDN o no había red (respaldo TTS) | Tarea 1, pasos 4 a 6 |
| No aparece una nota nueva | No ha abierto la app con internet, o tiene una versión anterior a v16 | Tarea 1 |
| "… no existe en la Biblia" / "No encontré …" | Cita mal capturada en el contenido | riesgo R-08 |
| "La Biblia completa aún se está descargando" | Nunca tuvo internet desde que instaló | `descargarDatos()` en `lib/biblia.ts` |

Después: registra el reporte en el tablero con severidad y frecuencia ([forma-de-trabajo.md](forma-de-trabajo.md#comentarios-de-la-iglesia)).
