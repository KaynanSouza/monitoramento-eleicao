/**
 * Dados do mapa: líder e margem por área, cor por partido com intensidade pela
 * margem, e agrupamento das áreas por cor (um único <Path> por cor desenha
 * milhares de municípios com bom desempenho).
 */
import { degrauMargem, liderEMargem } from '@/lib/calculos';
import { corPartido } from '@/lib/partidos';
import type { Resultado } from '@/tse/types';
import { caminhoMunicipio, type Malha } from './geo';

export interface ResumoArea {
  lider: { sqcand: string; numero: string; nomeUrna: string; partido: string; sigla: string; pct: number };
  segundo: { sqcand: string; nomeUrna: string; pct: number } | null;
  /** Diferença em p.p. entre 1º e 2º. */
  margem: number;
  degrau: 0 | 1 | 2 | 3 | 4;
  pctSecoes: number;
}

export function resumir(r: Resultado): ResumoArea | null {
  const lm = liderEMargem(r.candidatos);
  if (!lm) return null;
  return {
    lider: {
      sqcand: lm.lider.sqcand,
      numero: lm.lider.numero,
      nomeUrna: lm.lider.nomeUrna,
      partido: lm.lider.partido.numero,
      sigla: lm.lider.partido.sigla,
      pct: lm.lider.pct,
    },
    segundo: lm.segundo ? { sqcand: lm.segundo.sqcand, nomeUrna: lm.segundo.nomeUrna, pct: lm.segundo.pct } : null,
    margem: lm.margem,
    degrau: degrauMargem(lm.margem),
    pctSecoes: r.secoes.pct,
  };
}

/** Intensidade da cor por degrau de margem (0 = disputa apertada, 4 = vitória ampla). */
const INTENSIDADE = [0.35, 0.5, 0.65, 0.82, 1] as const;

function misturar(cor: string, fundo: string, peso: number): string {
  const c = parseInt(cor.slice(1), 16);
  const f = parseInt(fundo.slice(1), 16);
  const canal = (s: number) => {
    const a = (c >> s) & 255;
    const b = (f >> s) & 255;
    return Math.round(b + (a - b) * peso);
  };
  return `#${((canal(16) << 16) | (canal(8) << 8) | canal(0)).toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Cor da área: cor do partido do líder, mais clara quanto menor a margem. */
export function corArea(resumo: ResumoArea, fundo: string): string {
  return misturar(corPartido(resumo.lider.partido), fundo, INTENSIDADE[resumo.degrau]);
}

export function corDegrau(partido: string, degrau: 0 | 1 | 2 | 3 | 4, fundo: string): string {
  return misturar(corPartido(partido), fundo, INTENSIDADE[degrau]);
}

export interface Camada {
  cor: string;
  d: string;
}

/** Agrupa municípios com dados por cor. Retorna também as UFs cobertas por dados municipais. */
export function camadasMunicipios(
  malha: Malha,
  resumos: Map<string, ResumoArea>,
  fundo: string,
  uf?: string,
): { camadas: Camada[]; ufsComMunicipios: Set<string> } {
  const porCor = new Map<string, string[]>();
  const ufsComMunicipios = new Set<string>();
  for (const m of malha.mun) {
    if (uf && m.u !== uf) continue;
    const r = resumos.get(m.i);
    if (!r) continue;
    ufsComMunicipios.add(m.u);
    const cor = corArea(r, fundo);
    let lista = porCor.get(cor);
    if (!lista) porCor.set(cor, (lista = []));
    lista.push(caminhoMunicipio(m));
  }
  return { camadas: [...porCor].map(([cor, ds]) => ({ cor, d: ds.join('') })), ufsComMunicipios };
}

/** Líderes presentes no mapa (para a legenda), do que lidera mais áreas para o que lidera menos. */
export function lideresNoMapa(resumos: Iterable<ResumoArea>): ResumoArea['lider'][] {
  const cont = new Map<string, { lider: ResumoArea['lider']; n: number }>();
  for (const r of resumos) {
    const c = cont.get(r.lider.sqcand);
    if (c) c.n++;
    else cont.set(r.lider.sqcand, { lider: r.lider, n: 1 });
  }
  return [...cont.values()].sort((a, b) => b.n - a.n).map((c) => c.lider);
}
