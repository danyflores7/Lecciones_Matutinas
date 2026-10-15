# ADR 0003. Audio neural pregenerado, nombrado por hash, en CDN y con respaldo TTS

- **Estado:** aceptada
- **Fecha:** 2026-07-08 (audio en branch `audio`, `fab3236`); 2026-07-09 (app v6, `5ffcef6`)
- **Código:** `tools/gen-audio/generar.ts`, `mobile/lib/audio.ts`, `mobile/lib/voz.ts`, `mobile/lib/segmentos.ts`

## Contexto
La voz del sistema cambia según el teléfono y suena robótica; los miembros mayores entienden mejor una voz
natural. Requisitos: costo $0 y funcionar sin internet.

## Decisión
- `generar.ts` produce un mp3 por cada **texto hablado único** con edge-tts (voz `es-MX-JorgeNeural`).
  El nombre del archivo es el **SHA-1 del texto** (sin espacios al inicio y final): `v1/<sha1>.mp3` en el branch
  `audio`, servido por jsDelivr.
- La app calcula el mismo hash (`hashHablado()` con expo-crypto) y deriva la URL del propio texto. Ambos lados
  usan la misma segmentación (`lib/segmentos.ts`, TS puro).
- Descargas: la semana en curso al arrancar (`descargarSemana`), todo desde Ajustes (`descargarTodo`), y al
  momento si falta un clip (`asegurarAudio`, límite 3.5 s). Se borran los de más de 14 días salvo modo completo.
- Respaldo: si no hay mp3 o no suena en 5 s, `decir()` usa `hablarTTS()` (expo-speech, es-MX).

## Consecuencias
- (+) No hay índice de audio que mantener: **el contrato es el texto**. Corregir un texto solo exige generar y subir su clip; no hace falta versión nueva.
- (+) La lectura nunca queda muda; el CDN es gratis.
- (−) Cambiar un solo carácter cambia el hash: hay que regenerar ese clip (si no, suena la voz del sistema).
- (−) Depende de edge-tts, un cliente no oficial (riesgo R-03; falló con 403 el 15-oct-2026).
- (−) El branch `audio` solo crece (~111 MB, 2,673 clips); los clips viejos no se borran.
- (−) Cambiar de voz exige carpeta `v2`: cambiar `VOZ_VERSION` en `lib/audio.ts` y la carpeta `out/v1` fija en `generar.ts`, regenerar todo y publicar versión.

## Alternativas descartadas
- **Voz del sistema siempre:** calidad variable.
- **TTS en la nube en tiempo real:** costo, red y llaves dentro de la app.
- **mp3 dentro del APK:** APK enorme y cada corrección sería una versión nueva.
- **Índice JSON texto → archivo:** otro artefacto que sincronizar y que se puede desfasar.
