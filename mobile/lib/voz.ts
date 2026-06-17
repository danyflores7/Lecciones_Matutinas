// Convierte una cita a una forma hablada que el lector de voz no confunda con una hora,
// usando singular/plural y "al" (rango) o "y" (lista) según corresponda:
//   "Hechos 4:19"        -> "Hechos capítulo 4, versículo 19"
//   "Santiago 2:14-17"   -> "Santiago capítulo 2, versículos 14 al 17"
//   "Romanos 5:1, 2"     -> "Romanos capítulo 5, versículos 1 y 2"
//   "Romanos 12:3, 5"    -> "Romanos capítulo 12, versículos 3 y 5"
export function citaParaVoz(cita: string): string {
  return cita.replace(/(\d+):([\d,\-\s]+)/, (_m, cap: string, vspec: string) => {
    const spec = vspec.trim();

    const rango = spec.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rango) return `capítulo ${cap}, versículos ${rango[1]} al ${rango[2]}`;

    const lista = spec.split(',').map((s) => s.trim()).filter(Boolean);
    if (lista.length > 1) {
      const ultimo = lista.pop();
      return `capítulo ${cap}, versículos ${lista.join(', ')} y ${ultimo}`;
    }

    return `capítulo ${cap}, versículo ${spec}`;
  });
}
