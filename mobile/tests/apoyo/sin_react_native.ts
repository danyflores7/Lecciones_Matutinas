// Permite importar en Node módulos de la app que, además de su lógica pura,
// importan dependencias de React Native (p. ej. lib/contenido.ts, que guarda
// el contenido con AsyncStorage). Reemplaza SOLO esas dependencias por objetos
// vacíos; la lógica que se prueba es la real, sin cambios.
// Debe importarse ANTES que el módulo de la app.
import Module from 'node:module';

const SUSTITUTOS: Record<string, unknown> = {
  '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
  'react-native-url-polyfill/auto': {},
  '@supabase/supabase-js': { createClient: () => ({}) },
};

// lib/supabase.ts avisa en consola si faltan estas variables; en las pruebas
// no se usa la red (createClient está sustituido), solo se evita el aviso.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'sin-red';

type Cargador =(pedido: string, ...resto: unknown[]) => unknown;
const M = Module as unknown as { _load: Cargador };
const original = M._load;

M._load = function (this: unknown, pedido: string, ...resto: unknown[]) {
  if (Object.prototype.hasOwnProperty.call(SUSTITUTOS, pedido)) return SUSTITUTOS[pedido];
  return original.call(this, pedido, ...resto);
};
