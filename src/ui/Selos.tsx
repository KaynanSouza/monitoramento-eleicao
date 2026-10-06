import { StyleSheet, Text, View } from 'react-native';
import { corPartido, corTextoSobre } from '@/lib/partidos';
import type { Situacao } from '@/tse/types';
import { useTema } from './tema';

export function SeloPartido({ numero, sigla }: { numero: string; sigla: string }) {
  const cor = corPartido(numero);
  return (
    <View style={[styles.selo, { backgroundColor: cor }]}>
      <Text style={[styles.texto, { color: corTextoSobre(cor) }]} numberOfLines={1}>
        {sigla}
      </Text>
    </View>
  );
}

/** Selo de situação: só "2º Turno" e "Eleito", e só quando o arquivo do TSE indica. */
export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const t = useTema();
  if (situacao === 'segundo_turno') {
    return (
      <View style={[styles.selo, { backgroundColor: t.sucesso }]}>
        <Text style={[styles.texto, { color: t.sucessoTexto }]}>2º Turno</Text>
      </View>
    );
  }
  if (situacao === 'eleito') {
    return (
      <View style={[styles.selo, { backgroundColor: t.eleito }]}>
        <Text style={[styles.texto, { color: t.eleitoTexto }]}>Eleito</Text>
      </View>
    );
  }
  return null;
}

/** Texto para leitores de tela. */
export function descreverSituacao(s: Situacao): string {
  if (s === 'segundo_turno') return ', vai ao 2º turno';
  if (s === 'eleito') return ', eleito';
  return '';
}

const styles = StyleSheet.create({
  selo: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  texto: { fontSize: 12, fontWeight: '700' },
});
