import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatInteiro, formatPct } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import type { Agremiacao, Resultado } from '@/tse/types';
import { useTema } from './tema';

/** Quantas agremiações aparecem antes de "Ver todas". */
const VISIVEIS = 8;

/**
 * Cargos proporcionais: vagas por partido/federação (campo `vag` do TSE), barra de
 * composição da bancada e votos de cada agremiação em relação ao quociente eleitoral.
 * Antes de o TSE distribuir as vagas, mostra só votos e quociente (sem projeção).
 */
export const Bancada = memo(function Bancada({ resultado }: { resultado: Resultado }) {
  const t = useTema();
  const [todas, setTodas] = useState(false);
  const p = resultado.proporcional;
  if (!p) return null;

  const vagas = resultado.cargo.vagas;
  const distribuidas = p.agremiacoes.some((a) => a.vagas !== null);
  const comVagas = p.agremiacoes.filter((a) => (a.vagas ?? 0) > 0);
  const lista = distribuidas && !todas ? comVagas : p.agremiacoes;
  const visiveis = todas ? lista : lista.slice(0, VISIVEIS);
  const ocultas = p.agremiacoes.length - visiveis.length;
  const maiorVotos = Math.max(1, ...p.agremiacoes.map((a) => a.votos));

  return (
    <View style={[styles.bloco, { backgroundColor: t.superficie }]}>
      <View style={styles.topo}>
        <Text style={[styles.titulo, { color: t.texto }]} accessibilityRole="header">
          {distribuidas ? 'Bancada eleita' : 'Votos por partido/federação'}
        </Text>
        <Text style={[styles.meta, { color: t.textoSecundario }]}>
          {vagas} vagas
          {p.quocienteEleitoral ? ` · QE ${formatInteiro(p.quocienteEleitoral)}` : ''}
        </Text>
      </View>

      {distribuidas ? (
        <BarraBancada agremiacoes={comVagas} vagas={vagas} />
      ) : (
        <Text style={[styles.nota, { color: t.textoSecundario }]}>
          O TSE distribui as vagas ao fim da totalização. Até lá, a coluna mostra quantas vezes o
          partido/federação já atingiu o quociente eleitoral (QE).
        </Text>
      )}

      {visiveis.map((a) => (
        <LinhaAgremiacao
          key={a.numero}
          a={a}
          quociente={p.quocienteEleitoral}
          distribuidas={distribuidas}
          fracao={a.votos / maiorVotos}
        />
      ))}

      {(ocultas > 0 || todas) && (
        <Pressable onPress={() => setTodas((v) => !v)} accessibilityRole="button" hitSlop={8} style={styles.mais}>
          <Text style={[styles.maisTexto, { color: t.destaque }]}>
            {todas ? 'Mostrar menos' : distribuidas ? `Ver todas (${p.agremiacoes.length})` : `Ver mais ${ocultas}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
});

/** Composição da bancada: um segmento por agremiação, proporcional às vagas. */
function BarraBancada({ agremiacoes, vagas }: { agremiacoes: Agremiacao[]; vagas: number }) {
  const t = useTema();
  const rotulo = agremiacoes.map((a) => `${a.composicao} ${a.vagas}`).join(', ');
  return (
    <View
      style={[styles.barra, { backgroundColor: t.trilho }]}
      accessible
      accessibilityLabel={`Composição da bancada de ${vagas} vagas: ${rotulo}`}
    >
      {agremiacoes.map((a, i) => (
        <View
          key={a.numero}
          style={{
            flex: a.vagas ?? 0,
            backgroundColor: corPartido(a.principal.numero),
            marginLeft: i ? StyleSheet.hairlineWidth * 2 : 0,
          }}
        />
      ))}
    </View>
  );
}

function LinhaAgremiacao({
  a,
  quociente,
  distribuidas,
  fracao,
}: {
  a: Agremiacao;
  quociente: number | null;
  distribuidas: boolean;
  fracao: number;
}) {
  const t = useTema();
  const cor = corPartido(a.principal.numero);
  const vezesQe = quociente ? a.votos / quociente : null;
  const tipo = a.tipo === 'federacao' ? 'Federação' : a.tipo === 'coligacao' ? 'Coligação' : null;
  const valor = distribuidas ? String(a.vagas ?? 0) : vezesQe !== null ? `${formatPct(vezesQe, 1)}×` : '—';
  const rotulo =
    `${a.composicao}${tipo ? `, ${tipo.toLowerCase()}` : ''}, ${formatInteiro(a.votos)} votos` +
    (distribuidas ? `, ${a.vagas ?? 0} vagas` : vezesQe !== null ? `, ${formatPct(vezesQe, 1)} quocientes` : '');

  return (
    <View style={styles.linha} accessible accessibilityLabel={rotulo}>
      <View style={[styles.marca, { backgroundColor: cor }]} />
      <View style={styles.meio}>
        <Text style={[styles.nome, { color: t.texto }]} numberOfLines={1}>
          {a.composicao}
        </Text>
        <View style={[styles.trilho, { backgroundColor: t.trilho }]}>
          <View style={[styles.preenchido, { width: `${Math.round(fracao * 100)}%`, backgroundColor: cor }]} />
        </View>
        <Text style={[styles.votos, { color: t.textoSecundario }]} numberOfLines={1}>
          {formatInteiro(a.votos)} votos
          {a.votosLegenda ? ` · ${formatInteiro(a.votosLegenda)} de legenda` : ''}
          {tipo ? ` · ${tipo}` : ''}
        </Text>
      </View>
      <Text style={[styles.valor, { color: distribuidas && !a.vagas ? t.textoSecundario : t.texto }]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { padding: 14, borderRadius: 12, gap: 12 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 },
  titulo: { fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 13, fontVariant: ['tabular-nums'] },
  nota: { fontSize: 13, lineHeight: 18 },
  barra: { flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marca: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  meio: { flex: 1, gap: 3 },
  nome: { fontSize: 15, fontWeight: '700' },
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  preenchido: { height: 6, borderRadius: 3 },
  votos: { fontSize: 12, fontVariant: ['tabular-nums'] },
  valor: { fontSize: 22, fontWeight: '800', minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  mais: { alignSelf: 'flex-start', paddingVertical: 4 },
  maisTexto: { fontSize: 14, fontWeight: '700' },
});
