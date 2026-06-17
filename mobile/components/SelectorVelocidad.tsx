import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPCIONES = [
  { v: 0.8, l: 'Lenta' },
  { v: 1.0, l: 'Normal' },
  { v: 1.25, l: 'Rápida' },
];

export function SelectorVelocidad({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.label}>
        <Ionicons name="speedometer-outline" size={16} color="#5F5E5A" />
        <Text style={s.labelText}>Velocidad</Text>
      </View>
      <View style={s.chips}>
        {OPCIONES.map((o) => {
          const activo = Math.abs(value - o.v) < 0.001;
          return (
            <Pressable
              key={o.v}
              onPress={() => onChange(o.v)}
              style={[s.chip, activo && s.activo]}
            >
              <Text style={[s.txt, activo && s.txtActivo]}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelText: { fontSize: 13, color: '#5F5E5A', fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#B5D4F4', backgroundColor: '#FFFFFF' },
  activo: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  txt: { fontSize: 13, fontWeight: '600', color: '#185FA5' },
  txtActivo: { color: '#FFFFFF' },
});
