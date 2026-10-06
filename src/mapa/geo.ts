/**
 * Malha pré-projetada (gerada por scripts/build-geo.ts): coordenadas inteiras num
 * plano largura × altura, anéis como [x0, y0, x1, y1, ...]. Furos e ilhas são
 * tratados pela regra par-ímpar (fillRule="evenodd" e no teste de toque).
 */

export interface Forma {
  /** bbox [x0, y0, x1, y1] */
  b: [number, number, number, number];
  r: number[][];
}

export interface MunicipioGeo extends Forma {
  i: string; // código IBGE
  u: string; // UF
}

export interface Malha {
  largura: number;
  altura: number;
  ufs: (Forma & { uf: string })[];
  mun: MunicipioGeo[];
}

/** Anéis → atributo `d` do SVG ("M x,y x,y ... Z"). */
export function caminhoAneis(aneis: number[][]): string {
  let d = '';
  for (const a of aneis) {
    d += `M${a[0]},${a[1]}`;
    for (let i = 2; i < a.length; i += 2) d += ` ${a[i]},${a[i + 1]}`;
    d += 'Z';
  }
  return d;
}

/** Ponto dentro de um conjunto de anéis (regra par-ímpar: furos contam como fora). */
export function pontoNosAneis(x: number, y: number, aneis: number[][]): boolean {
  let dentro = false;
  for (const a of aneis) {
    for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
      const xi = a[i]!;
      const yi = a[i + 1]!;
      const xj = a[j]!;
      const yj = a[j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

const naCaixa = (x: number, y: number, b: Forma['b']) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/** Município sob o ponto (coordenadas da malha), opcionalmente limitado a uma UF. */
export function municipioEm(malha: Malha, x: number, y: number, uf?: string): MunicipioGeo | null {
  for (const m of malha.mun) {
    if (uf && m.u !== uf) continue;
    if (naCaixa(x, y, m.b) && pontoNosAneis(x, y, m.r)) return m;
  }
  return null;
}

export function ufEm(malha: Malha, x: number, y: number): string | null {
  for (const u of malha.ufs) if (naCaixa(x, y, u.b) && pontoNosAneis(x, y, u.r)) return u.uf;
  return null;
}

/** Caixa que envolve um conjunto de formas, com margem proporcional. */
export function caixaDe(formas: Forma[], margem = 0.04): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of formas) {
    x0 = Math.min(x0, f.b[0]);
    y0 = Math.min(y0, f.b[1]);
    x1 = Math.max(x1, f.b[2]);
    y1 = Math.max(y1, f.b[3]);
  }
  const mx = (x1 - x0) * margem;
  const my = (y1 - y0) * margem;
  return [x0 - mx, y0 - my, x1 + mx, y1 + my];
}

/** Cache de `d` por município (calculado uma vez por sessão). */
const caminhos = new Map<string, string>();
export function caminhoMunicipio(m: MunicipioGeo): string {
  let d = caminhos.get(m.i);
  if (d === undefined) {
    d = caminhoAneis(m.r);
    caminhos.set(m.i, d);
  }
  return d;
}

export type Caixa = [number, number, number, number];

/**
 * Converte um toque na tela para coordenadas da malha.
 * - `largura`/`altura`: tamanho da área do mapa na tela;
 * - `caixa`: viewBox mostrado (encaixado com preserveAspectRatio "xMidYMid meet");
 * - `escala`, `tx`, `ty`: transformação do zoom (escala em torno do centro da área, depois translação).
 */
export function telaParaMalha(
  px: number,
  py: number,
  largura: number,
  altura: number,
  caixa: Caixa,
  escala = 1,
  tx = 0,
  ty = 0,
): [number, number] {
  const cx = largura / 2;
  const cy = altura / 2;
  // desfaz o zoom/arraste
  const x = (px - cx - tx) / escala + cx;
  const y = (py - cy - ty) / escala + cy;
  // desfaz o encaixe do viewBox
  const vw = caixa[2] - caixa[0];
  const vh = caixa[3] - caixa[1];
  const k = Math.min(largura / vw, altura / vh);
  const ox = (largura - vw * k) / 2;
  const oy = (altura - vh * k) / 2;
  return [caixa[0] + (x - ox) / k, caixa[1] + (y - oy) / k];
}
