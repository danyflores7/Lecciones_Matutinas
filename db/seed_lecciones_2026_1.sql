-- ============================================================================
-- Lecciones de estudio — Junio 2026 (lecciones 23 a 26)
-- Fuente: fotos en Lecciones_Junio/ (6, 13, 20 y 27 de junio — sábados)
-- Las lecciones 23-25 son de la serie "La epístola a los Romanos".
--
-- NOTA: el texto bíblico (versículo central y citas) se cargará después en
-- RV1909, igual que con las matutinas. Aquí solo van las REFERENCIAS.
-- Las notas explicativas están condensadas; revisa si las quieres textuales.
-- Revisa los renglones marcados con  -- [REVISAR].
-- ============================================================================

create table if not exists lecciones (
  id                       bigint generated always as identity primary key,
  numero                   int   not null unique,
  fecha                    date  not null unique,
  serie                    text,
  titulo                   text  not null,
  lectura_biblica          text,
  versiculo_central_cita   text  not null,
  versiculo_central_texto  text,
  introduccion             text  not null,
  semestre                 text  not null default '2026-1'
);

create table if not exists lecciones_preguntas (
  id           bigint generated always as identity primary key,
  leccion_id   bigint not null references lecciones(id) on delete cascade,
  orden        int    not null,
  pregunta     text   not null,
  citas        text[] not null default '{}',
  nota         text,
  unique (leccion_id, orden)
);

alter table lecciones            enable row level security;
alter table lecciones_preguntas  enable row level security;

drop policy if exists "Lectura publica de lecciones" on lecciones;
create policy "Lectura publica de lecciones" on lecciones
  for select to anon, authenticated using (true);

drop policy if exists "Lectura publica de preguntas" on lecciones_preguntas;
create policy "Lectura publica de preguntas" on lecciones_preguntas
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
insert into lecciones (numero, fecha, serie, titulo, lectura_biblica, versiculo_central_cita, introduccion) values
(23, '2026-06-06', $$La epístola a los Romanos$$, $$La exhortación a los miembros de la iglesia$$, NULL, $$Romanos 12:4-5$$,
  $$El bienestar y progreso de todo el grupo de la Iglesia depende de un espíritu de amor, cooperación para los necesitados y estima mutua entre los miembros. Esta figura del cuerpo y sus miembros se explica más detalladamente en 1 Corintios 12:12-27.$$),
(24, '2026-06-13', $$La epístola a los Romanos$$, $$Amor y tolerancia en la vida del cristiano$$, NULL, $$Romanos 14:18$$,
  $$El bien del que habla Pablo es la libertad cristiana en las viandas. El Reino de los cielos no es asunto de "comida ni bebida", sino de estar acompañado del Espíritu Santo para vivir de acuerdo con el Evangelio de Cristo.$$),
(25, '2026-06-20', $$La epístola a los Romanos$$, $$La misericordia extendida a los gentiles$$, NULL, $$Romanos 15:11$$,
  $$El Apóstol nos dice que Cristo vino con un doble propósito: su misión para los judíos fue confirmar las promesas de Dios; y, en segundo lugar, exponer las misericordias de Dios hacia los gentiles, quitándoles su condenación.$$),
(26, '2026-06-27', NULL, $$¿Cuán cerca está el fin?$$, $$Mateo 13:34-43$$, $$Marcos 13:32$$,
  $$Algunas personas se ocupan de hablar del futuro, torciendo las profecías bíblicas a fin de adecuarlas a sus propias teorías. El tiempo exacto de la venida de Cristo es un misterio de Dios; sin embargo, las señales anunciadas son clara evidencia de que está cerca, por lo cual el verdadero cristiano debe estar en constante vigilancia y oración por el regreso del Señor.$$);

-- ---------------------------------------------------------------------------
insert into lecciones_preguntas (leccion_id, orden, pregunta, citas, nota)
select l.id, p.orden, p.pregunta, p.citas, p.nota
from (values
-- ===== Lección 23 (6 jun) =====
(23, 1, $q$¿Qué exhortación a la humildad nos hace el Apóstol?$q$, ARRAY['Romanos 12:3']::text[], NULL),
(23, 2, $q$¿Cómo se ilustra la graduación de dones y trabajos en la Iglesia?$q$, ARRAY['Romanos 12:3-5'], NULL),  -- [REVISAR] leído "12:3,5"; ¿quizá Romanos 12:3-8?
(23, 3, $q$¿Cuál debe ser la actitud del cristiano ante su don en relación con los dones de otros en la Iglesia?$q$, ARRAY['Romanos 12:6-8'], NULL),
(23, 4, $q$¿Cómo se manifiesta el amor fraternal?$q$, ARRAY['Romanos 12:9-10','Santiago 2:14-17'], $q$Haber seguido a Cristo nos obliga a amar a nuestros hermanos en la fe, no solo con palabras, sino con hechos.$q$),
(23, 5, $q$¿En qué formas puede un cristiano dar evidencia de su diligencia en el servicio de Dios?$q$, ARRAY['Romanos 12:11-12'], NULL),  -- [REVISAR] leído "Romanos 11:11,12"; por contexto es Romanos 12:11-12
(23, 6, $q$¿Cuál debe ser la actitud del cristiano hacia los necesitados y hacia los perseguidores?$q$, ARRAY['Romanos 12:13-14'], NULL),
(23, 7, $q$¿Qué características tendrán los sentimientos del cristiano hacia los demás?$q$, ARRAY['Romanos 12:15-16','Mateo 25:34-40'], $q$Los verdaderos cristianos deben tener corazones llenos de tierno afecto y sincero amor por sus hermanos necesitados.$q$),
(23, 8, $q$¿Cómo vivirá el cristiano ante todos los hombres?$q$, ARRAY['Romanos 12:17-18'], $q$En todos los detalles de la vida deben mantenerse los más estrictos principios de honestidad.$q$),
(23, 9, $q$¿Cuál debe ser la actitud del cristiano hacia sus enemigos?$q$, ARRAY['Romanos 12:19-21','Efesios 4:26-27'], NULL),
(23, 10, $q$¿A qué autoridades deben estar sujetos los cristianos?$q$, ARRAY['Romanos 13:1-2','Hechos 5:29'], $q$Es deber cristiano obedecer todas las demandas legales de un gobierno civil; cuando no son legales, hay que obedecer a Dios antes que a los hombres.$q$),
(23, 11, $q$¿Quién inviste de autoridad a los funcionarios civiles? ¿Para quiénes es un terror el magistrado?$q$, ARRAY['Romanos 13:3-4'], $q$En general no debe temerse a los gobernantes, excepto cuando se comete el mal. No todos pertenecen a esa clase, pues muchos han perseguido a los justos.$q$),
(23, 12, $q$¿Qué dos razones se presentan por las cuales el cristiano debe obedecer a las autoridades civiles?$q$, ARRAY['Romanos 13:5'], $q$El cristiano obedece la ley civil, legalmente administrada, por dos razones: a) por causa de la ira (la penalidad que el magistrado puede infligir como sentencia legítima); b) por causa de la propia conciencia ante Dios.$q$),
-- ===== Lección 24 (13 jun) =====
(24, 1, $q$¿Por qué debe pagar impuestos el cristiano? ¿Cuán abarcantes son sus deberes?$q$, ARRAY['Romanos 13:6-7'], $q$El cristiano debe pagar sus impuestos legales para contribuir al sostén de los servicios que el gobierno presta.$q$),
(24, 2, $q$¿Cuál es la única clase de deuda que debe tener el cristiano?$q$, ARRAY['Romanos 13:8'], $q$Cuando el hombre está vinculado por la fuerza del amor, es porque tiene la influencia de la Ley de Dios.$q$),
(24, 3, $q$¿En qué declaración se sintetiza la relación del hombre con su prójimo?$q$, ARRAY['Romanos 13:9-10'], $q$Esta obligación recae sobre todos: disminuir los males a sus semejantes.$q$),
(24, 4, $q$¿Qué razón da el Apóstol por la cual demanda el ejercicio del amor cristiano?$q$, ARRAY['Romanos 13:11-12'], $q$Cada generación debe vivir aguardando el advenimiento de Cristo, porque cada una se encuentra más cerca de ese gran suceso.$q$),
(24, 5, $q$¿Qué debe caracterizar el camino del cristiano? ¿A qué no debemos hacer caso?$q$, ARRAY['Romanos 13:13-14'], $q$Que toda alma escuche estas palabras y sepa que el Señor Jesús no acepta la mundanalidad.$q$),
(24, 6, $q$¿Qué virtud cristiana debe ejercerse en nuestro trato con los demás?$q$, ARRAY['Romanos 14:1-3'], $q$El débil, con ansiedad exagerada respecto a reglamentos pasados, causa a menudo dificultades en la Iglesia.$q$),
(24, 7, $q$¿Qué pregunta se hace concerniente al juzgar a otros?$q$, ARRAY['Romanos 14:4','Romanos 2:1','Romanos 2:3','1 Corintios 5:9-13'], $q$Nadie debe exponer las faltas de sus hermanos si él mismo está en las mismas circunstancias. Los verdaderos cristianos sí deben juzgar a quienes, llamándose hermanos, son mundanos.$q$),
(24, 8, $q$¿Cómo ilustra el apóstol Pablo la cuestión respecto a la convicción de otros?$q$, ARRAY['Romanos 14:5-6'], $q$Nadie debe observar un día basándose solo en la opinión de otros; cada persona debe actuar en plena certeza de su responsabilidad personal ante Dios.$q$),
(24, 9, $q$¿Cuánto de su vida debe vivir una persona como quien ha de dar cuenta ante Dios? ¿Qué derecho tenemos para juzgar a uno que pertenece a Cristo?$q$, ARRAY['Romanos 14:7-9','Hechos 20:28','1 Corintios 6:20'], NULL),
(24, 10, $q$La ternura, la mansedumbre y la persuasión pueden salvar al hermano que comete pecados de muerte.$q$, ARRAY['Romanos 14:10-13'], NULL),
(24, 11, $q$¿Cómo instruye el Apóstol la práctica de la tolerancia con los que principian el camino del Señor?$q$, ARRAY['Romanos 14:14-15'], NULL),
-- ===== Lección 25 (20 jun) =====
(25, 1, $q$¿Cuál fue el doble propósito de Cristo al venir a esta tierra?$q$, ARRAY['Romanos 15:8-12'], NULL),
(25, 2, $q$¿Qué triple bendición debe experimentar el cristiano en su actitud hacia el futuro?$q$, ARRAY['Romanos 15:13','Romanos 5:1-2'], $q$Creyendo. Pablo ora para que la fe de los creyentes les dé una vida llena de gozo, paz y esperanza, y como resultado la presencia del Espíritu Santo.$q$),
(25, 3, $q$¿De qué estaba convencido Pablo respecto a los miembros de la Iglesia de Roma y sobre qué bases se les dirige de forma tan directa y personal?$q$, ARRAY['Romanos 15:14-16'], NULL),
(25, 4, $q$¿Concerniente a qué cosas sentía Pablo que podía enorgullecerse legítimamente?$q$, ARRAY['Romanos 15:17-19','Romanos 3:27','Filipenses 4:13'], $q$Pablo no se gloría en sí mismo, sino en Cristo Jesús; reconoce que no tiene nada de qué jactarse, pero declara que como ministro del Evangelio hace todas las cosas a través de Él.$q$),
(25, 5, $q$¿Cómo mostró Pablo su espíritu de predicador del Evangelio?$q$, ARRAY['Romanos 15:20-21','2 Corintios 5:9','1 Tesalonicenses 4:11'], $q$"Me esforcé": luchar ansiosamente; la misma palabra se traduce como "procurar".$q$),
(25, 6, $q$En su celo de predicador, ¿a dónde planeaba ir Pablo?$q$, ARRAY['Romanos 15:22-24'], $q$Por estar tan activo abriendo nuevas regiones al Evangelio, Pablo había aplazado ir a Roma; consideraba terminado su trabajo en Asia Menor, Macedonia y Grecia, y ya estaba dispuesto a ir.$q$),
(25, 7, $q$¿Con qué propósito se disponía Pablo a visitar Jerusalén?$q$, ARRAY['Romanos 15:25-29','Hechos 24:17','1 Corintios 16:1','2 Corintios 9:1'], $q$Las iglesias gentiles de Macedonia y Acaya habían hecho con gran gozo una colecta para los creyentes judíos pobres de Jerusalén.$q$),
(25, 8, $q$¿Con qué ruego y bendición concluye Pablo este capítulo?$q$, ARRAY['Romanos 15:30-33','2 Corintios 1:11','Efesios 6:18-19','Colosenses 4:3','1 Tesalonicenses 5:25','2 Tesalonicenses 3:1'], $q$Pablo planeaba ir a Jerusalén y luego pasar por Roma camino a España. Pedía oraciones para librarse de sus enemigos y para que su dádiva fuese aceptada; aun siendo Apóstol, necesitaba las oraciones de los creyentes.$q$),
-- ===== Lección 26 (27 jun) =====
(26, 1, $q$¿Únicamente quién conoce el momento exacto de la venida del Señor?$q$, ARRAY['Marcos 13:32','Mateo 24:36'], NULL),
(26, 2, $q$¿Cómo pueden saber los cristianos que falta poco para el advenimiento de Cristo?$q$, ARRAY['Mateo 24:33'], NULL),
(26, 3, $q$¿Qué se les recomienda a los creyentes y por qué?$q$, ARRAY['Hebreos 10:35-37'], NULL),
(26, 4, $q$¿Qué orden se les da a los ángeles que retienen los cuatro vientos?$q$, ARRAY['Apocalipsis 7:1-3'], NULL),
(26, 5, $q$¿Qué parábola representa la experiencia de los creyentes mientras Cristo se demora?$q$, ARRAY['Mateo 25:1-13'], NULL),
(26, 6, $q$¿Qué efecto tiene sobre los incrédulos la aparente demora?$q$, ARRAY['2 Pedro 3:3-4'], NULL),
(26, 7, $q$¿Por qué se ordenó a los ángeles que continuasen reteniendo los cuatro vientos?$q$, ARRAY['Apocalipsis 7:3'], NULL),
(26, 8, $q$¿Qué gran obra debe aún hacer la Iglesia de Cristo?$q$, ARRAY['Mateo 24:14'], NULL),
(26, 9, $q$¿Cómo tiene que hacerse esta gran obra?$q$, ARRAY['Apocalipsis 22:17'], NULL),
(26, 10, $q$¿Qué consideración especial tiene Dios para con aquellos que no están preparados para su venida?$q$, ARRAY['2 Pedro 3:9'], NULL),
(26, 11, $q$¿Qué parábola amonesta contra el peligro de creer que la venida de Cristo está muy lejos de cumplirse?$q$, ARRAY['Mateo 24:48-51'], NULL),
(26, 12, $q$Cuando Cristo se presente en las nubes, ¿vendrá hasta la tierra?$q$, ARRAY['Juan 14:2-3','Mateo 24:31','Marcos 13:27','1 Tesalonicenses 4:17','2 Tesalonicenses 2:1','Filipenses 3:20'], NULL)
) as p(numero, orden, pregunta, citas, nota)
join lecciones l on l.numero = p.numero;
