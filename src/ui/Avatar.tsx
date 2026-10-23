import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { iniciais } from '@/lib/format';
import { corTextoSobre } from '@/lib/partidos';
import { Foto } from './Foto';

interface Props {
  nome: string;
  cor: string;
  /** URL da foto oficial; sem URL (ou se falhar), mostra as iniciais. */
  foto?: string | null;
  tamanho?: number;
}

/** Foto circular do candidato com fallback para iniciais na cor do partido. */
export function Avatar({ nome, cor, foto, tamanho = 48 }: Props) {
  // Guarda QUAL URL falhou: se a foto mudar (outra aba, outro candidato), tenta de novo.
  const [falhou, setFalhou] = useState<string | null>(null);
  const estilo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: cor };

  if (foto && falhou !== foto) {
    return (
      <Foto uri={foto} tamanho={tamanho} estilo={[styles.base, estilo]} onError={() => setFalhou(foto)} />
    );
  }
  return (
    <View style={[styles.base, estilo, { backgroundColor: cor }]} accessible={false}>
      <Text style={[styles.iniciais, { color: corTextoSobre(cor), fontSize: tamanho * 0.36 }]} allowFontScaling={false}>
        {iniciais(nome)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iniciais: { fontWeight: '700' },
});
