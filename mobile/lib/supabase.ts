import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  // Falla temprano y claro si falta el .env
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y reinicia el bundler.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type VersiculoDia = {
  id: number;
  fecha: string; // 'YYYY-MM-DD'
  dia_semana: string;
  tema: string;
  cita: string;
  libro: string;
  capitulo: number;
  versiculo_inicio: number;
  versiculo_fin: number | null;
  texto: string | null;
  semestre: string;
};

export async function getVersiculoPorFecha(fecha: string): Promise<VersiculoDia | null> {
  const { data, error } = await supabase
    .from('versiculos_dia')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle();
  if (error) throw error;
  return (data as VersiculoDia) ?? null;
}

export async function getTodosLosVersiculos(): Promise<VersiculoDia[]> {
  const { data, error } = await supabase
    .from('versiculos_dia')
    .select('*')
    .order('fecha', { ascending: true });
  if (error) throw error;
  return (data as VersiculoDia[]) ?? [];
}
