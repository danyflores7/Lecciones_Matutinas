-- Nota del cuaderno para cada día de matutina (puede faltar). Aplicada en
-- Supabase el 15-oct-2026. La app la muestra en la tarjeta de la matutina y la
-- lee después del versículo ("Nota. …"); también por voz: "la nota de la matutina".
alter table public.versiculos_dia add column if not exists nota text;
comment on column public.versiculos_dia.nota is 'Nota del cuaderno de matutinas para ese día (opcional).';
