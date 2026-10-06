import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatInteiro } from '@/lib/format';
import type { CargoDisponivel } from '@/tse/eleicoes';
import type { Resultado } from '@/tse/types';
import { useTema } from './tema';

export function SeloStatus({ resultado }: { resultado: Resultado | undefined }) {
  const t = useTema();
  if (!resultado) return null;
  const concluida = resultado.totalizacaoFinal;
  const naoIniciada = !concluida && resultado.secoes.totalizadas === 0;
  const texto = concluida ? 'Apuração concluída' : naoIniciada ? 'Aguardando início da apuração' : 'Apuração em andamento';
  return (
    <View style={styles.statusLinha}>
      <View
        style={[styles.status, { backgroundColor: concluida ? t.sucesso : t.andamento }]}
        accessibilityRole="text"
        accessibilityLabel={texto}
      >
        <Text style={[styles.statusTexto, { color: concluida ? t.sucessoTexto : t.andamentoTexto }]}>
          {concluida ? '✓ ' : '● '}
          {texto}
        </Text>
      </View>
      {resultado.mensagem && (
        <Text style={[styles.mensagem, { color: t.textoSecundario }]}>{resultado.mensagem}</Text>
      )}
    </View>
  );
}

export function SeletorAbrangencia({ nome, aoTocar }: { nome: string; aoTocar: () => void }) {
  const t = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={`Abrangência: ${nome}. Tocar para trocar o estado`}
      style={styles.abrangencia}
      hitSlop={8}
    >
      <Text style={[styles.abrangenciaTexto, { color: t.texto }]}>{nome}</Text>
      <Text style={[styles.seta, { color: t.textoSecundario }]}>▾</Text>
    </Pressable>
  );
}

const ROTULOS: Record<string, string> = { 'Deputado Federal': 'Dep. Federal' };

export function AbasCargo({
  cargos,
  ativo,
  aoEscolher,
}: {
  cargos: CargoDisponivel[];
  ativo: string;
  aoEscolher: (codigo: string) => void;
}) {
  const t = useTema();
  return (
    <View style={[styles.abas, { borderBottomColor: t.borda }]} accessibilityRole="tablist">
      {cargos.map((c) => {
        const sel = c.codigo === ativo;
        return (
          <Pressable
            key={c.codigo}
            onPress={() => aoEscolher(c.codigo)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={c.nome}
            style={[styles.aba, sel && { borderBottomColor: t.destaque }]}
          >
            <Text
              style={[styles.abaTexto, { color: sel ? t.texto : t.textoSecundario }, sel && styles.abaAtiva]}
              numberOfLines={1}
            >
              {ROTULOS[c.nome] ?? c.nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BarraSecoes({ resultado }: { resultado: Resultado }) {
  const t = useTema();
  const { pct, pctTexto, totalizadas, total } = resultado.secoes;
  const completa = pct >= 100;
  return (
    <View
      style={styles.secoes}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Seções apuradas: ${pctTexto} por cento, ${formatInteiro(totalizadas)} de ${formatInteiro(total)}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Text style={[styles.secoesTitulo, { color: t.textoSecundario }]}>Seções apuradas</Text>
      <View style={styles.secoesLinha}>
        <Text style={[styles.secoesPct, { color: t.texto }]}>{pctTexto}%</Text>
        <Text style={[styles.secoesQtd, { color: t.textoSecundario }]}>
          {formatInteiro(totalizadas)} de {formatInteiro(total)}
        </Text>
      </View>
      <View style={[styles.secoesTrilho, { backgroundColor: t.trilho }]}>
        <View
          style={[
            styles.secoesBarra,
            { width: `${Math.min(100, pct)}%`, backgroundColor: completa ? t.sucesso : t.textoSecundario },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusLinha: { gap: 6 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusTexto: { fontSize: 13, fontWeight: '700' },
  mensagem: { fontSize: 13 },
  abrangencia: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  abrangenciaTexto: { fontSize: 34, fontWeight: '800' },
  seta: { fontSize: 22 },
  abas: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  abaTexto: { fontSize: 14 },
  abaAtiva: { fontWeight: '800' },
  secoes: { gap: 6 },
  secoesTitulo: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  secoesLinha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' },
  secoesPct: { fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  secoesQtd: { fontSize: 14, fontVariant: ['tabular-nums'] },
  secoesTrilho: { height: 14, borderRadius: 7, overflow: 'hidden' },
  secoesBarra: { height: 14, borderRadius: 7 },
});
