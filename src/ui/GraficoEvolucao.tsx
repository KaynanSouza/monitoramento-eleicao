import { useMemo, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatHora, formatPct, nomeProprio } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import { type Area, caminho, escalas, lacunas, pontoMaisProximo } from '@/historico/grafico';
import type { PontoSerie, SerieEvolucao } from '@/historico/serie';
import { SeloPartido } from './Selos';
import { useTema } from './tema';

const ALTURA = 240;
const MARGEM = { esq: 34, dir: 8, topo: 8, base: 26 };
const iso = (ms: number) => new Date(ms).toISOString();

interface Props {
  serie: SerieEvolucao | undefined;
  /** Apuração já concluída (muda o texto quando não há histórico). */
  finalizada: boolean;
}

export function GraficoEvolucao({ serie, finalizada }: Props) {
  const t = useTema();
  const janela = useWindowDimensions();
  const [medida, setLargura] = useState(0);
  // Antes da primeira medição (onLayout), usa a largura da tela menos as margens laterais.
  const largura = medida || Math.max(0, janela.width - 32);
  const [cursor, setCursor] = useState<PontoSerie | null>(null);

  const area: Area = { largura, altura: ALTURA, margem: MARGEM };
  const e = useMemo(() => (serie && largura ? escalas(serie, area) : null), [serie, largura]); // eslint-disable-line react-hooks/exhaustive-deps

  const vazio = !serie || serie.segmentos.length === 0;

  const tocar = (ev: GestureResponderEvent) => {
    if (serie && e) setCursor(pontoMaisProximo(serie, e, ev.nativeEvent.locationX));
  };

  return (
    <View style={styles.bloco}>
      <Text style={[styles.titulo, { color: t.texto }]} accessibilityRole="header">
        Evolução da apuração
      </Text>

      {vazio ? (
        <View style={[styles.vazio, { backgroundColor: t.superficie }]}>
          <Text style={[styles.nota, { color: t.textoSecundario }]}>
            {finalizada
              ? 'Não há histórico gravado desta apuração. O gráfico de evolução é formado enquanto o app acompanha a apuração ao vivo; aqui aparece só o resultado final.'
              : 'O gráfico aparece a partir da primeira atualização gravada pelo app.'}
          </Text>
        </View>
      ) : (
        <>
          <View
            onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={tocar}
            onResponderMove={tocar}
            onResponderTerminationRequest={() => true}
            accessible
            accessibilityLabel={descrever(serie!)}
            style={{ height: ALTURA }}
          >
            {e && (
              <Svg width={largura} height={ALTURA}>
                {e.ticksY.map((v) => (
                  <G key={`y${v}`}>
                    <Line x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={e.y(v)} y2={e.y(v)} stroke={t.borda} strokeWidth={1} />
                    <SvgText x={MARGEM.esq - 6} y={e.y(v) + 4} fontSize={11} fill={t.textoSecundario} textAnchor="end">
                      {`${v}%`}
                    </SvgText>
                  </G>
                ))}
                {e.ticksX.map((tk) => (
                  <SvgText
                    key={`x${tk}`}
                    x={e.x(tk)}
                    y={ALTURA - 8}
                    fontSize={11}
                    fill={t.textoSecundario}
                    textAnchor="middle"
                  >
                    {formatHora(iso(tk))}
                  </SvgText>
                ))}
                {serie!.candidatos.map((c) => {
                  const cor = corPartido(c.partido);
                  return (
                    <G key={c.sqcand}>
                      {serie!.segmentos.map((seg, i) =>
                        seg.length > 1 ? (
                          <Path key={i} d={caminho(seg, c.sqcand, e)} stroke={cor} strokeWidth={2.5} fill="none" />
                        ) : (
                          <Circle
                            key={i}
                            cx={e.x(seg[0]!.t)}
                            cy={e.y(seg[0]!.pct[c.sqcand] ?? 0)}
                            r={2.5}
                            fill={cor}
                          />
                        ),
                      )}
                      {lacunas(serie!, c.sqcand, e).map((l, i) => (
                        <Line key={`l${i}`} {...l} stroke={cor} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
                      ))}
                    </G>
                  );
                })}
                {cursor && (
                  <G>
                    <Line
                      x1={e.x(cursor.t)}
                      x2={e.x(cursor.t)}
                      y1={MARGEM.topo}
                      y2={ALTURA - MARGEM.base}
                      stroke={t.textoSecundario}
                      strokeWidth={1}
                    />
                    {serie!.candidatos.map((c) =>
                      cursor.pct[c.sqcand] !== undefined ? (
                        <Circle
                          key={c.sqcand}
                          cx={e.x(cursor.t)}
                          cy={e.y(cursor.pct[c.sqcand]!)}
                          r={4}
                          fill={corPartido(c.partido)}
                          stroke={t.fundo}
                          strokeWidth={1.5}
                        />
                      ) : null,
                    )}
                  </G>
                )}
              </Svg>
            )}
            {cursor && e && <Dica ponto={cursor} serie={serie!} x={e.x(cursor.t)} largura={largura} />}
          </View>

          <View style={styles.legenda}>
            {serie!.candidatos.map((c) => (
              <View key={c.sqcand} style={styles.itemLegenda}>
                <SeloPartido numero={c.partido} sigla={c.sigla} />
                <Text style={[styles.nomeLegenda, { color: t.texto }]}>{nomeProprio(c.nomeUrna)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.nota, { color: t.textoSecundario }]}>
            Histórico gravado a partir de {formatHora(iso(serie!.segmentos[0]![0]!.t))}, quando o app foi aberto.
            {serie!.segmentos.length > 1 ? ' Trechos tracejados: período em que o app não acompanhou a apuração.' : ''}
            {' '}Toque no gráfico para ver os valores.
          </Text>
        </>
      )}
    </View>
  );
}

function Dica({ ponto, serie, x, largura }: { ponto: PontoSerie; serie: SerieEvolucao; x: number; largura: number }) {
  const t = useTema();
  const LARG = 168;
  const esquerda = Math.min(Math.max(0, x + 8 > largura - LARG ? x - LARG - 8 : x + 8), Math.max(0, largura - LARG));
  const linhas = [...serie.candidatos].sort((a, b) => (ponto.pct[b.sqcand] ?? 0) - (ponto.pct[a.sqcand] ?? 0));
  return (
    <View
      pointerEvents="none"
      style={[styles.dica, { left: esquerda, width: LARG, backgroundColor: t.superficie, borderColor: t.borda }]}
    >
      <Text style={[styles.dicaTitulo, { color: t.texto }]}>
        {formatHora(new Date(ponto.t).toISOString())} · {formatPct(ponto.pctSecoes)}% seções
      </Text>
      {linhas.map((c) => (
        <View key={c.sqcand} style={styles.dicaLinha}>
          <View style={[styles.ponto, { backgroundColor: corPartido(c.partido) }]} />
          <Text style={[styles.dicaTexto, { color: t.texto }]} numberOfLines={1}>
            {nomeProprio(c.nomeUrna)}
          </Text>
          <Text style={[styles.dicaPct, { color: t.texto }]}>
            {ponto.pct[c.sqcand] !== undefined ? `${formatPct(ponto.pct[c.sqcand]!)}%` : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Resumo textual para leitores de tela. */
function descrever(serie: SerieEvolucao): string {
  const pts = serie.segmentos.flat();
  const ini = pts[0]!;
  const fim = pts[pts.length - 1]!;
  const partes = serie.candidatos.map(
    (c) =>
      `${nomeProprio(c.nomeUrna)} de ${formatPct(ini.pct[c.sqcand] ?? 0)} a ${formatPct(fim.pct[c.sqcand] ?? 0)} por cento`,
  );
  return `Gráfico de evolução, das ${formatHora(new Date(ini.t).toISOString())} às ${formatHora(
    new Date(fim.t).toISOString(),
  )}: ${partes.join('; ')}.`;
}

const styles = StyleSheet.create({
  bloco: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  titulo: { fontSize: 20, fontWeight: '800' },
  vazio: { padding: 16, borderRadius: 8 },
  nota: { fontSize: 13, lineHeight: 18 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nomeLegenda: { fontSize: 13 },
  dica: { position: 'absolute', top: 4, padding: 8, borderRadius: 8, borderWidth: 1, gap: 4 },
  dicaTitulo: { fontSize: 12, fontWeight: '700' },
  dicaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  dicaTexto: { fontSize: 12, flex: 1 },
  dicaPct: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
