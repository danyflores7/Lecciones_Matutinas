# ADR 0001. Intérprete de voz por reglas, sin IA

- **Estado:** aceptada
- **Fecha:** 2026-07-09 (v6, commit `5ffcef6`); ampliada en v7 a v16
- **Código:** `mobile/lib/comandos.ts` (`interpretar`), `mobile/lib/citas.ts` (`citaHablada`, `palabrasANumeros`)

## Contexto
El modo por voz es para miembros mayores o con poca vista. El dominio es pequeño y fijo: lecciones 1 a 26 por
semestre, matutinas por fecha, búsquedas sobre contenido conocido y unos pocos verbos (siguiente, pausa, repite…).
Requisitos: costo $0, funcionar con poca o ninguna red y no enviar lo que dice el usuario a terceros.

## Decisión
Un intérprete determinista. `interpretar(texto)` normaliza (sin acentos ni signos), convierte ordinales y números
en palabras a dígitos y aplica reglas en un **orden fijo**: ayuda → fuera de dominio → relacionados y búsquedas →
versículo central → notas → título o tema → pregunta N → "qué dice…" → "dónde se cita" → "busca…" → cita dicha →
lección → matutina o fecha → navegación → controles de lectura. Devuelve un `Comando` (la *intención* es `tipo`;
los *espacios* son sus datos). La ejecución vive aparte, en `ejecutar()` de `app/asistente.tsx`.

## Consecuencias
- (+) Sin red, sin modelo y sin costo; respuesta instantánea y predecible.
- (+) Se puede probar con un corpus de frases: 175/175 del corpus y 30/30 frases no vistas (`mobile/tests/comandos.test.ts`, pruebas RF-06 y RNF-03).
- (−) `interpretar` tiene complejidad ciclomática 69 (`npm run complejidad`): aceptable solo porque el corpus la cubre.
- (−) El orden de las reglas importa: arreglar una frase puede romper otra. Por eso existen las pruebas de regresión (RNF-03).
- (−) Cada forma nueva de pedir algo necesita una regla o un sinónimo; no entiende paráfrasis lejanas.
- **Regla de trabajo:** toda frase que falle en la vida real se agrega primero al corpus (prueba en rojo) y luego se ajusta la regla.

## Alternativas descartadas
- **LLM en la nube:** costo por uso, requiere red, envía la voz transcrita a un tercero, respuestas no deterministas.
- **Modelo NLU dentro del teléfono:** APK más grande, hay que entrenarlo y es difícil de depurar para una sola persona.
- **Dialogflow u otro servicio:** cuenta, cuotas y red.
