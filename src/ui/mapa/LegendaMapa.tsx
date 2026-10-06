import { StyleSheet, Text, View } from 'react-native';
import { nomeProprio } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import { corDegrau, type ResumoArea } from '@/mapa/dados';
import { useTema } from '../tema';

const FAIXAS = ['< 5', '5–10', '10–20', '20–35', '≥ 35'] as const;

/** Legenda: quem lidera (com texto, não só cor) e a escala de intensidade pela margem. */
export function LegendaMapa({ lideres }: { lideres: ResumoArea['lider'][] }) {
  const t = useTema();
  if (lideres.length === 0) return null;
  const exemplo = lideres[0]!.partido;
  return (
    <View style={styles.legenda}>
      <View style={styles.linha}>
        {lideres.slice(0, 6).map((l) => (
          <View key={l.sqcand} style={styles.item}>
            <View style={[styles.cor, { backgroundColor: corPartido(l.partido) }]} />
            <Text style={[styles.texto, { color: t.texto }]}>
              {nomeProprio(l.nomeUrna)} ({l.sigla})
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.linha} accessible accessibilityLabel="Cores mais escuras indicam maior margem de vitória sobre o segundo colocado">
        <Text style={[styles.texto, { color: t.textoSecundario }]}>Margem (p.p.):</Text>
        {FAIXAS.map((f, i) => (
          <View key={f} style={styles.item}>
            <View style={[styles.cor, { backgroundColor: corDegrau(exemplo, i as 0 | 1 | 2 | 3 | 4, t.fundo) }]} />
            <Text style={[styles.texto, { color: t.textoSecundario }]}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legenda: { gap: 8 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cor: { width: 12, height: 12, borderRadius: 2 },
  texto: { fontSize: 12 },
});
