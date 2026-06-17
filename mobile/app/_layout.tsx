import { Stack } from 'expo-router';

export default function RootLayout() {
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
    </Stack>
  );
}
