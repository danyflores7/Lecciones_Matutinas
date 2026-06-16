import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Hora por defecto del recordatorio matutino (6:00 a.m. hora local del teléfono).
export const HORA_RECORDATORIO = { hour: 6, minute: 0 };

const CANAL_ANDROID = 'recordatorio-matutina';

// Muestra la notificación aunque la app esté en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Pide permiso de notificaciones (iOS) y crea el canal (Android). Devuelve true si quedó habilitado.
export async function pedirPermisoNotificaciones(): Promise<boolean> {
  const { status: actual } = await Notifications.getPermissionsAsync();
  let status = actual;

  if (actual !== 'granted') {
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = res.status;
  }

  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Recordatorio de matutina',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

// Programa una notificación diaria que se repite a la hora indicada.
export async function programarRecordatorioDiario(
  hour: number = HORA_RECORDATORIO.hour,
  minute: number = HORA_RECORDATORIO.minute
): Promise<void> {
  // Limpiamos antes para no acumular duplicados.
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Versículo del día',
      body: 'Abre la app para repasar tu matutina de hoy.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: CANAL_ANDROID } : {}),
    },
  });
}

export async function cancelarRecordatorio(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
