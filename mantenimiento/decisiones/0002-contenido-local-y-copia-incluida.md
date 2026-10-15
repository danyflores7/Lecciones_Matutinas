# ADR 0002. Contenido completo en el teléfono y copia incluida en la app

- **Estado:** aceptada
- **Fecha:** 2026-07-09 (v6: sincronización completa); 2026-10-15 (v16: copia incluida)
- **Código:** `mobile/lib/contenido.ts` (`cargarStore`, `sincronizarContenido`), `mobile/assets/contenido.json`, `tools/datos/snapshot_contenido.ts`, `mobile/app/_layout.tsx`

## Contexto
Muchos miembros tienen pocos datos o mala señal. El texto de todo el año es pequeño (`contenido.json` pesa
~370 KB). En v1 había una caché por pantalla (`lib/cache.ts`) que solo guardaba lo ya visitado. Además, el plan
gratuito de Supabase pausa el proyecto tras 7 días sin actividad: una instalación nueva se quedaba sin contenido.

## Decisión
- **v6:** al arrancar con red, `sincronizarContenido()` baja completas las 4 tablas y las guarda en AsyncStorage
  (claves `contenido:*`). Las pantallas consultan por la fachada `lib/contenido.ts`.
- **v16:** la app trae una copia, `mobile/assets/contenido.json`, generada con `tools/datos/snapshot_contenido.ts`
  antes de cada build. `cargarStore()` usa lo sincronizado solo si `meta.sincronizado >= incluido.generado`;
  si no, la copia incluida. El almacén nunca queda vacío.

## Consecuencias
- (+) Funciona desde el primer arranque sin internet y con Supabase pausado; las pantallas abren al instante.
- (+) La copia incluida es también un **respaldo completo** de la base, notas incluidas.
- (−) Cada arranque con red vuelve a bajar todo el texto (riesgo R-12).
- (−) Hay que correr el snapshot antes de cada build (lo hace `tools/publicar.sh`).
- (−) Conviven dos capas de caché (`lib/cache.ts` y `lib/contenido.ts`) y varias pantallas aún llaman a Supabase directo (deuda).
- (−) Los datos de búsqueda (`lib/biblia.ts`) siguen otra regla: solo se descargan si no existen (riesgo R-13).

## Alternativas descartadas
- **Solo red:** no sirve sin señal.
- **Caché por pantalla (v1):** incompleta; lo no visitado no existe sin red.
- **SQLite local:** más complejo de lo necesario para este tamaño.
- **Sincronización incremental por fecha de cambio:** reduciría tráfico (R-12); se deja para cuando haga falta.
