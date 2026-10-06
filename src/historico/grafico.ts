/**
 * Geometria do gráfico "Evolução da apuração" (funções puras, sem UI).
 * Eixo Y: % dos válidos, de 0 até um teto "redondo" (mínimo 55%, como no G1).
 * Eixo X: horário da totalização do TSE.
 */
import type { PontoSerie, SerieEvolucao } from './serie';

export interface Area {
  largura: number;
  altura: number;
  margem: { esq: number; dir: number; topo: number; base: number };
}

export interface Escalas {
  yMax: number;
  tMin: number;
  tMax: number;
  x: (t: number) => number;
  y: (pct: number) => number;
  ticksY: number[];
  ticksX: number[];
}

/** Teto do eixo Y: múltiplo de 5 acima do maior valor (com folga), nunca menos que 55. */
export function tetoY(maximo: number): number {
  return Math.min(100, Math.max(55, Math.ceil((maximo + 2) / 5) * 5));
}

export function escalas(serie: SerieEvolucao, area: Area): Escalas | null {
  const pontos = serie.segmentos.flat();
  if (pontos.length === 0) return null;
  const ids = serie.candidatos.map((c) => c.sqcand);
  let maximo = 0;
  for (const p of pontos) for (const id of ids) maximo = Math.max(maximo, p.pct[id] ?? 0);

  const yMax = tetoY(maximo);
  const tMin = pontos[0]!.t;
  let tMax = pontos[pontos.length - 1]!.t;
  if (tMax === tMin) tMax = tMin + 60_000; // um único ponto: evita divisão por zero

  const { largura, altura, margem } = area;
  const w = Math.max(1, largura - margem.esq - margem.dir);
  const h = Math.max(1, altura - margem.topo - margem.base);
  const x = (t: number) => margem.esq + ((t - tMin) / (tMax - tMin)) * w;
  const y = (pct: number) => margem.topo + h - (Math.min(pct, yMax) / yMax) * h;

  const passoY = yMax > 60 ? 20 : 10;
  const ticksY: number[] = [];
  for (let v = 0; v <= yMax; v += passoY) ticksY.push(v);

  return { yMax, tMin, tMax, x, y, ticksY, ticksX: ticksHorario(tMin, tMax) };
}

/** Marcas de horário em intervalos "redondos" (15 min, 30 min, 1 h, 2 h). */
export function ticksHorario(tMin: number, tMax: number, maximoTicks = 5): number[] {
  const MIN = 60_000;
  const passos = [5, 10, 15, 30, 60, 120, 180].map((m) => m * MIN);
  const passo = passos.find((p) => (tMax - tMin) / p <= maximoTicks) ?? 240 * MIN;
  const inicio = Math.ceil(tMin / passo) * passo;
  const ticks: number[] = [];
  for (let t = inicio; t <= tMax; t += passo) ticks.push(t);
  return ticks;
}

/** Caminho SVG de um candidato dentro de um segmento contínuo. */
export function caminho(pontos: PontoSerie[], sqcand: string, e: Escalas): string {
  return pontos
    .filter((p) => p.pct[sqcand] !== undefined)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${e.x(p.t).toFixed(1)},${e.y(p.pct[sqcand]!).toFixed(1)}`)
    .join(' ');
}

/** Ligações tracejadas entre o fim de um segmento e o início do próximo (lacunas). */
export function lacunas(
  serie: SerieEvolucao,
  sqcand: string,
  e: Escalas,
): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < serie.segmentos.length; i++) {
    const a = serie.segmentos[i - 1]!.at(-1);
    const b = serie.segmentos[i]![0];
    const va = a?.pct[sqcand];
    const vb = b?.pct[sqcand];
    if (a && b && va !== undefined && vb !== undefined) {
      out.push({ x1: e.x(a.t), y1: e.y(va), x2: e.x(b.t), y2: e.y(vb) });
    }
  }
  return out;
}

/** Ponto observado mais próximo da coordenada x (para o cursor). */
export function pontoMaisProximo(serie: SerieEvolucao, e: Escalas, xToque: number): PontoSerie | null {
  let melhor: PontoSerie | null = null;
  let dist = Infinity;
  for (const p of serie.segmentos.flat()) {
    const d = Math.abs(e.x(p.t) - xToque);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}
