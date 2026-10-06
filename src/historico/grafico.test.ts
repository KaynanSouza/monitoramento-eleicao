import { describe, expect, it } from 'vitest';
import { type Area, caminho, escalas, lacunas, pontoMaisProximo, tetoY, ticksHorario } from './grafico';
import type { SerieEvolucao } from './serie';

const MIN = 60_000;
const T0 = Date.parse('2026-10-25T17:00:00-03:00');
const area: Area = { largura: 340, altura: 240, margem: { esq: 40, dir: 0, topo: 0, base: 40 } };

const serie: SerieEvolucao = {
  gravadoDesde: T0,
  candidatos: [
    { sqcand: 'a', numero: '22', nomeUrna: 'A', partido: '22', sigla: 'PL' },
    { sqcand: 'b', numero: '13', nomeUrna: 'B', partido: '13', sigla: 'PT' },
  ],
  segmentos: [
    [
      { t: T0, pctSecoes: 1, pct: { a: 60, b: 40 } },
      { t: T0 + 30 * MIN, pctSecoes: 20, pct: { a: 55, b: 45 } },
    ],
    [{ t: T0 + 120 * MIN, pctSecoes: 90, pct: { a: 49, b: 51 } }],
  ],
};

describe('geometria do gráfico', () => {
  it('teto do eixo Y: mínimo 55%, múltiplo de 5', () => {
    expect(tetoY(47)).toBe(55);
    expect(tetoY(53.5)).toBe(60);
    expect(tetoY(62.65)).toBe(65);
    expect(tetoY(99)).toBe(100);
  });

  it('escalas: extremos mapeados para a área útil', () => {
    const e = escalas(serie, area)!;
    expect(e.yMax).toBe(65);
    expect(e.x(T0)).toBe(40);
    expect(e.x(T0 + 120 * MIN)).toBe(340);
    expect(e.y(0)).toBe(200);
    expect(e.y(65)).toBe(0);
    expect(e.ticksY).toEqual([0, 20, 40, 60]); // acima de 60%, marcas de 20 em 20
    expect(escalas({ ...serie, segmentos: [[{ t: T0, pctSecoes: 1, pct: { a: 47, b: 45 } }]] }, area)!.ticksY).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('série vazia → sem escalas', () => {
    expect(escalas({ gravadoDesde: null, candidatos: [], segmentos: [] }, area)).toBeNull();
  });

  it('caminho por segmento e ligação tracejada na lacuna', () => {
    const e = escalas(serie, area)!;
    expect(caminho(serie.segmentos[0]!, 'a', e)).toMatch(/^M40\.0,\d+\.\d L\d+\.\d,\d+\.\d$/);
    const l = lacunas(serie, 'a', e);
    expect(l).toHaveLength(1);
    expect(l[0]!.x1).toBeCloseTo(e.x(T0 + 30 * MIN));
    expect(l[0]!.x2).toBe(340);
  });

  it('cursor pega o ponto observado mais próximo', () => {
    const e = escalas(serie, area)!;
    expect(pontoMaisProximo(serie, e, 330)?.pctSecoes).toBe(90);
    expect(pontoMaisProximo(serie, e, 60)?.pctSecoes).toBe(1); // x(T0)=40 está a 20 px; x(17h30)=115 a 55 px
  });

  it('marcas de horário redondas', () => {
    expect(ticksHorario(T0, T0 + 120 * MIN).map((t) => (t - T0) / MIN)).toEqual([0, 30, 60, 90, 120]);
    expect(ticksHorario(T0 + 7 * MIN, T0 + 300 * MIN).map((t) => (t - T0) / MIN)).toEqual([60, 120, 180, 240, 300]);
  });
});
