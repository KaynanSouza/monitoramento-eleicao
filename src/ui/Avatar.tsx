import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { iniciais } from '@/lib/format';
import { corTextoSobre } from '@/lib/partidos';

interface Props {
  nome: string;
  cor: string;
  /** URL da foto oficial; sem URL (ou se falhar), mostra as iniciais. */
  foto?: string | null;
  tamanho?: number;
}

/** Foto circular do candidato com fallback para iniciais na cor do partido. */
export function Avatar({ nome, cor, foto, tamanho = 48 }: Props) {
  const [falhou, setFalhou] = useState(false);
  const estilo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: cor };

  if (foto && !falhou) {
    return (
      <Image
        source={foto}
        style={[styles.base, estilo]}
        cachePolicy="disk"
        contentFit="cover"
        recyclingKey={foto}
        onError={() => setFalhou(true)}
        accessible={false}
      />
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
