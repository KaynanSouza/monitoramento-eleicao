import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Consulta } from '@/api/apuracao';
import { nomeAbrangencia } from '@/lib/ufs';
import type { Candidato } from '@/tse/types';
import { AbasCargo, BarraSecoes, SeletorAbrangencia, SeloStatus } from '@/ui/Cabecalho';
import { LinhaCandidato } from '@/ui/LinhaCandidato';
import { mensagemErro } from '@/ui/mensagens';
import { AvisosDados, Rodape } from '@/ui/Rodape';
import { SeletorUf } from '@/ui/SeletorUf';
import { useTema } from '@/ui/tema';
import { useCargos, useResultado } from '@/ui/useApuracao';

const TAG_TELA_LIGADA = 'apuracao';

export default function Apuracao() {
  const t = useTema();
  const [turno] = useState<1 | 2>(1); // seletor de turno: fase 5
  const [cargo, setCargo] = useState<string | null>(null);
  const [uf, setUf] = useState('br');
  const [seletorAberto, setSeletorAberto] = useState(false);

  const cargos = useCargos(turno);
  const lista = cargos.data ?? [];
  const cargoAtual = lista.find((c) => c.codigo === cargo) ?? lista[0];

  // Cargos sem resultado nacional exigem uma UF.
  const precisaUf = cargoAtual !== undefined && !cargoAtual.nacional && uf === 'br';
  const consulta: Consulta | null = cargoAtual && !precisaUf ? { turno, cargo: cargoAtual.codigo, uf } : null;
  const q = useResultado(consulta);
  const dados = q.data;
  const finalizada = dados?.resultado.totalizacaoFinal ?? false;

  // Mantém a tela ligada enquanto a apuração estiver em andamento.
  useEffect(() => {
    if (finalizada || !consulta) return;
    activateKeepAwakeAsync(TAG_TELA_LIGADA).catch(() => undefined);
    return () => {
      deactivateKeepAwake(TAG_TELA_LIGADA).catch(() => undefined);
    };
  }, [finalizada, consulta !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidatos: Candidato[] = consulta ? (dados?.resultado.candidatos ?? []) : [];

  const cabecalho = useMemo(
    () => (
      <View style={styles.cabecalho}>
        <SeloStatus resultado={consulta ? dados?.resultado : undefined} />
        <SeletorAbrangencia nome={nomeAbrangencia(uf)} aoTocar={() => setSeletorAberto(true)} />
        {cargos.error ? (
          <Text style={[styles.erro, { color: t.erro }]}>{mensagemErro(cargos.error)}</Text>
        ) : (
          <AbasCargo cargos={lista} ativo={cargoAtual?.codigo ?? ''} aoEscolher={setCargo} />
        )}
        <AvisosDados dados={consulta ? dados : undefined} />
        {precisaUf && (
          <View style={[styles.vazio, { backgroundColor: t.superficie }]}>
            <Text style={[styles.vazioTexto, { color: t.texto }]}>
              {cargoAtual?.nome} não tem resultado nacional. Escolha um estado.
            </Text>
            <Pressable
              onPress={() => setSeletorAberto(true)}
              accessibilityRole="button"
              style={[styles.botao, { backgroundColor: t.destaque }]}
            >
              <Text style={styles.botaoTexto}>Escolher estado</Text>
            </Pressable>
          </View>
        )}
        {consulta && q.error && !dados && (
          <Text style={[styles.erro, { color: t.erro }]}>{mensagemErro(q.error)}</Text>
        )}
        {consulta && q.isPending && <ActivityIndicator style={styles.carregando} />}
        {consulta && dados && <BarraSecoes resultado={dados.resultado} />}
      </View>
    ),
    [consulta, dados, uf, lista, cargoAtual, cargos.error, precisaUf, q.error, q.isPending, t],
  );

  const recarregando = q.isRefetching && !q.isPending;

  return (
    <SafeAreaView style={[styles.tela, { backgroundColor: t.fundo }]} edges={['top']}>
      <FlatList
        data={candidatos}
        keyExtractor={(c) => c.sqcand}
        renderItem={({ item }) => <LinhaCandidato candidato={item} foto={dados?.foto(item.sqcand) ?? null} />}
        ListHeaderComponent={cabecalho}
        ListFooterComponent={<Rodape dados={consulta ? dados : undefined} />}
        refreshControl={
          <RefreshControl refreshing={recarregando} onRefresh={() => q.refetch()} enabled={consulta !== null} />
        }
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
      />
      <SeletorUf
        visivel={seletorAberto}
        atual={uf}
        incluirBrasil={cargoAtual?.nacional ?? true}
        aoEscolher={(novo) => {
          setUf(novo);
          setSeletorAberto(false);
        }}
        aoFechar={() => setSeletorAberto(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  cabecalho: { padding: 16, gap: 16 },
  erro: { fontSize: 15 },
  carregando: { marginVertical: 24 },
  vazio: { padding: 16, borderRadius: 8, gap: 12, alignItems: 'flex-start' },
  vazioTexto: { fontSize: 16 },
  botao: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botaoTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
