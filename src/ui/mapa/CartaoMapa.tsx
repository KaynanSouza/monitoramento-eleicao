import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Consulta } from '@/api/apuracao';
import { formatInteiro, nomeProprio } from '@/lib/format';
import { corPartido } from '@/lib/partidos';
import { lideresNoMapa } from '@/mapa/dados';
import { caixaAbrangencia, obterMalha } from '@/mapa/malha';
import type { Candidato } from '@/tse/types';
import { Avatar } from '../Avatar';
import { SeloPartido, SeloSituacao } from '../Selos';
import { useTema } from '../tema';
import type { DadosTela } from '../useApuracao';
import { LegendaMapa } from './LegendaMapa';
import { MapaSvg } from './MapaSvg';
import { useMapaMunicipios, useMapaUfs } from './useMapa';

const TODAS_UFS = () => obterMalha().ufs.map((u) => u.uf);
const VAZIO = new Set<string>();

/** Seção "Mapa" da tela principal: mapa da abrangência, 2 primeiros e "Ver mapa completo". */
export function CartaoMapa({ consulta, dados }: { consulta: Consulta; dados: DadosTela }) {
  const t = useTema();
  const janela = useWindowDimensions();
  const [largura, setLargura] = useState(0);
  const w = largura || janela.width - 32;
  const nacional = consulta.uf === 'br';
  const finalizada = dados.resultado.totalizacaoFinal;

  const porUf = useMapaUfs(consulta.turno, consulta.cargo, nacional, finalizada);
  const mun = useMapaMunicipios(consulta.turno, consulta.cargo, nacional ? [] : [consulta.uf], finalizada);

  const caixa = useMemo(() => caixaAbrangencia(consulta.uf), [consulta.uf]);
  const ufs = useMemo(() => (nacional ? TODAS_UFS() : [consulta.uf]), [nacional, consulta.uf]);
  const altura = Math.round(Math.min(w, ((caixa[3] - caixa[1]) / (caixa[2] - caixa[0])) * w, 420));
  const lideres = lideresNoMapa(nacional ? (porUf.data?.resumos.values() ?? []) : mun.resumos.values());

  return (
    <View style={styles.bloco}>
      <Text style={[styles.titulo, { color: t.texto }]} accessibilityRole="header">
        Mapa
      </Text>
      <View
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`Mapa de ${nacional ? 'Brasil por estado' : 'municípios'} colorido pelo candidato mais votado. Abra o mapa completo para detalhes.`}
      >
        <MapaSvg
          largura={w}
          altura={altura}
          caixa={caixa}
          ufs={ufs}
          resumosUf={porUf.data?.resumos}
          camadas={nacional ? [] : mun.camadas}
          ufsComMunicipios={nacional ? VAZIO : mun.ufsComMunicipios}
        />
      </View>
      {!nacional && mun.progresso !== null && mun.progresso < 1 && (
        <Text style={[styles.nota, { color: t.textoSecundario }]}>
          Carregando municípios… {Math.round(mun.progresso * 100)}%
        </Text>
      )}
      <LegendaMapa lideres={lideres} />

      <View style={styles.cartoes}>
        {dados.resultado.candidatos.slice(0, 2).map((c) => (
          <CartaoCandidato key={c.sqcand} c={c} foto={dados.foto(c.sqcand)} />
        ))}
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/mapa', params: { ...consulta, turno: String(consulta.turno) } })}
        accessibilityRole="button"
        style={[styles.botao, { borderColor: t.destaque }]}
      >
        <Text style={[styles.botaoTexto, { color: t.destaque }]}>Ver mapa completo</Text>
      </Pressable>
    </View>
  );
}

function CartaoCandidato({ c, foto }: { c: Candidato; foto: string | null }) {
  const t = useTema();
  const cor = corPartido(c.partido.numero);
  return (
    <View
      style={[styles.cartao, { backgroundColor: t.superficie, borderTopColor: cor }]}
      accessible
      accessibilityLabel={`${nomeProprio(c.nomeUrna)}, ${c.partido.sigla}, ${c.pctTexto} por cento, ${formatInteiro(c.votos)} votos`}
    >
      <Avatar nome={c.nomeUrna} cor={cor} foto={foto} tamanho={56} />
      <Text style={[styles.nome, { color: t.texto }]} numberOfLines={2}>
        {nomeProprio(c.nomeUrna)}
      </Text>
      <View style={styles.linha}>
        <Text style={{ color: t.textoSecundario }}>{c.numero}</Text>
        <SeloPartido numero={c.partido.numero} sigla={c.partido.sigla} />
      </View>
      <SeloSituacao situacao={c.situacao} />
      <Text style={[styles.pct, { color: t.texto }]}>{c.pctTexto}%</Text>
      <Text style={[styles.votos, { color: t.textoSecundario }]}>{formatInteiro(c.votos)} votos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  titulo: { fontSize: 20, fontWeight: '800' },
  nota: { fontSize: 13 },
  cartoes: { flexDirection: 'row', gap: 12 },
  cartao: { flex: 1, padding: 12, borderRadius: 10, borderTopWidth: 4, alignItems: 'center', gap: 6 },
  nome: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pct: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  votos: { fontSize: 12, fontVariant: ['tabular-nums'] },
  botao: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  botaoTexto: { fontSize: 15, fontWeight: '700' },
});
