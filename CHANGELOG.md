# Historial de versiones: Lecciones y Matutinas

Formato: **App vN · versionCode · versionName · fecha**. El archivo publicado se llama `Matutinas-vN.aab`.
Desde v6, **versionCode = N − 1** (v4 nunca existió). Reconstruido de `git log` y de los `.aab` de la raíz;
desde v16, cada versión se anota aquí al publicarla (ver `mantenimiento/forma-de-trabajo.md`).

## Escritorio 1.13.1 · programa para Mac y Windows · 23-oct-2026
Carpeta `desktop/` (Electron). Mismo código de la app; trae la voz de Jorge, la Biblia y el texto del año, sin internet.
Modo por voz escribiendo, Copiar en lugar de Compartir. Instaladores compilados y probados (34 comprobaciones) en
máquinas reales de GitHub (Windows y Mac). Ver `desktop/LEEME.md`.

## v17 · versionCode 16 · 1.13.1 · 21-oct-2026
Mide cuánto tarda en oírse la voz (Ajustes → Acerca de la app → "Arranque de la voz") y puede traer los 2,695 audios dentro
de la app (`Matutinas-v17-completa.apk`, solo para pruebas por APK: 208 MB).

## v16 · versionCode 15 · 1.13.0 · en curso
Commits `42fb504`, `55e8b51`, `a0efc87`, `2f468a0`, `0e0db8e`, `e4e9dd5` (15-oct-2026). Correcciones de la evaluación de usabilidad.
- **Voz:** intérprete reescrito (continúa, repite, para; ordinales; "salmo"; sinónimos; "pasado mañana", "la del 20 de octubre"; rechazo de peticiones ajenas). Corpus 175/175 y 30/30 frases nuevas.
- **Notas de la matutina** (columna `nota`): se muestran, se leen al final de la matutina y por voz ("la nota de la matutina de hoy").
- **Contenido incluido en la app** (`assets/contenido.json`): funciona sin internet desde el primer arranque aunque Supabase esté pausado; tarea de GitHub que mantiene Supabase activo.
- Pantallas nuevas: Matutina por día (desde Calendario), Estudiar pregunta por pregunta ("Pregunta N de M", continuar donde me quedé), Buscar con texto, Bienvenida.
- Inicio: Escuchar como acción principal, lección de la semana, recordatorio que se activa al elegir la hora, un solo aviso sin conexión con Reintentar.
- Ajustes: confirmar antes de borrar, cancelar descarga, aviso de datos móviles, ayuda y **"Acerca de la app"** con datos para soporte y botón para enviarlos.
- Accesibilidad: etiquetas y roles para TalkBack, contraste, objetivos de 48 dp, letra sin cursiva en pasajes, Memorizar usable con lector de pantalla.
- Modo por voz: errores del micrófono en español, explicación del permiso, sugerencias según contexto, "Preparando audio…".
- Mantenimiento: frases fijas compartidas con el generador (`lib/frases.ts`); el generador ya no deja mp3 vacíos; `tools/publicar.sh`; 73 pruebas automáticas, complejidad ciclomática, verificación de versión e integración continua (`calidad.yml`).

## v15 · versionCode 14 · 1.12.0 · 2026-10-14
`3542be5`. Tamaño de letra ajustable en Ajustes (Chica, Normal, Grande, Muy grande) para versículos, lecciones y asistente. "Recordatorio de matutina" en lugar de "recordatorio diario".

## v14 · versionCode 13 · 1.11.0 · 2026-07-09
`beb2bad`. Tema de la matutina por voz (con clips de la voz Jorge). Notas de las lecciones por voz: todas, o las de una pregunta.

## v13 · versionCode 12 · 1.10.0 · 2026-07-09
`57fea8c`. Por voz: solo el versículo central, solo el título, lecciones parecidas. Las citas sueltas se leen de toda la Biblia, con aviso si el versículo no existe.

## v12 · versionCode 11 · 1.9.0 · 2026-07-09
`b0a967a`. La lección vigente es la del **próximo sábado** (la que se estudia esa semana), en la descarga semanal de audio, "la lección de hoy" y similares (ADR 0007).

## v11 · versionCode 10 · 1.8.0 · 2026-07-09
`2555329`. Preguntas concretas por voz ("pregunta N de la lección M", con siguiente y anterior). Versículos relacionados anclados al versículo central o a las citas de una pregunta.

## v10 · versionCode 9 · 1.7.0 · 2026-07-09
`2149708`. Arreglo para Pixel: sin extras de silencio en el reconocedor (bloqueaban el resultado final). Red de seguridad: usa la transcripción parcial si la sesión termina sin resultado (ADR 0004).

## v9 · versionCode 8 · 1.6.0 · 2026-07-09
`7c87055`. Modo conversación manos libres (vuelve a escuchar con la pantalla enfocada); lee todos los resultados; citas habladas sin formato de hora; "primero" y "treinta y uno" en fechas; escuchar matutinas desde el Calendario; dictado con silencio de 2.5 s (retirado en v10).

## v8 · versionCode 7 · 1.5.0 · 2026-07-09
`12b2b4a`. Voz de Jorge al momento en toda la app (descarga atómica bajo demanda, caché negativa, vigilante); lección de hoy por voz; citas dictadas robustas (pegadas, con comas o en palabras); micrófono flotante en todas las pestañas; guarda de generación en el asistente.

## v7 · versionCode 6 · 1.4.0 · 2026-07-09
`56c9bf9`. Búsquedas por voz sin IA: Biblia RV1909 completa sin conexión, búsqueda por fragmento, dónde se cita, versículos relacionados (openbible.info, CC-BY) y preguntas similares precalculadas.

## v6 · versionCode 5 · 1.3.0 · 2026-07-09
`5ffcef6`. Todo el texto sin conexión (sincronización completa, ADR 0002); voz neural Jorge sin conexión (audio semanal y descarga en segundo plano, ADR 0003); **Modo por voz** accesible (ADR 0001).

## v5 · versionCode 4 · 1.2.0 · 2026-07-08
Compilación sin commit propio en `main` (solo existe `Matutinas-v5.aab`); su código llegó a `main` con v6. Ese día se publicó en el branch `audio` la narración con la voz `es-MX-JorgeNeural` (2,205 clips, `fab3236`).

## v4
No existe: no hay compilación ni commit con ese número.

## v3 · versionCode 3 · 1.1.0 · 2026-07-01
`5b1260c`. Año completo: matutinas del segundo semestre (184 días, RV1909); 26 lecciones de Escuela Sabática (julio a diciembre); Calendario y Estudio agrupados por mes (acordeón) y por tema.

## v2 · versionCode 2 · 1.0.0 · 2026-06-23
`21aba4e`. Capturas de Play Store (1080×1920) y ficha actualizada; encabezado de Inicio "Lecciones y Matutinas".

## v1 · versionCode 1 · 1.0.0 · 2026-06-22
Del 16 al 22 de junio (`40a302f` a `52b3e03`). Primera versión en Play Store:
- Versículo del día (Supabase + RV1909, primer semestre), Calendario, Memorizar, recordatorio con hora, compartir como imagen, racha.
- Escuchar con la voz del sistema: versículo, lección completa o por pregunta, citas como capítulo y versículo, "Nota", velocidad, pausar y continuar.
- Lecciones de Escuela Sabática con citas tocables (transcripción literal del cuaderno).
- Caché sin conexión de lo visitado; logo, ícono y pantalla de inicio; nombre "Lecciones y Matutinas".
- Política de privacidad y términos (GitHub Pages en `docs/`).
