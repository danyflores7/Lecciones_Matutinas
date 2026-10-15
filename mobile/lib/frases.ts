// Frases FIJAS que dice el Modo por voz. Viven aquí (TS puro) para que la app
// y el generador de audio (tools/gen-audio) usen EXACTAMENTE el mismo texto:
// el audio pre-grabado se busca por el hash del texto hablado.

export const F = {
  ayuda:
    'Puedes decir: la matutina de hoy. La nota de la matutina. Lección 3. ' +
    'La pregunta 2 de la lección 3. El versículo central de la lección 2. ' +
    'El título de la lección 3. El tema de la matutina de hoy. Las notas de la lección 2. ' +
    'Qué lección se parece a la lección 2. ' +
    'Busca el versículo que dice, de tal manera amó Dios al mundo. Dónde se cita Juan 3 16. ' +
    'Versículos relacionados con el versículo central de la lección 2. Preguntas similares. ' +
    'Y para controlar la lectura: siguiente, anterior, pausa, continúa, repite o detente.',
  bienvenida: 'Te escucho. Di lo que quieres escuchar, o di ayuda.',
  noEntendi: 'No te entendí. Di ayuda para escuchar los comandos.',
  primeroPide: 'Primero pide una matutina o una lección.',
  primeraPregunta: 'Es la primera pregunta.',
  primeraLeccion: 'Es la primera lección.',
  noMasResultados: 'No hay más resultados.',
  primerResultado: 'Es el primer resultado.',
  revisaCita: 'Revisa el capítulo y el versículo.',
  diVersiculo: 'Dime también el número del versículo. Por ejemplo: Salmos 23 1.',
  sinLeccion: 'No pude cargar la lección. Conéctate a internet una vez.',
  sinDatos:
    'Los datos de búsqueda aún no se descargan. Conéctate a internet una vez y vuelve a intentar.',
  sinLeccionSemana: 'No encontré la lección de esta semana.',
  diCita: 'Dime qué cita busco. Por ejemplo: dónde se cita Juan 3 16.',
  diVersiculoRel: 'Dime de qué versículo. Por ejemplo: versículos relacionados a Juan 3 16.',
  abrePrimero: 'Primero abre una lección, y luego te busco preguntas similares.',
  sinNotaMatutina: 'Esa matutina no tiene nota.',
  abriendo: {
    inicio: 'Abriendo Inicio.',
    calendario: 'Abriendo Calendario.',
    estudio: 'Abriendo Estudio.',
    buscar: 'Abriendo Buscar.',
  },
} as const;

// Todas las frases de arriba, para que el generador las grabe.
export function frasesFijas(): string[] {
  const out: string[] = [];
  const visitar = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(visitar);
  };
  visitar(F);
  return out;
}
