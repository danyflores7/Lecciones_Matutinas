# ADR 0007. Lección vigente = la del próximo sábado

- **Estado:** aceptada
- **Fecha:** 2026-07-09 (v12, `b0a967a`); en v16 también la usan Inicio y Estudio
- **Código:** `mobile/lib/contenido.ts` (`leccionVigente`)

## Contexto
Cada lección de Escuela Sabática tiene la fecha del sábado en que se repasa y se **estudia durante la semana
anterior**. Hasta v11 la "vigente" era la de mayor fecha `<= hoy`, es decir, la del sábado que ya pasó: de domingo
a viernes, "la lección de esta semana" devolvía la que ya se había estudiado.

## Decisión
`leccionVigente(lecciones, hoy)` ordena por fecha y devuelve la **primera con `fecha >= hoy`** (el sábado mismo
es la de ese día). Si el plan ya terminó, devuelve la última. Una sola función que usan: la descarga semanal de
audio (`hashesDeLaSemana` en `lib/audio.ts`), el asistente (`leerLeccionActual`, `resolverLeccion`,
`hPreguntasSimilares`), Inicio (lección de la semana y progreso) y Estudio (insignia "Esta semana").

## Consecuencias
- (+) Coincide con cómo estudian los miembros; es una función pura, fácil de probar (RF-04).
- (−) Depende de la fecha local del teléfono (`fechaHoyISO()`).
- (−) Al terminar el plan se queda en la última lección hasta cargar el semestre siguiente.
- (−) Los números de lección se repiten entre semestres (hay dos "lección 23"); por eso todo se resuelve por fecha y, por número, gana la más reciente.

## Alternativas descartadas
- **La del sábado anterior** (comportamiento hasta v11): no es la que se estudia.
- **Elegirla a mano en Ajustes:** un paso más para usuarios mayores.
