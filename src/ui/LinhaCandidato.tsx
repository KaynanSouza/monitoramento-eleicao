import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatInteiro, nomeProprio } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import type { Candidato } from '@/tse/types';
import { Avatar } from './Avatar';
import { descreverSituacao, SeloPartido, SeloSituacao } from './Selos';
import { useTema } from './tema';

interface Props {
  candidato: Candidato;
  foto: string | null;
}

export const LinhaCandidato = memo(function LinhaCandidato({ candidato: c, foto }: Props) {
  const t = useTema();
  const cor = corPartido(c.partido.numero);
  const nome = nomeProprio(c.nomeUrna);
  const largura = `${Math.min(100, Math.max(0, c.pct))}%` as const;
  const rotulo =
    `${nome}, número ${c.numero}, ${c.partido.sigla}, ${c.pctTexto} por cento, ` +
    `${formatInteiro(c.votos)} votos${descreverSituacao(c.situacao)}` +
    (c.votoValido ? '' : ', votos anulados sub judice');

  return (
    <View style={[styles.linha, { borderBottomColor: t.borda }]} accessible accessibilityLabel={rotulo}>
      <Avatar nome={c.nomeUrna} cor={cor} foto={foto} />
      <View style={styles.meio}>
        <View style={styles.linhaNome}>
          <Text style={[styles.nome, { color: t.texto }]} numberOfLines={1}>
            {nome}
          </Text>
          <SeloSituacao situacao={c.situacao} />
        </View>
        <View style={styles.topo}>
          <Text style={[styles.numero, { color: t.textoSecundario }]}>{c.numero}</Text>
          <SeloPartido numero={c.partido.numero} sigla={c.partido.sigla} />
          {!c.votoValido && <Text style={[styles.numero, { color: t.textoSecundario }]}>anulado sub judice</Text>}
        </View>
        <View style={[styles.trilho, { backgroundColor: t.trilho }]}>
          <View style={[styles.barra, { width: largura, backgroundColor: cor }]} />
        </View>
      </View>
      <View style={styles.numeros}>
        <Text style={[styles.pct, { color: t.texto }]}>{c.pctTexto}%</Text>
        <Text style={[styles.votos, { color: t.textoSecundario }]}>{formatInteiro(c.votos)} votos</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meio: { flex: 1, gap: 4 },
  linhaNome: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nome: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  numero: { fontSize: 13 },
  trilho: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  barra: { height: 8, borderRadius: 4 },
  numeros: { alignItems: 'flex-end', minWidth: 96 },
  pct: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  votos: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
