// Convierte una cita a una forma que el lector de voz no confunda con una hora.
// "Hechos 4:19"        -> "Hechos capítulo 4, versículo 19"
// "1 Corintios 5:9-13" -> "1 Corintios capítulo 5, versículo 9 al 13"
// "Romanos 12:3, 5"    -> "Romanos capítulo 12, versículo 3, 5"
export function citaParaVoz(cita: string): string {
  return cita.replace(/(\d+):([\d,\-\s]+)/, (_m, cap: string, vers: string) => {
    const v = vers.trim().replace(/\s*-\s*/g, ' al ');
    return `capítulo ${cap}, versículo ${v}`;
  });
}
