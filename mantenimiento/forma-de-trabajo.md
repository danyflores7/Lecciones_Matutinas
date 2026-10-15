# Forma de trabajo (una sola persona)

Proceso ligero: Kanban personal + prácticas de XP que tienen sentido para un mantenedor solo.
Las solicitudes llegan de forma continua y con prioridades que cambian (soporte y mantenimiento): por eso Kanban
y no sprints.

## Tablero Kanban personal

Un tablero en GitHub Projects (gratis, junto al código) o en papel. Cada tarjeta: qué, por qué, severidad y frecuencia (si es un reporte).

| Por hacer | Haciendo (**WIP 2**, ideal 1) | Probando en teléfono (**WIP 2**) | Publicado |
|---|---|---|---|
| Ordenado por prioridad (arriba lo primero) | Solo se empieza otra si esta columna tiene lugar | APK release en un teléfono real; aquí se aplica la Definición de Terminado | Con su versión: "v16" |

- El **límite WIP** existe para terminar antes de empezar: con poco tiempo (estudio para el EGEL), dos cosas a medias valen menos que una terminada.
- Si "Probando" está lleno, no se programa: se prueba o se publica.
- Mide de vez en cuando el **tiempo de ciclo** (de "Haciendo" a "Publicado"). Si crece, las tarjetas son demasiado grandes: pártelas.

## Definición de Terminado

Una tarjeta pasa a "Publicado" solo si cumple **todo** lo que le aplique:

1. `cd mobile && npx tsc --noEmit` sin errores.
2. `npm test` en verde (73 pruebas en `mobile/tests/`, `node:test` + `tsx`). Si cambiaste comportamiento, hay una prueba nueva con el ID del requisito en el nombre (`RF-xx · …`).
3. `npm run verificar-version` dice "OK" y `npm run complejidad` no muestra funciones nuevas con CC > 15.
4. La integración continua (`.github/workflows/calidad.yml`) en verde después del push.
5. Si cambió texto hablado (`lib/segmentos.ts`, `lib/frases.ts`) o el contenido: audio generado y publicado en el branch `audio` ([Tarea 1](README.md#tarea-1-agregar-o-corregir-notas-de-la-matutina)).
6. Si cambió el contenido: `tools/datos/snapshot_contenido.ts` corrido y `npm test` en verde después del snapshot.
7. **Probado en un teléfono real** con el APK release: con internet, en modo avión y, si tocaste pantallas, con TalkBack; si tocaste la voz, el modo por voz en un Pixel y en otra marca.
8. Notas de versión escritas en `CHANGELOG.md` y en "Novedades" de Play Console (lenguaje de usuario, sin términos técnicos).

## Checklist de publicación

1. Tablero: todo lo de esta versión cumple la Definición de Terminado.
2. `git status` limpio; `git check-ignore -v legal/autorizacion-iglesia.md` muestra la regla de `.gitignore`.
3. Supabase activo (README, Tarea 4, paso 2) y audio nuevo ya publicado.
4. `tools/publicar.sh <versión> --sin-build` (prueba en seco) y deshacer lo que indique.
5. `tools/publicar.sh <versión>` → `Matutinas-vN.aab` y `.apk` en la raíz (ver `tools/README-publicar.md`).
6. Instalar el `.apk` en un teléfono y repetir las pruebas manuales de [requisitos.md](requisitos.md#matriz-de-trazabilidad) de lo que cambió.
7. Subir el `.aab` a Play Console (primero a prueba interna con 2 o 3 miembros, luego a producción) con las "Novedades".
8. Commit con el mensaje `App vN (versionCode X, Y.Z.W): …` y push (los comandos los imprime el script).
9. Mover las tarjetas a "Publicado" y avisar en el grupo de la iglesia qué cambió.

## Comentarios de la iglesia

- **Un solo canal** (el grupo o un contacto) y pedir siempre los datos de soporte (README, Tarea 5).
- Cada reporte se vuelve tarjeta con **severidad** (escala de Nielsen) y **frecuencia**:

| Severidad | Significado | Ejemplo | Qué hacer |
|---|---|---|---|
| 4 Catástrofe | Impide usar la app | No abre; la matutina no aparece | Arreglar ya y publicar versión corregida |
| 3 Mayor | Una función importante falla | El modo por voz no escucha en cierto teléfono | Siguiente versión |
| 2 Menor | Molesta, pero hay forma de hacerlo | Una frase por voz no se entiende | Al corpus de pruebas; cuando toque |
| 1 Cosmético | Solo de apariencia | Un texto se ve cortado | Si sobra tiempo |
| 0 | No es un problema de usabilidad | Una petición fuera del alcance | Se explica y se cierra |

- **Frecuencia:** 1 = una persona, 2 = varias, 3 = casi todos. **Prioridad = severidad × frecuencia**; a igual prioridad, lo más barato primero.
- Las ideas nuevas (no fallas) se escriben como historia de usuario en [requisitos.md](requisitos.md) con el siguiente ID libre.
- **Validación** (¿hicimos lo correcto?) es con los miembros: una vez por semestre, ver a 2 o 3 personas usar la app sin ayudarles. **Verificación** (¿lo hicimos bien?) son las pruebas y la CI.

## Prácticas de XP

| Sí aplican | Cómo |
|---|---|
| Entregas pequeñas | Una versión por tema (v8 a v14 salieron el mismo día, cada una con un cambio claro) |
| Integración continua | `calidad.yml` corre tipos, pruebas, versión y complejidad en cada push a `main` |
| Pruebas primero (TDD) para la voz | Frase que falla en la vida real → al corpus (`mobile/tests/fixtures/corpus_voz.ts`) en rojo → ajustar `lib/comandos.ts` → verde |
| Refactorizar con pruebas | Solo código cubierto por pruebas; pasos pequeños con `npm test` entre cada uno |
| Diseño simple | Sin IA, sin servidor propio, sin base local (ADR 0001, 0002, 0005) |
| Ritmo sostenible | No publicar de madrugada ni con prisa; con poco tiempo, WIP 1 |

| No aplican | Sustituto |
|---|---|
| Programación en pareja | Revisión al día siguiente con ojos frescos, o revisión de código asistida (`/code-review`) |
| Cliente en sitio | 2 o 3 miembros probadores con teléfonos distintos |
| Propiedad colectiva del código | No hay equipo; este manual reduce el bus factor (riesgo R-07) |

## Deuda técnica principal

**`app/asistente.tsx`: 1,238 líneas y cohesión baja.** Mezcla cuatro responsabilidades: la interfaz (JSX y
estilos), el reconocimiento de voz (`OPCIONES_ESCUCHA`, eventos `start`/`end`/`error`/`result`, red de seguridad,
reintentos, foco de pantalla), el estado de la conversación (`ultimo`, `ultimaCita`, `ultimaLeccionFecha`,
`ultimaPregunta`, `gen`) y los manejadores de cada intención (`leerMatutina`, `hNotaMatutina`, `hBuscarVersiculo`…
y el `switch` de `ejecutar`, CC 29). Hay código repetido: la búsqueda "local y si no, Supabase" de la matutina
aparece 3 veces; `leerLeccion` y `leerLeccionDeFecha` hacen casi lo mismo. Solo el parser tiene pruebas; los
manejadores no.

Plan por pasos (cada paso: `npm test` en verde, probar el modo por voz en el teléfono, commit):

1. **Red de seguridad primero:** pruebas de lo que cada intención debe *decir* para un contenido fijo (usar `assets/contenido.json` como en `leccion_vigente.test.ts`).
2. **Extraer consultas** a un módulo puro (p. ej. `lib/consultas.ts`): `resolverLeccion`, `datosDeLeccion`, buscar matutina local → red. Sin React.
3. **Extraer respuestas:** una función por intención `(comando, contexto) → { estado, partes, resultados, contexto }` en un mapa `tipo → manejador` (Strategy). Ya sin React, se prueban todas.
4. **Extraer el reconocimiento** a un hook (`useEscucha`) con `OPCIONES_ESCUCHA` intacto (ADR 0004).
5. **Dejar `asistente.tsx` como vista** (meta: menos de 300 líneas) que une el hook y las respuestas.
6. Mover los anuncios "Matutina del D de M." y "Lección N. Título." a `lib/frases.ts` (ADR 0006).

Otras deudas, de menor a mayor esfuerzo: `similaresDePregunta()` en `lib/biblia.ts` no se usa; la fachada
`lib/contenido.ts` tiene fugas (pantallas que llaman a `lib/supabase.ts` y la caché vieja `lib/cache.ts`);
`mobile/android/` fuera de git (R-10); scripts `db/_build_*` con rutas temporales (R-11); datos de búsqueda que no
se actualizan (R-13).
