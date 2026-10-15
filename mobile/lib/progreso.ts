import AsyncStorage from '@react-native-async-storage/async-storage';

// Recuerda en qué pregunta se quedó cada lección (para "Continuar donde me
// quedé") y si ya se mostró la bienvenida. Solo en este teléfono.

export type Progreso = { pregunta: number; total: number; terminada: boolean };

const clave = (fechaLeccion: string) => `progreso:${fechaLeccion}`;

export async function getProgreso(fechaLeccion: string): Promise<Progreso | null> {
  try {
    const raw = await AsyncStorage.getItem(clave(fechaLeccion));
    return raw ? (JSON.parse(raw) as Progreso) : null;
  } catch {
    return null;
  }
}

export async function setProgreso(fechaLeccion: string, p: Progreso): Promise<void> {
  try {
    await AsyncStorage.setItem(clave(fechaLeccion), JSON.stringify(p));
  } catch {
    // no crítico
  }
}

const BIENVENIDA = 'bienvenida:vista';

export async function bienvenidaVista(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BIENVENIDA)) === '1';
  } catch {
    return true; // si no se puede leer, no insistir
  }
}

export async function marcarBienvenidaVista(): Promise<void> {
  try {
    await AsyncStorage.setItem(BIENVENIDA, '1');
  } catch {
    // no crítico
  }
}
