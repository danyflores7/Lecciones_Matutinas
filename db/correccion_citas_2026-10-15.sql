-- Corrección de citas capturadas con abreviaturas o con el libro equivocado
-- (encontradas por las pruebas automáticas el 15-oct-2026).
-- Con abreviatura la app no las reconoce ("dónde se cita", relacionados) y la
-- voz dice "Heb" en lugar de "Hebreos".
--   L2 P15  Heb. 4:14, 15  -> Hebreos 4:14, 15
--   L5 P5   Hech. 1:11     -> Hechos 1:11
--   L5 P5   Apoc. 1:7      -> Apocalipsis 1:7
--   L20 P15 Gén. 5:24      -> Génesis 5:24
--   L12 P7  Heb. 15:24     -> Hechos 15:24 (Hebreos solo tiene 13 capítulos; la
--           pregunta es sobre los maestros de Judea que exigían la ley = Hch 15:24)
-- Después: regenerar mobile/assets/contenido.json y el audio (tools/gen-audio).

begin;

update public.citas_texto set cita = 'Hebreos 4:14, 15' where cita = 'Heb. 4:14, 15';
update public.citas_texto set cita = 'Hechos 1:11' where cita = 'Hech. 1:11';
update public.citas_texto set cita = 'Apocalipsis 1:7' where cita = 'Apoc. 1:7';
update public.citas_texto set cita = 'Génesis 5:24' where cita = 'Gén. 5:24';
insert into public.citas_texto (cita, texto)
select 'Hechos 15:24',
       'Por cuanto hemos oído que algunos que han salido de nosotros, os han inquietado con palabras, trastornando vuestras almas, mandando circuncidaros y guardar la ley, á los cuales no mandamos;'
where not exists (select 1 from public.citas_texto where cita = 'Hechos 15:24');

update public.lecciones_preguntas set citas = array_replace(citas, 'Heb. 4:14, 15', 'Hebreos 4:14, 15') where 'Heb. 4:14, 15' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Hech. 1:11', 'Hechos 1:11') where 'Hech. 1:11' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Apoc. 1:7', 'Apocalipsis 1:7') where 'Apoc. 1:7' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Gén. 5:24', 'Génesis 5:24') where 'Gén. 5:24' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Heb. 15:24', 'Hechos 15:24') where 'Heb. 15:24' = any(citas);

commit;

-- Segunda tanda (detectada por mobile/tests/contenido_incluido.test.ts):
--   L3 P6 y L5 P2  Judas 14:15       -> Judas 1:14, 15 (Judas tiene 1 capítulo; el texto ya era 14-15)
--   L12 P6         Hebreos 15:1      -> Hechos 15:1 (el error de la circuncisión)
--   L11 P8         Éxodo 20:40       -> Éxodo 40:20 (los mandamientos puestos dentro del arca)
--   L6 P9          2 Corintios 5:24  -> 2 Corintios 5:2-4 ("sobrevestidos de aquella nuestra habitación celestial")
begin;
update public.citas_texto set cita = 'Judas 1:14, 15' where cita = 'Judas 14:15';
insert into public.citas_texto (cita, texto) select 'Hechos 15:1', $t$Entonces algunos que venían de Judea enseñaban á los hermanos: Que si no os circuncidáis conforme al rito de Moisés, no podéis ser salvos.$t$
  where not exists (select 1 from public.citas_texto where cita = 'Hechos 15:1');
insert into public.citas_texto (cita, texto) select 'Éxodo 40:20', $t$Y tomó y puso el testimonio dentro del arca, y colocó las varas en el arca, y encima la cubierta sobre el arca:$t$
  where not exists (select 1 from public.citas_texto where cita = 'Éxodo 40:20');
insert into public.citas_texto (cita, texto) select '2 Corintios 5:2-4', $t$2 Y por esto también gemimos, deseando ser sobrevestidos de aquella nuestra habitación celestial;  3 Puesto que en verdad habremos sido hallados vestidos, y no desnudos.  4 Porque asimismo los que estamos en este tabernáculo, gemimos agravados; porque no quisiéramos ser desnudados, sino sobrevestidos, para que lo mortal sea absorbido por la vida.$t$
  where not exists (select 1 from public.citas_texto where cita = '2 Corintios 5:2-4');
update public.lecciones_preguntas set citas = array_replace(citas, 'Judas 14:15', 'Judas 1:14, 15') where 'Judas 14:15' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Hebreos 15:1', 'Hechos 15:1') where 'Hebreos 15:1' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, 'Éxodo 20:40', 'Éxodo 40:20') where 'Éxodo 20:40' = any(citas);
update public.lecciones_preguntas set citas = array_replace(citas, '2 Corintios 5:24', '2 Corintios 5:2-4') where '2 Corintios 5:24' = any(citas);
commit;
