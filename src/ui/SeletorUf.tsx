import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UFS } from '@/lib/ufs';
import { useTema } from './tema';

interface Props {
  visivel: boolean;
  atual: string;
  /** Mostrar a opção "Brasil" (só faz sentido para cargos nacionais). */
  incluirBrasil: boolean;
  aoEscolher: (uf: string) => void;
  aoFechar: () => void;
}

export function SeletorUf({ visivel, atual, incluirBrasil, aoEscolher, aoFechar }: Props) {
  const t = useTema();
  const itens = [...(incluirBrasil ? [{ uf: 'br', nome: 'Brasil' }] : []), ...UFS];
  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar}>
      <SafeAreaView style={[styles.tela, { backgroundColor: t.fundo }]}>
        <View style={[styles.topo, { borderBottomColor: t.borda }]}>
          <Text style={[styles.titulo, { color: t.texto }]} accessibilityRole="header">
            Escolha a abrangência
          </Text>
          <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
            <Text style={[styles.fechar, { color: t.destaque }]}>Fechar</Text>
          </Pressable>
        </View>
        <FlatList
          data={itens}
          keyExtractor={(i) => i.uf}
          renderItem={({ item }) => {
            const sel = item.uf === atual;
            return (
              <Pressable
                onPress={() => aoEscolher(item.uf)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[styles.item, { borderBottomColor: t.borda }, sel && { backgroundColor: t.superficie }]}
              >
                <Text style={[styles.nome, { color: t.texto }, sel && styles.sel]}>{item.nome}</Text>
                <Text style={[styles.sigla, { color: t.textoSecundario }]}>{item.uf === 'br' ? '' : item.uf.toUpperCase()}</Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: 20, fontWeight: '800' },
  fechar: { fontSize: 16, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nome: { fontSize: 17 },
  sel: { fontWeight: '800' },
  sigla: { fontSize: 15 },
});
