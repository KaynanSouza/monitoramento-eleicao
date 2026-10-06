import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@/db/sql';
import { montarSerie } from './serie';

const MIN = 60_000;
const T0 = Date.parse('2026-10-25T17:00:00-03:00');

function snap(capturaMin: number, tseMin: number | null, pctA: number): Snapshot {
  return {
    eleicao: '6258',
    turno: 2,
    cargo: '1',
    abrangencia: 'br',
    capturadoEm: T0 + capturaMin * MIN,
    atualizadoEm: tseMin === null ? null : new Date(T0 + tseMin * MIN).toISOString(),
    pctSecoes: capturaMin,
    totalizacaoFinal: false,
    segundoPlano: false,
    candidatos: [
      { sqcand: 'a', numero: '22', nomeUrna: 'A', partido: '22', sigla: 'PL', votos: pctA * 10, pct: pctA },
      { sqcand: 'b', numero: '13', nomeUrna: 'B', partido: '13', sigla: 'PT', votos: (100 - pctA) * 10, pct: 100 - pctA },
    ],
  };
}

describe('montarSerie', () => {
  it('sem snapshots: série vazia (1º turno não gravado)', () => {
    expect(montarSerie([])).toEqual({ gravadoDesde: null, candidatos: [], segmentos: [] });
  });

  it('quebra em segmentos quando o app ficou sem observar', () => {
    const s = montarSerie([snap(0, 0, 60), snap(1, 1, 58), snap(2, 2, 55), snap(30, 29, 51), snap(31, 30, 50)]);
    expect(s.gravadoDesde).toBe(T0);
    expect(s.segmentos.map((g) => g.length)).toEqual([3, 2]);
    expect(s.segmentos[1]![0]!.pct).toEqual({ a: 51, b: 49 });
  });

  it('não duplica a mesma totalização observada várias vezes', () => {
    const s = montarSerie([snap(0, 0, 60), snap(1, 0, 60), snap(2, 2, 55)]);
    expect(s.segmentos[0]!.map((p) => (p.t - T0) / MIN)).toEqual([0, 2]);
  });

  it('ignora snapshots sem totalização e ordena candidatos pelo último', () => {
    const s = montarSerie([snap(0, null, 0), snap(1, 1, 40)]);
    expect(s.segmentos).toHaveLength(1);
    expect(s.candidatos.map((c) => c.sqcand)).toEqual(['b', 'a']);
  });
});
