import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tamaño de letra del CONTENIDO (versículos, lecciones, resultados), elegido
// en Ajustes. Es ADICIONAL al tamaño de texto del sistema del teléfono, que la
// app ya respeta (allowFontScaling viene activado por defecto).

const CLAVE = 'escala_texto';

export const TAMANOS = [
  { v: 0.9, l: 'Chica' },
  { v: 1.0, l: 'Normal' },
  { v: 1.2, l: 'Grande' },
  { v: 1.4, l: 'Muy grande' },
] as const;

let escala = 1.0;
const oyentes = new Set<(v: number) => void>();

// Se llama una vez al arrancar la app (en _layout).
export async function cargarEscala(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE);
    const v = raw ? parseFloat(raw) : NaN;
    if (Number.isFinite(v) && v >= 0.8 && v <= 1.6 && v !== escala) {
      escala = v;
      for (const fn of oyentes) fn(escala);
    }
  } catch {
    // sin preferencia guardada: Normal
  }
}

export async function setEscala(v: number): Promise<void> {
  escala = v;
  for (const fn of oyentes) fn(v);
  try {
    await AsyncStorage.setItem(CLAVE, String(v));
  } catch {
    // no crítico
  }
}

// Hook: devuelve la escala actual y re-renderiza la pantalla cuando cambia.
export function useEscalaTexto(): number {
  const [v, setV] = useState(escala);
  useEffect(() => {
    oyentes.add(setV);
    setV(escala);
    return () => {
      oyentes.delete(setV);
    };
  }, []);
  return v;
}

// Deriva de un estilo su fontSize/lineHeight escalados, para usarse como
// override: <Text style={[styles.texto, conEscala(styles.texto, esc)]}>.
export function conEscala(estilo: StyleProp<TextStyle>, esc: number): TextStyle {
  if (esc === 1) return {};
  const plano = StyleSheet.flatten(estilo) ?? {};
  const out: TextStyle = {};
  if (typeof plano.fontSize === 'number') out.fontSize = Math.round(plano.fontSize * esc);
  if (typeof plano.lineHeight === 'number') out.lineHeight = Math.round(plano.lineHeight * esc);
  return out;
}
