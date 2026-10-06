import type { Candidato } from '@/tse/types';

export interface LiderMargem {
  lider: Candidato;
  segundo: Candidato | null;
  /** Diferença em pontos percentuais entre 1º e 2º (dos válidos). */
  margem: number;
}

/** Líder e margem sobre o 2º colocado. Null se não houver votos apurados. */
export function liderEMargem(candidatos: Candidato[]): LiderMargem | null {
  const validos = candidatos.filter((c) => c.votoValido).sort((a, b) => b.votos - a.votos);
  const [lider, segundo = null] = validos;
  if (!lider || lider.votos === 0) return null;
  return { lider, segundo, margem: lider.pct - (segundo?.pct ?? 0) };
}

/** Limites (em p.p.) dos degraus de intensidade do mapa: <5, <10, <20, <35, ≥35. */
export const DEGRAUS_MARGEM = [5, 10, 20, 35] as const;

/** Margem em p.p. → degrau 0 (disputa apertada) a 4 (vitória ampla). */
export function degrauMargem(margem: number): 0 | 1 | 2 | 3 | 4 {
  const i = DEGRAUS_MARGEM.findIndex((lim) => margem < lim);
  return (i === -1 ? 4 : i) as 0 | 1 | 2 | 3 | 4;
}
