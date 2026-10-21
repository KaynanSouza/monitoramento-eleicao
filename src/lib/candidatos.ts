/**
 * Busca, filtro e ordenação da lista de candidatos. Pensado para os proporcionais
 * (Dep. Federal em SP: ~1.000 candidatos): a chave de busca de cada candidato é
 * calculada uma vez por lista e reaproveitada a cada tecla.
 */
import type { Candidato, Situacao } from '@/tse/types';

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/**
 * "José da Silva" → "jose da silva". Tabela própria em vez de `normalize('NFD')`,
 * cujo suporte no Hermes depende do Intl do aparelho (mesma razão do lib/format).
 */
export function chaveBusca(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (ch) => ACENTOS[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
}

export type FiltroSituacao = 'todos' | 'eleitos' | 'suplentes';

export interface FiltroCandidatos {
  /** Nome de urna, nome civil ou início do número. */
  busca: string;
  /** Número do partido; null = todos. */
  partido: string | null;
  situacao: FiltroSituacao;
}

export const FILTRO_VAZIO: FiltroCandidatos = { busca: '', partido: null, situacao: 'todos' };

export function filtroAtivo(f: FiltroCandidatos): boolean {
  return f.busca.trim() !== '' || f.partido !== null || f.situacao !== 'todos';
}

const indices = new WeakMap<readonly Candidato[], string[]>();

function indice(lista: readonly Candidato[]): string[] {
  let i = indices.get(lista);
  if (!i) {
    i = lista.map((c) => `${chaveBusca(c.nomeUrna)}|${chaveBusca(c.nome)}`);
    indices.set(lista, i);
  }
  return i;
}

const SITUACOES: Record<Exclude<FiltroSituacao, 'todos'>, Situacao> = {
  eleitos: 'eleito',
  suplentes: 'suplente',
};

/** Mantém a ordem recebida (votos desc). Busca numérica casa pelo início do número. */
export function filtrarCandidatos(lista: readonly Candidato[], f: FiltroCandidatos): Candidato[] {
  if (!filtroAtivo(f)) return lista as Candidato[];
  const termo = chaveBusca(f.busca);
  const numerico = /^\d+$/.test(termo);
  const chaves = indice(lista);
  const situacao = f.situacao === 'todos' ? null : SITUACOES[f.situacao];
  const saida: Candidato[] = [];
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i]!;
    if (f.partido !== null && c.partido.numero !== f.partido) continue;
    if (situacao && c.situacao !== situacao) continue;
    if (termo && !(numerico ? c.numero.startsWith(termo) : chaves[i]!.includes(termo))) continue;
    saida.push(c);
  }
  return saida;
}

export interface ResumoPartido {
  numero: string;
  sigla: string;
  candidatos: number;
  eleitos: number;
  votos: number;
}

/** Partidos presentes na lista, para os filtros: mais eleitos primeiro, depois mais votos. */
export function partidosDaLista(lista: readonly Candidato[]): ResumoPartido[] {
  const mapa = new Map<string, ResumoPartido>();
  for (const c of lista) {
    let p = mapa.get(c.partido.numero);
    if (!p) {
      p = { numero: c.partido.numero, sigla: c.partido.sigla, candidatos: 0, eleitos: 0, votos: 0 };
      mapa.set(p.numero, p);
    }
    p.candidatos++;
    p.votos += c.votos;
    if (c.situacao === 'eleito') p.eleitos++;
  }
  return [...mapa.values()].sort((a, b) => b.eleitos - a.eleitos || b.votos - a.votos);
}
