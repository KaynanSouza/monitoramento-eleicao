import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDataHora, formatInteiro } from '@/lib/format';
import { obterServicos } from '@/servicos';

// Prévia provisória da fase 3 (verifica coletor, cache e histórico no aparelho).
// A tela de apuração de verdade entra na fase 4.
export default function Apuracao() {
  const q = useQuery({
    queryKey: ['previa', 1, '1', 'br'],
    queryFn: async () => {
      const s = await obterServicos();
      const r = await s.apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
      const hist = await s.historico.listar({ eleicao: r.eleicao.codigo, cargo: '1', abrangencia: 'br' });
      return { ...r, modo: s.modo, snapshots: hist.length };
    },
    refetchInterval: 15_000,
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Apuração 2026</Text>
      {q.isPending && <ActivityIndicator />}
      {q.error && <Text style={styles.erro}>{(q.error as Error).message}</Text>}
      {q.data && (
        <View style={styles.bloco}>
          <Text>
            Modo {q.data.modo} · eleição {q.data.eleicao.codigo} · {q.data.origem} · {q.data.snapshots} snapshots
          </Text>
          <Text>
            Seções: {q.data.resultado.secoes.pctTexto}% ({formatInteiro(q.data.resultado.secoes.totalizadas)} de{' '}
            {formatInteiro(q.data.resultado.secoes.total)})
          </Text>
          <Text>Atualizado em {formatDataHora(q.data.resultado.atualizadoEm)}</Text>
          {q.data.resultado.candidatos.slice(0, 5).map((c) => (
            <Text key={c.sqcand}>
              {c.nomeUrna} ({c.partido.sigla}) {c.pctTexto}% · {formatInteiro(c.votos)}
              {c.situacao !== 'pendente' ? ` [${c.situacaoTexto}]` : ''}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.fonte}>Fonte: TSE (divulgação oficial)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 64, gap: 12, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  bloco: { gap: 4 },
  erro: { color: '#B00020' },
  fonte: { color: '#555', marginTop: 16 },
});
