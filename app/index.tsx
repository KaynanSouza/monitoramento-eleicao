import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import { CartaoMapa } from '@/ui/mapa/CartaoMapa';
import { Disputa } from '@/ui/Disputa';
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

  const todos: Candidato[] = consulta ? (dados?.resultado.candidatos ?? []) : [];
  // 2º turno: tela de disputa com os dois candidatos lado a lado em vez da lista.
  const disputa = turno === 2 && todos.length === 2 ? (todos as [Candidato, Candidato]) : null;
  const candidatos = disputa ? [] : todos;

  const cabecalho = useMemo(
    () => (
      <View style={styles.cabecalho}>
        <View style={styles.linhaTopo}>
          <SeloStatus resultado={consulta ? dados?.resultado : undefined} />
          <View style={styles.acoesTopo}>
            <SeletorTurno
              turno={turno}
              aoEscolher={(n) => {
                setTurno(n);
                setCargo(null);
              }}
            />
            <Pressable
              onPress={() => router.push('/configuracoes')}
              accessibilityRole="button"
              accessibilityLabel="Configurações"
              hitSlop={10}
              style={styles.engrenagem}
            >
              <Text style={[styles.engrenagemTexto, { color: t.textoSecundario }]}>⚙</Text>
            </Pressable>
          </View>
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
              <Text style={[styles.botaoTexto, { color: t.destaqueTexto }]}>Escolher estado</Text>
            </Pressable>
          </View>
        )}
        {consulta && q.error && !dados && (
          <Text style={[styles.erro, { color: t.erro }]}>{mensagemErro(q.error)}</Text>
        )}
        {consulta && q.isPending && <ActivityIndicator style={styles.carregando} color={t.textoSecundario} />}
        {consulta && dados && <BarraSecoes resultado={dados.resultado} />}
        {disputa && dados && <Disputa candidatos={disputa} foto={dados.foto} />}
      </View>
    ),
    [consulta, dados, disputa, uf, turno, lista, cargoAtual, cargos.error, precisaUf, semDisputa, q.error, q.isPending, t],
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
            {/* Mapa só para cargos majoritários: em proporcionais o "mais votado" por município não diz quem se elegeu. */}
            {consulta && dados && dados.resultado.cargo.vagas <= 2 && <CartaoMapa consulta={consulta} dados={dados} mostrarCartoes={!disputa} />}
            <Rodape dados={consulta ? dados : undefined} />
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={recarregando}
            onRefresh={() => q.refetch()}
            enabled={consulta !== null}
            tintColor={t.textoSecundario}
            colors={[t.destaque]}
            progressBackgroundColor={t.superficie}
          />
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
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  engrenagem: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  engrenagemTexto: { fontSize: 24 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  erro: { fontSize: 15 },
  carregando: { marginVertical: 24 },
  vazio: { padding: 16, borderRadius: 8, gap: 12, alignItems: 'flex-start' },
  vazioTexto: { fontSize: 16 },
  botao: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botaoTexto: { fontWeight: '700', fontSize: 15 },
});
