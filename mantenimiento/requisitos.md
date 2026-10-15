# Requisitos

Historias de usuario (tarjeta "Como… quiero… para…") con criterios de aceptación en Gherkin
(Dado… cuando… entonces…). Los IDs son **fijos**: las pruebas automáticas de `mobile/tests/` los llevan en su
nombre (p. ej. `test('RF-06 · interpreta "la matutina de hoy"')`). No los renumeres; si un requisito se
retira, márcalo "retirado" y no reutilices su ID.

Actor principal: **miembro** de la iglesia (muchos son mayores; algunos con poca vista o poca experiencia con el teléfono).

## Requisitos funcionales

### RF-01 Matutina del día
Como miembro, quiero ver, escuchar, compartir y memorizar el versículo de la matutina de hoy, para hacer mi devocional aunque tenga poco tiempo.
- **Dado** que hoy es 15 de octubre de 2026, **cuando** abro la app, **entonces** Inicio muestra "Jueves 15 de octubre", el tema, la cita y el texto RV1909 de ese día.
- **Dado** que veo la matutina, **cuando** toco "Escuchar", **entonces** se lee la cita en forma hablada, el texto y la nota si existe, y el botón cambia a "Detener".
- **Dado** que veo la matutina, **cuando** toco "Compartir" o "Memorizar", **entonces** se comparte una imagen PNG de la tarjeta, o se abre Memorizar con palabras ocultas por nivel.

### RF-02 Calendario por día
Como miembro, quiero abrir la matutina de cualquier día desde un calendario agrupado por mes, para ponerme al día o adelantarme.
- **Dado** que estoy en Calendario, **cuando** toco un mes, **entonces** se despliegan sus días agrupados por tema.
- **Dado** que estoy en Calendario, **cuando** toco un día, **entonces** se abre la pantalla Matutina de esa fecha, con botones para el día anterior y el siguiente si existen.

### RF-03 Notas de la matutina
Como miembro, quiero ver y escuchar la nota del cuaderno de un día, para recordar la explicación que se dio.
- **Dado** que la matutina tiene `nota`, **cuando** la abro, **entonces** aparece el recuadro "Nota del día" bajo el versículo.
- **Dado** que la matutina tiene nota, **cuando** toco "Escuchar", **entonces** al final se lee "Nota. <texto>".
- **Dado** que estoy en el modo por voz, **cuando** digo "la nota de la matutina de ayer", **entonces** se lee esa nota, o "Esa matutina no tiene nota." si no hay.

### RF-04 Lecciones y lección vigente
Como miembro de Escuela Sabática, quiero encontrar la lección de esta semana y leer o escuchar cualquier lección, para prepararme antes del sábado.
- **Dado** que hoy es lunes 12 de octubre de 2026 y hay lecciones el 10 y el 17, **cuando** abro Estudio o digo "la lección de esta semana", **entonces** la vigente es la del sábado 17.
- **Dado** que ya pasó la última lección del plan, **cuando** pido la vigente, **entonces** obtengo la última.
- **Dado** que abro una lección, **cuando** toco "Escuchar lección", **entonces** se leen título, versículo central, introducción y cada pregunta con sus citas y nota, con pausa, continuar y velocidad.

### RF-05 Estudiar pregunta por pregunta
Como miembro, quiero estudiar una pregunta por pantalla y continuar donde me quedé, para avanzar en ratos cortos.
- **Dado** que abro "Estudiar", **cuando** avanzo, **entonces** veo "Pregunta N de M" con sus citas ya abiertas y la nota.
- **Dado** que me quedé en la pregunta 5 de 12, **cuando** vuelvo a Inicio, **entonces** aparece "Continuar en la pregunta 5 de 12".
- **Dado** que llego a la última pregunta, **cuando** termino, **entonces** la lección queda terminada e Inicio ofrece "Ya la terminaste. ¿Repasarla?".

### RF-06 Modo por voz (intenciones)
Como miembro con poca vista o poca práctica con el teléfono, quiero pedir por voz lo que quiero escuchar, para usar la app sin leer menús.
Intenciones (`Comando.tipo` en `lib/comandos.ts`): abrirMatutina, temaMatutina, notaMatutina, abrirLeccion,
abrirLeccionActual, abrirPregunta, versiculoCentral, tituloLeccion, notasLeccion, leccionesSimilares,
buscarVersiculo, dondeSeCita, versiculosRelacionados, preguntasSimilares, siguiente, anterior, leer, pausar,
detener, ir, ayuda, desconocido.
- **Dado** que abrí el modo por voz con permiso de micrófono, **cuando** digo "la pregunta 3 de la lección 2", **entonces** se interpreta `abrirPregunta` (lección 2, pregunta 3) y se lee.
- **Dado** que se está leyendo, **cuando** digo "pausa" y luego "continúa", **entonces** la lectura se detiene y sigue desde el mismo segmento.
- **Dado** que digo algo ajeno a la app ("pon música"), **entonces** responde "No te entendí. Di ayuda para escuchar los comandos." sin hacer nada más.

### RF-07 Búsqueda de citas y texto
Como miembro, quiero buscar un versículo por su cita o por las palabras que recuerdo, para encontrarlo aunque no sepa dónde está.
- **Dado** que la Biblia completa ya se descargó, **cuando** escribo o digo "Juan 3 16" (o el dictado pegado "juan 316"), **entonces** obtengo Juan 3:16 RV1909.
- **Dado** que busco "no temas" en la Biblia, **cuando** confirmo, **entonces** veo hasta 12 versículos ordenados por coincidencia (5 por voz).
- **Dado** que pido "Juan 3:99", **entonces** la app avisa que no existe y pide revisar el capítulo y el versículo.

### RF-08 Dónde se cita, relacionados y similares
Como miembro o maestro, quiero saber dónde más aparece un versículo y qué textos o preguntas se relacionan, para profundizar el estudio.
- **Dado** que busco "Juan 3:16", **entonces** se listan las preguntas, versículos centrales y matutinas que lo citan (comparando libro, capítulo y primer verso) y versículos relacionados (openbible.info, CC-BY).
- **Dado** que la última lección pedida por voz es la 2, **cuando** digo "preguntas similares", **entonces** escucho hasta 6 preguntas de otras lecciones.
- **Dado** que digo "qué lección se parece a la lección 2", **entonces** escucho hasta 3 lecciones parecidas.

### RF-09 Audio neural con respaldo TTS, descarga semanal y completa
Como miembro, quiero escuchar con una voz natural también sin internet, para no gastar datos ni depender de la señal.
- **Dado** que hay internet al abrir la app, **entonces** se descargan en segundo plano los audios de las 7 matutinas desde hoy y de la lección vigente, y se borran los de más de 14 días (salvo "descargar todo").
- **Dado** que un clip no está y no hay red (o tarda más de 3.5 s), **cuando** toca leerlo, **entonces** ese segmento se lee con la voz del sistema sin quedarse en silencio.
- **Dado** que en Ajustes elijo descargar todo con datos móviles, **entonces** primero se avisa del consumo de datos, y puedo cancelar y reanudar después.

### RF-10 Funcionamiento sin conexión
Como miembro en un lugar sin señal, quiero que todo el texto funcione sin internet desde el primer día, para no depender de la red.
- **Dado** que instalo la app y la abro sin internet (o con Supabase pausado), **entonces** Inicio, Calendario y Estudio muestran el contenido del año desde `assets/contenido.json`.
- **Dado** que ya abrí la app con internet, **cuando** la abro sin red, **entonces** usa la última sincronización si es más nueva que la copia incluida.

### RF-11 Recordatorio diario
Como miembro, quiero un aviso diario a la hora que elija, para no olvidar la matutina.
- **Dado** que elijo una hora en Inicio, **entonces** el recordatorio se activa en ese momento (pide permiso) y dice "Listo: te avisaré cada día a las 6:00 a. m.".
- **Dado** que niego el permiso de notificaciones, **entonces** se explica cómo activarlo en los ajustes del teléfono.
- **Dado** que lo desactivo, **entonces** se cancelan las notificaciones programadas.

### RF-12 Tamaño de letra
Como miembro con vista cansada, quiero agrandar el texto del contenido, para leer sin lentes.
- **Dado** que en Ajustes elijo "Muy grande", **cuando** abro una matutina, una lección o el modo por voz, **entonces** el texto del contenido se ve a 1.4× (además del tamaño del sistema) y la elección se recuerda al reiniciar.

### RF-13 Bienvenida y ayuda
Como miembro nuevo, quiero una explicación breve al abrir por primera vez y poder volver a verla, para entender qué hace la app.
- **Dado** que abro la app por primera vez, **entonces** se muestra la Bienvenida y después ya no aparece sola.
- **Dado** que estoy en Ajustes, **cuando** toco "Ayuda", **entonces** vuelvo a ver la Bienvenida.
- **Dado** que estoy en el modo por voz, **cuando** digo "ayuda", **entonces** escucho ejemplos de lo que puedo decir, y cada ejemplo funciona.

## Requisitos no funcionales (con criterio de ajuste)

| ID | ISO 25010 | Requisito | Criterio de ajuste (cómo se sabe que se cumple) |
|---|---|---|---|
| RNF-01 | Fiabilidad: disponibilidad | Disponibilidad sin conexión | 100 % del texto del año disponible sin red desde la primera apertura (en `42fb504`: 365 matutinas, 30 lecciones, 428 preguntas, 548 citas). La lectura nunca queda muda: respaldo TTS en ≤ 3.5 s (≤ 5 s si el mp3 falla) |
| RNF-02 | Usabilidad: accesibilidad | TalkBack, objetivos táctiles, contraste | Todo control con `accessibilityLabel` y `accessibilityRole`; objetivos ≥ 48 dp; contraste de texto ≥ 4.5:1; respeta la letra del sistema |
| RNF-03 | Usabilidad: operabilidad | Usabilidad de voz | ≥ 95 % de intención correcta en el corpus de enunciados (`mobile/tests/fixtures/corpus_voz.ts`) y en frases no vistas (`holdout_voz.ts`); en `42fb504`: 175/175 y 30/30 |
| RNF-04 | Mantenibilidad | Mantenible por una sola persona | `npx tsc --noEmit` y `npm test` en verde en CI en cada push; versión consistente (`npm run verificar-version`); ninguna función nueva con complejidad ciclomática > 15 (`npm run complejidad`; hoy `interpretar` 69, `citaHablada` 30, `Asistente › ejecutar` 29 son deuda conocida); cada tarea del [manual](README.md) se completa siguiéndolo, sin conocimiento previo |
| RNF-05 | (restricción de costo) | Costo $0 al mes | Supabase gratuito, jsDelivr, GitHub y GitHub Actions sin costo; el único pago fue el registro de Google Play (único) |
| RNF-06 | Seguridad: confidencialidad | Privacidad | Sin cuentas ni inicio de sesión; la app no graba ni guarda la voz (el reconocimiento es el servicio del teléfono); preferencias solo en el teléfono; el repo público no contiene datos personales (`legal/autorizacion-iglesia.md` fuera de git) |

## Matriz de trazabilidad

Hacia adelante: requisito → código → verificación. Las pruebas automáticas viven en `mobile/tests/`
(73 pruebas con `node:test` + `tsx`; `cd mobile && npm test`) y la integración continua las corre en cada push a
`main` (`.github/workflows/calidad.yml`: `tsc` de la app y de las pruebas, `npm test`, `npm run verificar-version`
y el reporte de `npm run complejidad`). Para correr solo un requisito:
`cd mobile && npx tsx --test --test-name-pattern="RF-06" tests/*.test.ts`.
Lo que no tiene prueba automática se verifica a mano en un teléfono real (última columna).

| Req. | Implementado en | Verificación automática | Prueba manual (teléfono) |
|---|---|---|---|
| RF-01 | `app/(tabs)/index.tsx`, `components/VistaMatutina.tsx`, `app/memorizar.tsx`, `lib/segmentos.ts`, `lib/almacen.ts` | `fechas.test.ts`, `segmentos.test.ts` | Abrir, Escuchar, Compartir, Memorizar |
| RF-02 | `app/(tabs)/calendario.tsx`, `app/matutina.tsx`, `lib/fechas.ts` | `fechas.test.ts` | Abrir un mes y un día; anterior/siguiente |
| RF-03 | `components/VistaMatutina.tsx`, `lib/segmentos.ts` (`segmentosMatutina`), `lib/comandos.ts`, `app/asistente.tsx` (`hNotaMatutina`) | `segmentos.test.ts`, `comandos.test.ts` | Día con nota: ver, escuchar, pedir por voz |
| RF-04 | `lib/contenido.ts` (`leccionVigente`, `getLeccionLocal`), `app/(tabs)/estudio.tsx`, `app/leccion.tsx` | `leccion_vigente.test.ts` | "Esta semana" en Estudio; Escuchar lección con pausa |
| RF-05 | `app/estudiar.tsx`, `lib/progreso.ts`, `app/(tabs)/index.tsx` | `segmentos.test.ts` (`segmentosDePregunta`) | Avanzar, salir, "Continuar en la pregunta N" |
| RF-06 | `lib/comandos.ts`, `app/asistente.tsx`, `lib/citas.ts` | `comandos.test.ts` | Frases de la ayuda en un Pixel y en otra marca |
| RF-07 | `app/(tabs)/buscar.tsx`, `lib/biblia.ts`, `lib/citas.ts`, `lib/contenido.ts` (`buscarTextoLocal`) | `citas.test.ts` | "Juan 3:16", "no temas", "Juan 3:99" |
| RF-08 | `lib/contenido.ts` (`dondeSeCita`), `lib/biblia.ts` (`versiculosRelacionados`, `similaresDeLeccion`, `leccionesSimilares`), `app/(tabs)/buscar.tsx`, `app/asistente.tsx` | `citas.test.ts` (`anclaDeCita`) | Buscar "Juan 3:16"; "preguntas similares" por voz |
| RF-09 | `lib/audio.ts`, `lib/voz.ts`, `lib/segmentos.ts`, `lib/frases.ts`, `app/ajustes.tsx`, `tools/gen-audio/generar.ts` | `segmentos.test.ts` (contrato), `frases.test.ts` | Modo avión con y sin audio descargado; descargar todo con datos |
| RF-10 | `lib/contenido.ts` (`cargarStore`), `assets/contenido.json`, `tools/datos/snapshot_contenido.ts`, `app/_layout.tsx` | `fechas.test.ts` (semana de descarga) | Instalar y abrir en modo avión |
| RF-11 | `lib/notifications.ts`, `lib/almacen.ts`, `app/(tabs)/index.tsx` | `fechas.test.ts` (`horaTexto`) | Elegir hora, esperar el aviso, desactivar |
| RF-12 | `lib/escala.ts`, `app/ajustes.tsx` | — | Cambiar a "Muy grande" y reiniciar |
| RF-13 | `app/bienvenida.tsx`, `lib/progreso.ts`, `app/ajustes.tsx`, `lib/frases.ts` (`F.ayuda`) | `frases.test.ts` | Instalación nueva; Ajustes → Ayuda; decir "ayuda" |
| RNF-01 | `lib/contenido.ts`, `lib/voz.ts` (`decir`, vigilante de 5 s), `lib/audio.ts` | — | Igual que RF-10 + leer con un clip faltante |
| RNF-02 | todas las pantallas (`accessibilityLabel`, `accessibilityRole`, `accessibilityLiveRegion`) | — | TalkBack + Accessibility Scanner de Google |
| RNF-03 | `lib/comandos.ts` | `comandos.test.ts` (corpus y holdout) | Frases reales de los miembros |
| RNF-04 | `mobile/tests/`, `.github/workflows/calidad.yml`, `tools/calidad/complejidad.ts`, `tools/calidad/verificar_version.ts` | CI en cada push (`calidad.yml`) | Seguir el manual cada 6 meses |
| RNF-05 | `.github/workflows/mantener-supabase.yml`, ADR 0005 | — | Revisar facturación y uso de Supabase cada mes |
| RNF-06 | `app/asistente.tsx` (texto del permiso), `.gitignore` | — | `git check-ignore -v legal/autorizacion-iglesia.md` |
