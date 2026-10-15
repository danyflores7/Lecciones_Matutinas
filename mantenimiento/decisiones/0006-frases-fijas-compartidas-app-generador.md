# ADR 0006. Frases fijas compartidas entre la app y el generador (`lib/frases.ts`)

- **Estado:** aceptada
- **Fecha:** 2026-10-15 (v16, `42fb504`)
- **Código:** `mobile/lib/frases.ts` (`F`, `frasesFijas()`), `mobile/app/asistente.tsx`, `tools/gen-audio/generar.ts`

## Contexto
El audio se busca por el hash del texto exacto (ADR 0003). Las frases del modo por voz ("Te escucho…",
"No te entendí…", la ayuda) estaban escritas en `asistente.tsx` y copiadas a mano en el generador: una coma
distinta bastaba para que la frase sonara con la voz del sistema.

## Decisión
`lib/frases.ts` exporta el objeto `F` (ayuda, bienvenida, noEntendi, primeroPide, sinLeccion, sinNotaMatutina,
`abriendo.{inicio, calendario, estudio, buscar}`…) y `frasesFijas()`, que las recorre todas. `asistente.tsx` usa
`F.*` y `generar.ts` hace `add(frasesFijas())`. Es TS puro (sin Expo), igual que `segmentos.ts`, para que Node lo
importe con `npx tsx`.

## Consecuencias
- (+) Una sola fuente de verdad. Frase nueva = agregarla a `F`, usarla y regenerar audio.
- (−) Las frases con datos variables ("No encontré la lección 7.", "La lección 3 no tiene notas.") no se pueden pregrabar: siempre suenan con la voz del sistema.
- (−) **Pendiente:** los anuncios "Matutina del D de M." y "Lección N. Título." siguen duplicados en `asistente.tsx` y en `generar.ts` (allí con su propia lista `MESES`). Moverlos a funciones en `frases.ts`.

## Alternativas descartadas
- **Lista JSON de frases:** pierde tipos y autocompletado.
- **Generar audio al momento en el teléfono:** requiere red y un servicio de voz.
