/** Tokens de cor dos temas claro e escuro (sem dependência de React Native, testáveis). */
export interface Tema {
  escuro: boolean;
  fundo: string;
  superficie: string;
  texto: string;
  textoSecundario: string;
  borda: string;
  trilho: string; // fundo das barras
  destaque: string; // abas ativas, links, botões
  destaqueTexto: string; // texto sobre fundo de destaque
  sucesso: string; // apuração concluída, 2º turno
  sucessoTexto: string;
  andamento: string;
  andamentoTexto: string;
  eleito: string;
  eleitoTexto: string;
  erro: string;
  aviso: string;
  avisoTexto: string;
}

export const claro: Tema = {
  escuro: false,
  fundo: '#FFFFFF',
  superficie: '#F4F5F7',
  texto: '#111418',
  textoSecundario: '#555B65',
  borda: '#DADDE2',
  trilho: '#E6E8EC',
  destaque: '#B3141B',
  destaqueTexto: '#FFFFFF',
  sucesso: '#1E7A3C',
  sucessoTexto: '#FFFFFF',
  andamento: '#FFF4D6',
  andamentoTexto: '#6B4E00',
  eleito: '#14532D',
  eleitoTexto: '#FFFFFF',
  erro: '#B00020',
  aviso: '#FFF4D6',
  avisoTexto: '#5C4300',
};

export const escuro: Tema = {
  escuro: true,
  fundo: '#0F1115',
  superficie: '#1A1D23',
  texto: '#F1F3F5',
  textoSecundario: '#A6ADB8',
  borda: '#2C313A',
  trilho: '#2A2F38',
  destaque: '#FF6B6B',
  destaqueTexto: '#1A0606',
  sucesso: '#2E9E55',
  sucessoTexto: '#04140A',
  andamento: '#3A3015',
  andamentoTexto: '#FFD873',
  eleito: '#3FB56A',
  eleitoTexto: '#0B1F12',
  erro: '#FF6B7D',
  aviso: '#3A3015',
  avisoTexto: '#FFD873',
};

