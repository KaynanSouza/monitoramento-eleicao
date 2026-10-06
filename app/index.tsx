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
import { GraficoEvolucao } from '@/ui/GraficoEvolucao';
import { SeletorTurno } from '@/ui/SeletorTurno';
import { useCargos, useHistorico, useResultado, useTurnoPadrao, useUfsEmDisputa } from '@/ui/useApuracao';

const TAG_TELA_LIGADA = 'apuracao';

export default function Apuracao() {
  const t = useTema();
  const [turnoEscolhido, setTurno] = useState<1 | 2 | null>(null);
  const turnoPadrao = useTurnoPadrao();
  const turno: 1 | 2 = turnoEscolhido ?? turnoPadrao.data ?? 1;
  const [cargo, setCargo] = useState<string | null>(null);
  const [uf, setUf] = useState('br');
  const [seletorAberto, setSeletorAberto] = useState(false);

  const cargos = useCargos(turno);
  const lista = cargos.data ?? [];
  const cargoAtual = lista.find((c) => c.codigo === cargo) ?? lista[0];

  const ufsDisputa = useUfsEmDisputa(turno, cargoAtual?.codigo).data ?? null;

  // Cargos sem resultado nacional exigem uma UF; no 2º turno estadual, uma UF com disputa.
  const semDisputa = ufsDisputa !== null && uf !== 'br' && !ufsDisputa.includes(uf);
  const precisaUf = cargoAtual !== undefined && ((!cargoAtual.nacional && uf === 'br') || semDisputa);
  const consulta: Consulta | null = cargoAtual && !precisaUf ? { turno, cargo: cargoAtual.codigo, uf } : null;
  const q = useResultado(consulta);
  const dados = q.data;
  const finalizada = dados?.resultado.totalizacaoFinal ?? false;
  const historico = useHistorico(consulta, dados?.eleicao.codigo, dados?.verificadoEm);

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
        <View style={styles.linhaTopo}>
          <SeloStatus resultado={consulta ? dados?.resultado : undefined} />
          <SeletorTurno
            turno={turno}
            aoEscolher={(n) => {
              setTurno(n);
              setCargo(null);
            }}
          />
        </View>
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
              {semDisputa
                ? `Não há ${turno}º turno para ${cargoAtual?.nome} em ${nomeAbrangencia(uf)}. Escolha um estado com disputa.`
                : `${cargoAtual?.nome} não tem resultado nacional. Escolha um estado.`}
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
    [consulta, dados, uf, turno, lista, cargoAtual, cargos.error, precisaUf, semDisputa, q.error, q.isPending, t],
  );

  const recarregando = q.isRefetching && !q.isPending;

  return (
    <SafeAreaView style={[styles.tela, { backgroundColor: t.fundo }]} edges={['top']}>
      <FlatList
        data={candidatos}
        keyExtractor={(c) => c.sqcand}
        renderItem={({ item }) => <LinhaCandidato candidato={item} foto={dados?.foto(item.sqcand) ?? null} />}
        ListHeaderComponent={cabecalho}
        ListFooterComponent={
          <>
            {consulta && dados && (
              <GraficoEvolucao serie={historico.data} finalizada={dados.resultado.totalizacaoFinal} />
            )}
            <Rodape dados={consulta ? dados : undefined} />
          </>
        }
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
        ufsPermitidas={ufsDisputa}
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
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  erro: { fontSize: 15 },
  carregando: { marginVertical: 24 },
  vazio: { padding: 16, borderRadius: 8, gap: 12, alignItems: 'flex-start' },
  vazioTexto: { fontSize: 16 },
  botao: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botaoTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
