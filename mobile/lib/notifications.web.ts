// En escritorio no hay recordatorio por notificación (las notificaciones del
// sistema las maneja cada celular). Misma interfaz, sin efecto.
export const HORA_RECORDATORIO = { hour: 6, minute: 0 };
export const pedirPermisoNotificaciones = async (): Promise<boolean> => false;
export const programarRecordatorioDiario = async (_hour?: number, _minute?: number): Promise<void> => {};
export const cancelarRecordatorio = async (): Promise<void> => {};
