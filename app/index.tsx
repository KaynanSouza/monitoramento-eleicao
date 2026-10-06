import { StyleSheet, Text, View } from 'react-native';

// Placeholder da fase 1. A tela de apuração entra na fase 4.
export default function Apuracao() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apuração 2026</Text>
      <Text>Fonte: TSE (divulgação oficial)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
});
