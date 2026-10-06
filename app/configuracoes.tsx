import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { obterServicos } from '@/servicos';
import { type AjustesManuais, cargosDisponiveis, type Origem, resolverEleicao } from '@/tse/eleicoes';
import { useTema } from '@/ui/tema';

const ORIGEM: Record<Origem, string> = {
  'ele-c': 'publicado no ele-c.json',
  cdt2: 'provisório: código de 2º turno anunciado no 1º turno (cdt2)',
  manual: 'definido à mão',
};

type Linha = { chave: `${1 | 2}:${string}`; turno: 1 | 2; cargo: string; nome: string; auto: string | null; origemAuto: Origem | null };

/** Configurações: códigos de eleição (descobertos no ele-c.json, com ajuste manual) e cache. */
export default function Configuracoes() {
  const t = useTema();
  const qc = useQueryClient();
  const [edicao, setEdicao] = useState<AjustesManuais>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const s = await obterServicos();
      const [eleicoes, manuais] = await Promise.all([s.apuracao.eleicoes(), s.ajustes.codigosManuais()]);
      const linhas: Linha[] = ([1, 2] as const).flatMap((turno) =>
        cargosDisponiveis(eleicoes, turno).map((c) => {
          const auto = resolverEleicao(eleicoes, turno, c.codigo);
          return {
            chave: `${turno}:${c.codigo}` as const,
            turno,
            cargo: c.codigo,
            nome: c.nome,
            auto: auto?.codigo ?? null,
            origemAuto: auto?.origem ?? null,
          };
        }),
      );
      return { linhas, manuais, modo: s.modo, endpoint: s.endpoint, pausaAte: s.http.pausaAte };
    },
  });

  useEffect(() => {
    if (q.data) setEdicao(q.data.manuais);
  }, [q.data]);

  const salvar = async () => {
    const limpos = Object.fromEntries(
      Object.entries(edicao).filter(([, v]) => v && /^\d{1,6}$/.test(v.trim())).map(([k, v]) => [k, v!.trim()]),
    ) as AjustesManuais;
    const s = await obterServicos();
    await s.ajustes.salvarCodigosManuais(limpos);
    // Não espera o recarregamento das telas (o mapa pode levar um tempo).
    void qc.invalidateQueries();
    setAviso('Códigos salvos. A tela de apuração já usa os novos valores.');
  };

  const limparCache = async () => {
    const s = await obterServicos();
    await s.limparCache();
    void qc.invalidateQueries();
    setAviso('Cache local apagado. Os arquivos serão buscados de novo (respeitando o limite do TSE).');
  };

  return (
    <SafeAreaView style={[styles.tela, { backgroundColor: t.fundo }]}>
      <View style={[styles.topo, { borderBottomColor: t.borda }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
          <Text style={[styles.acao, { color: t.destaque }]}>‹ Voltar</Text>
        </Pressable>
        <Text style={[styles.titulo, { color: t.texto }]} accessibilityRole="header">
          Configurações
        </Text>
        <View style={styles.espaco} />
      </View>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={[styles.secao, { color: t.texto }]} accessibilityRole="header">
          Códigos das eleições
        </Text>
        <Text style={[styles.nota, { color: t.textoSecundario }]}>
          Os códigos são lidos do ele-c.json do TSE ao abrir o app. Só preencha um código à mão se o TSE
          divulgar um valor diferente; deixe em branco para usar o automático.
        </Text>

        {q.data?.linhas.map((l) => (
          <View key={l.chave} style={[styles.linha, { borderBottomColor: t.borda }]}>
            <View style={styles.rotulo}>
              <Text style={[styles.cargo, { color: t.texto }]}>
                {l.turno}º turno · {l.nome}
              </Text>
              <Text style={[styles.nota, { color: t.textoSecundario }]}>
                Automático: {l.auto ?? '—'}
                {l.origemAuto ? ` (${ORIGEM[l.origemAuto]})` : ''}
              </Text>
            </View>
            <TextInput
              value={edicao[l.chave] ?? ''}
              onChangeText={(v) => setEdicao((e) => ({ ...e, [l.chave]: v.replace(/\D/g, '') }))}
              placeholder={l.auto ?? 'código'}
              placeholderTextColor={t.textoSecundario}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel={`Código manual para ${l.nome}, ${l.turno}º turno`}
              style={[styles.entrada, { color: t.texto, borderColor: t.borda, backgroundColor: t.superficie }]}
            />
          </View>
        ))}

        <Pressable onPress={salvar} accessibilityRole="button" style={[styles.botao, { backgroundColor: t.destaque }]}>
          <Text style={[styles.botaoTexto, { color: t.destaqueTexto }]}>Salvar códigos</Text>
        </Pressable>
        {aviso && (
          <Text style={[styles.nota, { color: t.texto }]} accessibilityLiveRegion="polite">
            {aviso}
          </Text>
        )}

        <Text style={[styles.secao, { color: t.texto }]} accessibilityRole="header">
          Fonte de dados
        </Text>
        {q.data && (
          <Text style={[styles.nota, { color: t.textoSecundario }]}>
            Modo: {q.data.modo === 'replay' ? 'replay (simulação, sem rede)' : 'oficial'}
            {'\n'}
            {q.data.endpoint.base}/{q.data.endpoint.ambiente}/{q.data.endpoint.ciclo}
          </Text>
        )}
        <Pressable
          onPress={limparCache}
          accessibilityRole="button"
          style={[styles.botaoContorno, { borderColor: t.destaque }]}
        >
          <Text style={[styles.botaoTexto, { color: t.destaque }]}>Apagar cache local</Text>
        </Pressable>
        <Text style={[styles.nota, { color: t.textoSecundario }]}>
          O histórico do gráfico de evolução não é apagado.
        </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: 17, fontWeight: '800' },
  espaco: { width: 60 },
  acao: { fontSize: 15, fontWeight: '700' },
  conteudo: { padding: 16, gap: 14 },
  secao: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  nota: { fontSize: 13, lineHeight: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rotulo: { flex: 1, gap: 2 },
  cargo: { fontSize: 15, fontWeight: '700' },
  entrada: { width: 96, minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16 },
  botao: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  botaoContorno: { minHeight: 48, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontSize: 15, fontWeight: '700' },
});
