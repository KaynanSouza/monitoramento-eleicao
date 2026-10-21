import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@/db/sql';
import { janelaDoDia, montarSerie } from './serie';

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
    expect(montarSerie([])).toEqual({ origem: 'gravado', gravadoDesde: null, candidatos: [], segmentos: [] });
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

describe('só o dia da votação', () => {
  const DIA = 24 * 60;

  it('janela: 00h do dia até 06h do dia seguinte (Brasília), por data do ele-c ou ISO', () => {
    const j = janelaDoDia('25/10/2026')!;
    expect(j.inicio).toBe(Date.parse('2026-10-25T00:00:00-03:00'));
    expect(j.fim).toBe(Date.parse('2026-10-26T06:00:00-03:00'));
    // 23h30 de Brasília já é dia 26 em UTC: tem que cair no dia 25.
    expect(janelaDoDia('2026-10-25T23:30:00-03:00')).toEqual(j);
    expect(janelaDoDia('')).toBeNull();
    expect(janelaDoDia('lixo')).toBeNull();
  });

  it('descarta totalizações de outros dias (regerações e reaberturas do app)', () => {
    const snaps = [
      snap(0, 0, 50),
      snap(1, 1, 51),
      snap(7 * 60 + 30, 7 * 60 + 30, 52), // 00h30 do dia 26: apuração ainda pode estar correndo
      snap(3 * DIA, 3 * DIA, 53), // aberto 3 dias depois, arquivo regerado
    ];
    const s = montarSerie(snaps, { janela: janelaDoDia('25/10/2026') });
    expect(s.segmentos.flat().map((p) => p.pct.a)).toEqual([50, 51, 52]);
    expect(s.gravadoDesde).toBe(T0);
  });

  it('nada no dia da votação: série vazia (mostra o aviso de sem histórico)', () => {
    const s = montarSerie([snap(3 * DIA, 3 * DIA, 53)], { janela: janelaDoDia('25/10/2026') });
    expect(s.segmentos).toEqual([]);
  });
});
