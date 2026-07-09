import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <View style={styles.raiz}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#185FA5',
          tabBarInactiveTintColor: '#888780',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E3DB' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="estudio"
          options={{
            title: 'Estudio',
            tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Calendario',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
          }}
        />
      </Tabs>

      {/* Botón flotante del Modo por voz: accesible desde cualquier pestaña. */}
      <Pressable
        onPress={() => router.push('/asistente')}
        accessibilityRole="button"
        accessibilityLabel="Abrir el modo por voz"
        accessibilityHint="Habla para navegar y escuchar el contenido"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="mic" size={30} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: '#185FA5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },
});
