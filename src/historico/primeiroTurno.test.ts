import { describe, expect, it } from 'vitest';
import { normalizarResultado } from '@/tse/normalize';
import { lerFixture } from '@/test/fixtures';
import { snapshotsPrimeiroTurno } from './primeiroTurno';
import { janelaDoDia, montarSerie } from './serie';

const ESCOPOS = [
  ['6257', '1', 'br'],
  ['6257', '1', 'sp'],
  ['6259', '3', 'rj'],
  ['6259', '5', 'mg'],
] as const;

describe('evolução reconstruída do 1º turno (arquivos do TSE)', () => {
  it.each(ESCOPOS)('%s cargo %s %s: dentro do dia, crescente e termina no resultado oficial', (ele, cargo, uf) => {
    const snaps = snapshotsPrimeiroTurno(ele, cargo, uf)!;
    expect(snaps.length).toBeGreaterThan(10);
    const j = janelaDoDia('04/10/2026')!;
    const ts = snaps.map((s) => Date.parse(s.atualizadoEm!));
    expect(ts.every((t) => t >= j.inicio && t < j.fim)).toBe(true);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    // Nada antes das 17h (início da divulgação); a UF começa quando o 1º município termina.
    expect(ts[0]).toBeGreaterThanOrEqual(Date.parse('2026-10-04T17:00:00-03:00'));
    const secoes = snaps.map((s) => s.pctSecoes);
    expect(secoes).toEqual([...secoes].sort((a, b) => a - b));
    expect(secoes.at(-1)).toBeGreaterThan(99);

    const arq = `oficial/ele2026/${ele}/dados/${uf}/${uf}-c000${cargo}-e00${ele}-u.json`;
    const oficial = normalizarResultado(lerFixture(arq), arq).candidatos;
    for (const c of snaps.at(-1)!.candidatos) {
      expect(Math.abs(c.pct - oficial.find((o) => o.sqcand === c.sqcand)!.pct)).toBeLessThan(0.1);
    }
  });

  it('vira uma série contínua (sem trechos tracejados) e marcada como reconstruída', () => {
    const s = montarSerie(snapshotsPrimeiroTurno('6257', '1', 'br')!, { lacunaMs: Infinity, origem: 'reconstruido' });
    expect(s.origem).toBe('reconstruido');
    expect(s.segmentos).toHaveLength(1);
    expect(s.candidatos.map((c) => c.nomeUrna).slice(0, 2)).toEqual(['FLAVIO BOLSONARO', 'LULA']);
  });

  it('sem reconstrução para 2º turno nem proporcionais', () => {
    expect(snapshotsPrimeiroTurno('6258', '1', 'br')).toBeNull();
    expect(snapshotsPrimeiroTurno('6259', '6', 'sp')).toBeNull();
  });
});
