import AsyncStorage from '@react-native-async-storage/async-storage';
import { fechaHoyISO, fechaRelativaISO } from './fechas';

const K_RECORDATORIO = 'recordatorio_activo';
const K_HORA = 'recordatorio_hora'; // 'H:MM'
const K_RACHA = 'racha'; // JSON { ultima: 'YYYY-MM-DD', dias: number }
const K_VELOCIDAD = 'velocidad_voz'; // número (1.0 = normal)

export async function getVelocidad(): Promise<number> {
  const raw = await AsyncStorage.getItem(K_VELOCIDAD);
  const v = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(v) ? v : 1.0;
}

export async function setVelocidad(v: number): Promise<void> {
  await AsyncStorage.setItem(K_VELOCIDAD, String(v));
}

export type Hora = { hour: number; minute: number };

export async function getRecordatorioActivo(): Promise<boolean> {
  return (await AsyncStorage.getItem(K_RECORDATORIO)) === '1';
}

export async function setRecordatorioActivo(v: boolean): Promise<void> {
  await AsyncStorage.setItem(K_RECORDATORIO, v ? '1' : '0');
}

export async function getHoraRecordatorio(): Promise<Hora> {
  const raw = await AsyncStorage.getItem(K_HORA);
  if (raw && /^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':').map(Number);
    return { hour: h, minute: m };
  }
  return { hour: 6, minute: 0 };
}

export async function setHoraRecordatorio({ hour, minute }: Hora): Promise<void> {
  await AsyncStorage.setItem(K_HORA, `${hour}:${String(minute).padStart(2, '0')}`);
}

// Registra que hoy se repasó y devuelve la racha de días consecutivos.
export async function registrarVisitaYRacha(): Promise<number> {
  const hoy = fechaHoyISO();
  const ayer = fechaRelativaISO(-1);

  let estado: { ultima: string; dias: number } = { ultima: '', dias: 0 };
  const raw = await AsyncStorage.getItem(K_RACHA);
  if (raw) {
    try {
      estado = JSON.parse(raw);
    } catch {
      // estado corrupto: se reinicia abajo
    }
  }

  if (estado.ultima === hoy) return estado.dias; // ya contado hoy

  estado = estado.ultima === ayer
    ? { ultima: hoy, dias: estado.dias + 1 }
    : { ultima: hoy, dias: 1 };

  await AsyncStorage.setItem(K_RACHA, JSON.stringify(estado));
  return estado.dias;
}
