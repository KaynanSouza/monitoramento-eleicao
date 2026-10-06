import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTema } from './tema';

export function SeletorTurno({ turno, aoEscolher }: { turno: 1 | 2; aoEscolher: (t: 1 | 2) => void }) {
  const t = useTema();
  return (
    <View style={[styles.grupo, { backgroundColor: t.superficie, borderColor: t.borda }]} accessibilityRole="radiogroup">
      {([1, 2] as const).map((n) => {
        const sel = n === turno;
        return (
          <Pressable
            key={n}
            onPress={() => aoEscolher(n)}
            accessibilityRole="radio"
            aria-checked={sel}
            accessibilityLabel={`${n}º turno`}
            style={[styles.opcao, sel && { backgroundColor: t.fundo, borderColor: t.borda }]}
          >
            <Text style={[styles.texto, { color: sel ? t.texto : t.textoSecundario }, sel && styles.sel]}>{n}º turno</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 3, alignSelf: 'flex-start' },
  opcao: {
    paddingHorizontal: 14,
    minHeight: 40, // + 3 px de borda do grupo: alvo de toque ≥ 44 px
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  texto: { fontSize: 14 },
  sel: { fontWeight: '800' },
});
