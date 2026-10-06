import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { formatInteiro, formatPct, nomeProprio } from '@/lib/format';
import { nomeAbrangencia } from '@/lib/ufs';
import { lideresNoMapa } from '@/mapa/dados';
import { municipioEm, telaParaMalha } from '@/mapa/geo';
import { caixaAbrangencia, obterMalha } from '@/mapa/malha';
import { SeloPartido } from '@/ui/Selos';
import { LegendaMapa } from '@/ui/mapa/LegendaMapa';
import { MapaSvg } from '@/ui/mapa/MapaSvg';
import { useMapaMunicipios, useMapaUfs, useNomesMunicipios } from '@/ui/mapa/useMapa';
import { useTema } from '@/ui/tema';

const ESCALA_MAX = 12;

export default function MapaCompleto() {
  const t = useTema();
  const p = useLocalSearchParams<{ turno: string; cargo: string; uf: string }>();
  const turno: 1 | 2 = p.turno === '2' ? 2 : 1;
  const cargo = p.cargo ?? '1';
  const abrangencia = p.uf ?? 'br';
  const nacional = abrangencia === 'br';

  const malha = obterMalha();
  const todas = useMemo(() => malha.ufs.map((u) => u.uf), [malha]);
  const [ufsCarregadas, setUfsCarregadas] = useState<string[]>(nacional ? [] : [abrangencia]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const janela = useWindowDimensions();
  const [medida, setTam] = useState({ w: 0, h: 0 });
  // Antes da primeira medição, estima a área do mapa (largura da tela, ~55% da altura).
  const tam = medida.w ? medida : { w: janela.width, h: Math.round(janela.height * 0.55) };

  const porUf = useMapaUfs(turno, cargo, nacional, false);
  const mun = useMapaMunicipios(turno, cargo, ufsCarregadas, false);
  const nomes = useNomesMunicipios(turno, cargo);

  const caixa = useMemo(() => caixaAbrangencia(abrangencia), [abrangencia]);
  const ufs = nacional ? todas : [abrangencia];

  // Zoom (pinça) e arraste no thread de UI; toque convertido para a malha no JS.
  const escala = useSharedValue(1);
  const escalaInicio = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const txInicio = useSharedValue(0);
  const tyInicio = useSharedValue(0);

  const tocar = useCallback(
    (x: number, y: number, s: number, dx: number, dy: number) => {
      const [mx, my] = telaParaMalha(x, y, tam.w, tam.h, caixa, s, dx, dy);
      const m = municipioEm(malha, mx, my, nacional ? undefined : abrangencia);
      if (!m) {
        setSelecionado(null);
        return;
      }
      setSelecionado(m.i);
      if (!ufsCarregadas.includes(m.u)) setUfsCarregadas((u) => [...u, m.u]); // carrega a UF sob demanda
    },
    [tam, caixa, malha, nacional, abrangencia, ufsCarregadas],
  );

  const pinca = Gesture.Pinch()
    .onStart(() => {
      escalaInicio.value = escala.value;
    })
    .onUpdate((e) => {
      escala.value = Math.min(ESCALA_MAX, Math.max(1, escalaInicio.value * e.scale));
    });
  const arraste = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      txInicio.value = tx.value;
      tyInicio.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = txInicio.value + e.translationX;
      ty.value = tyInicio.value + e.translationY;
    });
  const toque = Gesture.Tap()
    .maxDuration(300)
    .onEnd((e, ok) => {
      if (ok) scheduleOnRN(tocar, e.x, e.y, escala.value, tx.value, ty.value);
    });
  const gesto = Gesture.Race(toque, Gesture.Simultaneous(pinca, arraste));

  const estiloZoom = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: escala.value }],
  }));

  const restaurar = () => {
    escala.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
  };

  const resultadoSel = selecionado ? mun.resultados.get(selecionado) : undefined;
  const infoSel = selecionado ? nomes.data?.get(selecionado) : undefined;
  const ufSelCarregando = infoSel && mun.carregando && !resultadoSel;
  const lideres = lideresNoMapa([...(porUf.data?.resumos.values() ?? []), ...mun.resumos.values()]);
  const todasCarregadas = ufsCarregadas.length === todas.length;

  return (
    <SafeAreaView style={[styles.tela, { backgroundColor: t.fundo }]}>
      <View style={[styles.topo, { borderBottomColor: t.borda }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
          <Text style={[styles.acao, { color: t.destaque }]}>‹ Voltar</Text>
        </Pressable>
        <Text style={[styles.titulo, { color: t.texto }]} numberOfLines={1}>
          Mapa · {nomeAbrangencia(abrangencia)}
        </Text>
        <Pressable onPress={restaurar} accessibilityRole="button" accessibilityLabel="Restaurar zoom" hitSlop={12}>
          <Text style={[styles.acao, { color: t.destaque }]}>Ajustar</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={gesto}>
        <View
          style={styles.area}
          onLayout={(e) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          accessible
          accessibilityLabel="Mapa interativo. Pinça para zoom, arraste para mover, toque num município para ver o resultado."
        >
          {tam.w > 0 && (
            <Animated.View style={estiloZoom}>
              <MapaSvg
                largura={tam.w}
                altura={tam.h}
                caixa={caixa}
                ufs={ufs}
                resumosUf={porUf.data?.resumos}
                camadas={mun.camadas}
                ufsComMunicipios={mun.ufsComMunicipios}
                destaque={selecionado}
              />
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <ScrollView style={[styles.painel, { borderTopColor: t.borda }]} contentContainerStyle={styles.painelConteudo}>
        {mun.progresso !== null && mun.progresso < 1 && (
          <View style={styles.progresso}>
            <Text style={[styles.nota, { color: t.textoSecundario }]}>
              Carregando municípios… {Math.round(mun.progresso * 100)}%
            </Text>
            <View style={[styles.trilho, { backgroundColor: t.trilho }]}>
              <View style={[styles.barra, { width: `${mun.progresso * 100}%`, backgroundColor: t.textoSecundario }]} />
            </View>
          </View>
        )}

        {infoSel ? (
          <View style={styles.selecao} accessibilityLiveRegion="polite">
            <Text style={[styles.municipio, { color: t.texto }]}>
              {nomeProprio(infoSel.nome)} ({infoSel.uf.toUpperCase()})
            </Text>
            {resultadoSel ? (
              <>
                <Text style={[styles.nota, { color: t.textoSecundario }]}>
                  {resultadoSel.secoes.pctTexto}% das seções apuradas
                </Text>
                {resultadoSel.candidatos.slice(0, 3).map((c) => (
                  <View key={c.sqcand} style={styles.linhaCand}>
                    <SeloPartido numero={c.partido.numero} sigla={c.partido.sigla} />
                    <Text style={[styles.nomeCand, { color: t.texto }]} numberOfLines={1}>
                      {nomeProprio(c.nomeUrna)}
                    </Text>
                    <Text style={[styles.pct, { color: t.texto }]}>{formatPct(c.pct)}%</Text>
                    <Text style={[styles.votos, { color: t.textoSecundario }]}>{formatInteiro(c.votos)}</Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={[styles.nota, { color: t.textoSecundario }]}>
                {ufSelCarregando ? 'Carregando o resultado…' : 'Resultado deste município ainda não disponível.'}
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.nota, { color: t.textoSecundario }]}>
            {nacional
              ? 'Cada estado aparece na cor do candidato mais votado. Toque num município para carregar os municípios daquele estado e ver o resultado. Pinça para zoom.'
              : 'Toque num município para ver o resultado. Pinça para zoom.'}
          </Text>
        )}

        <LegendaMapa lideres={lideres} />

        {nacional && !todasCarregadas && (
          <Pressable
            onPress={() => setUfsCarregadas(todas)}
            accessibilityRole="button"
            style={[styles.botao, { borderColor: t.destaque }]}
          >
            <Text style={[styles.acao, { color: t.destaque }]}>Carregar mapa completo (todos os municípios)</Text>
            <Text style={[styles.nota, { color: t.textoSecundario }]}>
              Cerca de 5.570 arquivos, baixados devagar para respeitar o limite do TSE.
            </Text>
          </Pressable>
        )}
        <Text style={[styles.nota, { color: t.textoSecundario }]}>Fonte: TSE (divulgação oficial) · Malha: IBGE</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  acao: { fontSize: 15, fontWeight: '700' },
  area: { flex: 1, overflow: 'hidden' },
  painel: { maxHeight: '42%', borderTopWidth: StyleSheet.hairlineWidth },
  painelConteudo: { padding: 16, gap: 12 },
  progresso: { gap: 6 },
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barra: { height: 6 },
  selecao: { gap: 8 },
  municipio: { fontSize: 18, fontWeight: '800' },
  linhaCand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomeCand: { flex: 1, fontSize: 15 },
  pct: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  votos: { fontSize: 12, minWidth: 80, textAlign: 'right', fontVariant: ['tabular-nums'] },
  nota: { fontSize: 13, lineHeight: 18 },
  botao: { borderWidth: 1.5, borderRadius: 8, padding: 12, gap: 4 },
});
