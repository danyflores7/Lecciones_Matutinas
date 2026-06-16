# Matutinas — app de la iglesia (MVP)

App móvil (Expo / React Native) que muestra el **versículo del día** (Reina-Valera 1909)
del plan de matutinas del primer semestre 2026, con un **recordatorio diario** opcional.

## Arrancar

```bash
cd mobile
npm install          # si es un clon nuevo
npx expo start
```

Luego:
- Teléfono real: instala **Expo Go** y escanea el QR (recomendado para probar el recordatorio).
- Simulador: presiona `i` (iOS) o `a` (Android).

## Configuración

Las credenciales están en `mobile/.env` (cópialo de `.env.example` en un clon nuevo).
Son claves **públicas** (publishable/anon): la base está protegida con RLS (solo lectura
para `anon`), así que es seguro incluirlas en el cliente.

## Cómo funciona

- `lib/supabase.ts` — cliente de Supabase. Lee de la tabla `versiculos_dia`
  (`select ... where fecha = hoy`).
- `lib/notifications.ts` — recordatorio diario con `expo-notifications`
  (notificación local repetida a las 6:00 a.m.).
- `App.tsx` — pantalla principal: fecha, tema de la semana, cita + texto, y el switch
  del recordatorio (se guarda con AsyncStorage).

## Datos

El plan de 181 días vive en Supabase (proyecto `app-iglesia`). El seed reproducible
está en `../db/seed_versiculos_2026_1.sql` y se genera con `../db/_build_texts.py`.

## Nota sobre el "despertador"

iOS no permite que apps de terceros creen alarmas del reloj del sistema. El recordatorio
es una **notificación local** programada (sí suena/vibra a la hora fijada). Integración
más profunda con el reloj solo es posible en Android (pendiente para una fase posterior).
