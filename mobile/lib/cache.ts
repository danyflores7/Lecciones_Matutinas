import AsyncStorage from '@react-native-async-storage/async-storage';

// Caché simple en disco para que las pantallas abran al instante y funcionen
// sin internet (se muestra lo guardado y, si hay red, se refresca en segundo plano).

export async function leerCache<T>(clave: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem('cache:' + clave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function guardarCache(clave: string, valor: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem('cache:' + clave, JSON.stringify(valor));
  } catch {
    // si falla el guardado de caché, no es crítico
  }
}
