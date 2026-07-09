import { useEffect } from 'react';
import { Stack } from 'expo-router';

import { sincronizarContenido } from '../lib/contenido';
import { descargarSemana, limpiarViejo } from '../lib/audio';
import { descargarDatos } from '../lib/biblia';
import { prepararAudio } from '../lib/voz';

export default function RootLayout() {
  useEffect(() => {
    prepararAudio();
    (async () => {
      // Al abrir la app (si hay red), baja TODO el texto del año para usarla
      // 100% sin internet después. Silencioso: si falla, se usa lo guardado.
      try {
        await sincronizarContenido();
      } catch {
        // sin red
      }
      // Con el contenido listo, baja los audios de la semana y borra lo viejo.
      descargarSemana().catch(() => {});
      limpiarViejo().catch(() => {});
      // Y los datos de búsqueda (Biblia completa + relacionados), una sola vez.
      descargarDatos().catch(() => {});
    })();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F1EFE8' },
        headerTintColor: '#042C53',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F1EFE8' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="memorizar" options={{ title: 'Memorizar', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="leccion" options={{ title: 'Lección', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="ajustes" options={{ title: 'Audio sin conexión', headerBackTitle: 'Atrás' }} />
      <Stack.Screen name="asistente" options={{ title: 'Modo por voz', headerBackTitle: 'Atrás' }} />
    </Stack>
  );
}
