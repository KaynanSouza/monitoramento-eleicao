import { StyleSheet, Text, View } from 'react-native';
import { formatInteiro, nomeProprio } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import type { Candidato } from '@/tse/types';
import { Avatar } from './Avatar';
import { descreverSituacao, SeloPartido, SeloSituacao } from './Selos';
import { useTema } from './tema';

interface Props {
  candidatos: [Candidato, Candidato];
  foto: (sqcand: string) => string | null;
}

/**
 * 2º turno: os dois candidatos lado a lado, na ordem oficial de votos, e uma barra
 * dividida proporcional aos percentuais. Sem destaque além dos números.
 */
export function Disputa({ candidatos, foto }: Props) {
  const t = useTema();
  const [a, b] = candidatos;
  const total = a.pct + b.pct;
  const fracaoA = total > 0 ? a.pct / total : 0.5;

  return (
    <View style={styles.bloco}>
      <View style={styles.cartoes}>
        {[a, b].map((c) => (
          <Cartao key={c.sqcand} c={c} foto={foto(c.sqcand)} />
        ))}
      </View>
      <View
        style={[styles.barra, { backgroundColor: t.trilho }]}
        accessible
        accessibilityLabel={`${nomeProprio(a.nomeUrna)} ${a.pctTexto} por cento, ${nomeProprio(b.nomeUrna)} ${b.pctTexto} por cento`}
      >
        {total > 0 && (
          <>
            <View style={{ flex: fracaoA, backgroundColor: corPartido(a.partido.numero) }} />
            <View style={[styles.divisor, { backgroundColor: t.fundo }]} />
            <View style={{ flex: 1 - fracaoA, backgroundColor: corPartido(b.partido.numero) }} />
          </>
        )}
      </View>
      <View style={styles.marcas}>
        <Text style={[styles.marca, { color: t.textoSecundario }]}>{a.pctTexto}%</Text>
        <Text style={[styles.marca, { color: t.textoSecundario }]}>50%</Text>
        <Text style={[styles.marca, { color: t.textoSecundario }]}>{b.pctTexto}%</Text>
      </View>
    </View>
  );
}

function Cartao({ c, foto }: { c: Candidato; foto: string | null }) {
  const t = useTema();
  const cor = corPartido(c.partido.numero);
  return (
    <View
      style={[styles.cartao, { backgroundColor: t.superficie, borderTopColor: cor }]}
      accessible
      accessibilityLabel={`${nomeProprio(c.nomeUrna)}, número ${c.numero}, ${c.partido.sigla}, ${c.pctTexto} por cento, ${formatInteiro(c.votos)} votos${descreverSituacao(c.situacao)}`}
    >
      <Avatar nome={c.nomeUrna} cor={cor} foto={foto} tamanho={72} />
      <Text style={[styles.nome, { color: t.texto }]} numberOfLines={2}>
        {nomeProprio(c.nomeUrna)}
      </Text>
      <View style={styles.linha}>
        <Text style={[styles.numero, { color: t.textoSecundario }]}>{c.numero}</Text>
        <SeloPartido numero={c.partido.numero} sigla={c.partido.sigla} />
      </View>
      <SeloSituacao situacao={c.situacao} />
      <Text style={[styles.pct, { color: t.texto }]}>{c.pctTexto}%</Text>
      <Text style={[styles.votos, { color: t.textoSecundario }]}>{formatInteiro(c.votos)} votos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 10 },
  cartoes: { flexDirection: 'row', gap: 12 },
  cartao: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, borderTopWidth: 5 },
  nome: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numero: { fontSize: 14 },
  pct: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  votos: { fontSize: 13, fontVariant: ['tabular-nums'] },
  barra: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' },
  divisor: { width: 2 },
  marcas: { flexDirection: 'row', justifyContent: 'space-between' },
  marca: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
