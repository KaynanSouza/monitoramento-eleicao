import type { Caixa, Malha } from './geo';
import { caixaDe, caminhoAneis } from './geo';

let malha: Malha | null = null;
const caminhosUf = new Map<string, string>();

/** Malha pré-projetada (~1,6 MB), carregada na primeira vez que um mapa aparece. */
export function obterMalha(): Malha {
  malha ??= require('./geo-brasil.json') as Malha;
  return malha;
}

export function caminhoUf(uf: string): string {
  let d = caminhosUf.get(uf);
  if (d === undefined) {
    const forma = obterMalha().ufs.find((u) => u.uf === uf);
    d = forma ? caminhoAneis(forma.r) : '';
    caminhosUf.set(uf, d);
  }
  return d;
}

/** viewBox de uma abrangência: o Brasil inteiro ou a UF. */
export function caixaAbrangencia(uf: string): Caixa {
  const m = obterMalha();
  if (uf === 'br') return [0, 0, m.largura, m.altura];
  return caixaDe(m.ufs.filter((u) => u.uf === uf));
}
