# ADR 0005. Supabase en plan gratuito, con tarea anti-pausa

- **Estado:** aceptada
- **Fecha:** 2026-06-16 (MVP, `40a302f`); 2026-10-15 (tarea anti-pausa, v16)
- **Código:** `mobile/lib/supabase.ts`, `mobile/.env` (no se lee aquí; ver `.env.example`), `.github/workflows/mantener-supabase.yml`, `db/*.sql`

## Contexto
Costo $0. El contenido es de solo lectura y pequeño, y el mantenedor necesita editarlo fácil (notas, correcciones)
sin programar un panel. El plan gratuito pausa el proyecto tras 7 días sin actividad.

## Decisión
- Supabase gratuito con 4 tablas (`versiculos_dia`, `lecciones`, `lecciones_preguntas`, `citas_texto`) y RLS de
  **solo lectura** para `anon`. La llave pública va en la app (`EXPO_PUBLIC_SUPABASE_*`). Se edita desde el panel.
- `.github/workflows/mantener-supabase.yml` consulta `versiculos_dia?select=fecha&limit=1` los **lunes y jueves**
  a las 14:17 UTC (08:17 del centro de México) y falla si la respuesta no es 200. Tiene `workflow_dispatch` para correrla a mano.
- La copia incluida (ADR 0002) cubre el caso en que, aun así, se pause.

## Consecuencias
- (+) $0, panel de edición gratis y API REST sin servidor propio.
- (−) Dependemos de la política del plan gratuito (riesgo R-02).
- (−) GitHub desactiva las tareas programadas de un repo público tras 60 días sin actividad: sin commits, la tarea anti-pausa también se apaga.
- (−) El esquema real no está completo en `db/`: falta la columna `versiculos_dia.nota`, la política RLS de `versiculos_dia`, y `lecciones.numero` ya no es único aunque `seed_lecciones_2026_1.sql` lo declare `unique` (riesgo R-11).
- (−) La llave anónima está en el repo público. Es aceptable porque solo lee; **nunca** usar la `service_role` en la app ni en el repo.

## Alternativas descartadas
- **JSON estático en el branch `audio` vía jsDelivr:** también $0 y sin pausas, pero sin panel de edición. Es el **plan B** si el plan gratuito cambia.
- **Firebase:** otra consola, reglas y cuotas; no ofrecía ventaja.
- **Servidor propio:** costo y mantenimiento.
