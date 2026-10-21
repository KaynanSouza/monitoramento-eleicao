import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  FILTRO_VAZIO,
  type FiltroCandidatos as Filtro,
  type FiltroSituacao,
  filtroAtivo,
  type ResumoPartido,
} from '@/lib/candidatos';
import { formatInteiro } from '@/lib/format';
import { corPartido, corTextoSobre } from '@/lib/partidos';
import { useTema } from './tema';

interface Props {
  filtro: Filtro;
  aoMudar: (f: Filtro) => void;
  partidos: ResumoPartido[];
  /** Candidatos exibidos / total da lista. */
  exibidos: number;
  total: number;
  /** Só mostra "Eleitos"/"Suplentes" quando o TSE já publicou a situação. */
  comSituacao: boolean;
}

const SITUACOES: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'eleitos', rotulo: 'Eleitos' },
  { valor: 'suplentes', rotulo: 'Suplentes' },
];

/** Busca por nome/número e filtros por situação e partido (listas grandes dos proporcionais). */
export function FiltroCandidatos({ filtro, aoMudar, partidos, exibidos, total, comSituacao }: Props) {
  const t = useTema();
  return (
    <View style={styles.bloco}>
      <TextInput
        value={filtro.busca}
        onChangeText={(busca) => aoMudar({ ...filtro, busca })}
        placeholder="Buscar candidato por nome ou número"
        placeholderTextColor={t.textoSecundario}
        style={[styles.busca, { color: t.texto, backgroundColor: t.superficie, borderColor: t.borda }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Buscar candidato por nome ou número"
      />

      {comSituacao && (
        <View style={styles.linha} accessibilityRole="radiogroup">
          {SITUACOES.map((s) => (
            <Chip
              key={s.valor}
              rotulo={s.rotulo}
              ativo={filtro.situacao === s.valor}
              aoTocar={() => aoMudar({ ...filtro, situacao: s.valor })}
            />
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.linha}
        keyboardShouldPersistTaps="handled"
      >
        <Chip rotulo="Todos os partidos" ativo={filtro.partido === null} aoTocar={() => aoMudar({ ...filtro, partido: null })} />
        {partidos.map((p) => (
          <Chip
            key={p.numero}
            rotulo={p.eleitos ? `${p.sigla} · ${p.eleitos}` : p.sigla}
            cor={corPartido(p.numero)}
            ativo={filtro.partido === p.numero}
            aoTocar={() => aoMudar({ ...filtro, partido: filtro.partido === p.numero ? null : p.numero })}
            descricao={`${p.sigla}, ${p.candidatos} candidatos${p.eleitos ? `, ${p.eleitos} eleitos` : ''}`}
          />
        ))}
      </ScrollView>

      <View style={styles.rodape}>
        <Text style={[styles.contagem, { color: t.textoSecundario }]} accessibilityLiveRegion="polite">
          {filtroAtivo(filtro)
            ? `${formatInteiro(exibidos)} de ${formatInteiro(total)} candidatos`
            : `${formatInteiro(total)} candidatos`}
        </Text>
        {filtroAtivo(filtro) && (
          <Pressable onPress={() => aoMudar(FILTRO_VAZIO)} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.limpar, { color: t.destaque }]}>Limpar filtros</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Chip({
  rotulo,
  ativo,
  aoTocar,
  cor,
  descricao,
}: {
  rotulo: string;
  ativo: boolean;
  aoTocar: () => void;
  cor?: string;
  descricao?: string;
}) {
  const t = useTema();
  const fundo = ativo ? (cor ?? t.destaque) : t.superficie;
  const texto = ativo ? (cor ? corTextoSobre(cor) : t.destaqueTexto) : t.texto;
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={descricao ?? rotulo}
      style={[styles.chip, { backgroundColor: fundo, borderColor: ativo ? fundo : t.borda }]}
    >
      {cor && !ativo && <View style={[styles.ponto, { backgroundColor: cor }]} />}
      <Text style={[styles.chipTexto, { color: texto }]} numberOfLines={1}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 10 },
  busca: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, minHeight: 44 },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  chipTexto: { fontSize: 14, fontWeight: '600' },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contagem: { fontSize: 13, fontVariant: ['tabular-nums'] },
  limpar: { fontSize: 14, fontWeight: '700' },
});
