# ADR 0004. Proyecto Android editado a mano (sin prebuild) y reconocedor sin extras de silencio

- **Estado:** aceptada
- **Fecha:** 2026-07-09 (v6: manifiesto a mano; v10, `2149708`: sin extras de silencio)
- **Código:** `mobile/android/` (fuera de git), `mobile/app/asistente.tsx` (`OPCIONES_ESCUCHA` y su comentario, eventos `end` y `error`)

## Contexto
Expo puede regenerar `mobile/android/` con `npx expo prebuild` a partir de `app.json` y sus plugins, pero esa
carpeta ya tenía ajustes propios. Lo que el plugin `expo-speech-recognition` habría agregado (permiso
`RECORD_AUDIO` y los `<queries>` de `com.google.android.googlequicksearchbox` y `android.speech.RecognitionService`)
se agregó a mano en `AndroidManifest.xml`. `mobile/.gitignore` ignora `/android`, así que no hay registro de
todas las ediciones.

En v9 (`7c87055`) se pasaron al reconocedor los extras `EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS` y
`EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS` (2,500 ms) para tolerar pausas al dictar. En los
**Pixel**, el reconocedor de Google dejó de entregar el resultado final: la app se quedaba en "Escuchando…".

## Decisión
1. **No correr `expo prebuild`** (y nunca `--clean`). Los cambios nativos se hacen a mano en `mobile/android/`.
   El versionCode y la versión se suben en `mobile/app.json` **y** en `mobile/android/app/build.gradle`
   (`tools/publicar.sh` hace las dos).
2. **Sin extras de silencio:** `OPCIONES_ESCUCHA = { lang: 'es-MX', interimResults: true, continuous: false }`.
   Red de seguridad: si la sesión termina sin resultado final (evento `end`, o `no-speech`/`speech-timeout`), se usa
   la última transcripción parcial; sin nada oído, se reintenta hasta 2 veces.

## Consecuencias
- (+) Funciona en Pixel y en los demás; el build no cambia por sorpresa.
- (−) `mobile/android/` solo existe en la Mac: si se pierde, se pierden las ediciones (riesgo R-10).
- (−) Cada actualización de Expo SDK o del nivel de API obliga a revisar lo nativo a mano (riesgo R-05).
- (−) Sin extras, una pausa larga puede cortar el dictado (lo mitiga la transcripción parcial).
- **Pendiente:** versionar `mobile/android/` sin llaves (quitar `/android` de `mobile/.gitignore`) o, al menos,
  guardar copia de `AndroidManifest.xml` y `app/build.gradle`. Si un día se migra a prebuild, convertir cada
  edición en un *config plugin*.

## Alternativas descartadas
- **Prebuild en cada build:** más limpio, pero habría que escribir un plugin por cada edición manual.
- **EAS Build en la nube:** cuenta y cuotas; no resuelve las ediciones manuales.
- **Extras de silencio solo en teléfonos que no sean Pixel:** detectar por modelo es frágil.
