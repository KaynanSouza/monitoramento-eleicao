import { StyleSheet, Text, View } from 'react-native';
import { formatDataHora, formatHora } from '@/lib/format';
import type { DadosTela } from './useApuracao';
import { useTema } from './tema';

/** Avisos de dado antigo (offline / pausa por erro do TSE) e modo replay. */
export function AvisosDados({ dados }: { dados: DadosTela | undefined }) {
  const t = useTema();
  if (!dados) return null;
  const avisos: string[] = [];
  if (dados.modo === 'replay') {
    avisos.push(
      dados.resultado.turno === 2
        ? '2º turno SIMULADO (modo replay): candidatos reais do 1º turno, números fictícios. Não é resultado.'
        : 'Modo replay: simulação a partir dos arquivos do 1º turno, sem acesso ao TSE.',
    );
  }
  if (dados.origem === 'offline') {
    const verificado = new Date(dados.verificadoEm).toISOString();
    avisos.push(`Sem conexão com o TSE. Mostrando os dados verificados às ${formatHora(verificado)}.`);
  }
  if (dados.pausaAte) {
    avisos.push(`O TSE pediu uma pausa. Nova tentativa às ${formatHora(new Date(dados.pausaAte).toISOString())}.`);
  }
  if (!avisos.length) return null;
  return (
    <View style={[styles.aviso, { backgroundColor: t.aviso }]} accessibilityRole="alert">
      {avisos.map((a) => (
        <Text key={a} style={[styles.avisoTexto, { color: t.avisoTexto }]}>
          {a}
        </Text>
      ))}
    </View>
  );
}

export function Rodape({ dados }: { dados: DadosTela | undefined }) {
  const t = useTema();
  return (
    <View style={styles.rodape}>
      {dados && (
        <>
          <Text style={[styles.linha, { color: t.texto }]}>
            {dados.resultado.secoes.pctTexto}% das urnas apuradas
          </Text>
          <Text style={[styles.linha, { color: t.textoSecundario }]}>
            Apuração atualizada em {formatDataHora(dados.resultado.atualizadoEm)} (horário de Brasília)
          </Text>
          <Text style={[styles.linha, { color: t.textoSecundario }]}>
            Conferido no TSE às {formatHora(new Date(dados.verificadoEm).toISOString())}
            {dados.origem === 'offline' ? ' (sem conexão desde então)' : ''}
          </Text>
        </>
      )}
      <Text style={[styles.fonte, { color: t.textoSecundario }]}>Fonte: TSE (divulgação oficial)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: { padding: 12, borderRadius: 8, gap: 4 },
  avisoTexto: { fontSize: 14 },
  rodape: { padding: 16, gap: 4 },
  linha: { fontSize: 14 },
  fonte: { fontSize: 13, marginTop: 8 },
});
