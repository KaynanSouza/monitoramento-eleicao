import { describe, expect, it } from 'vitest';
import { lerFixture } from '@/test/fixtures';
import { normalizarResultado } from '@/tse/normalize';
import { parseDataHoraBrasilia, parsePercentual } from '@/tse/parse';
import { degrauMargem, liderEMargem } from './calculos';
import { formatDataHora, formatHora, formatInteiro, formatPct, iniciais, nomeProprio } from './format';
import { contraste, CORES_PARTIDOS, corPartido, corTextoSobre } from './partidos';

describe('parse', () => {
  it('percentuais com vírgula', () => {
    expect(parsePercentual('47,03')).toBe(47.03);
    expect(parsePercentual('47,027772356')).toBe(47.027772356);
    expect(parsePercentual('')).toBe(0);
  });

  it('data/hora de Brasília', () => {
    expect(parseDataHoraBrasilia('05/10/2026', '12:51:05')).toBe('2026-10-05T12:51:05-03:00');
    expect(parseDataHoraBrasilia('', '')).toBeNull();
  });
});

describe('formatação pt-BR', () => {
  it('milhar e decimal', () => {
    expect(formatInteiro(56104503)).toBe('56.104.503');
    expect(formatInteiro(499248)).toBe('499.248');
    expect(formatInteiro(0)).toBe('0');
    expect(formatPct(47.027772356)).toBe('47,03');
    expect(formatPct(100)).toBe('100,00');
    expect(formatPct(0.004)).toBe('0,00');
    expect(formatPct(1234.5, 1)).toBe('1.234,5');
  });

  it('horário sempre em Brasília, independente do fuso do aparelho', () => {
    expect(formatDataHora('2026-10-05T12:51:05-03:00')).toBe('12:51:05 de 05/10/2026');
    expect(formatDataHora('2026-10-05T15:51:05Z')).toBe('12:51:05 de 05/10/2026');
    expect(formatHora('2026-10-25T02:10:00Z')).toBe('23:10');
    expect(formatDataHora(null)).toBe('—');
  });

  it('nomes e iniciais', () => {
    expect(nomeProprio('ESCRITOR AUGUSTO CURY')).toBe('Escritor Augusto Cury');
    expect(nomeProprio('LUIZ INÁCIO LULA DA SILVA')).toBe('Luiz Inácio Lula da Silva');
    expect(iniciais('FLAVIO BOLSONARO')).toBe('FB');
    expect(iniciais('LULA')).toBe('L');
    expect(iniciais('RUI COSTA PIMENTA')).toBe('RP');
    expect(iniciais('MARIA DA SILVA')).toBe('MS');
  });
});

describe('cores de partido', () => {
  it('cores pedidas', () => {
    expect(corPartido('22')).toBe('#1B2A6B');
    expect(corPartido('13')).toBe('#C8102E');
    expect(corPartido('2233')).toBe('#1B2A6B'); // número de candidato a deputado
  });

  it('todo selo tem contraste AA (≥ 4,5) com o texto escolhido', () => {
    for (const [n, cor] of Object.entries(CORES_PARTIDOS)) {
      expect(contraste(cor, corTextoSobre(cor)), n).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('cores distintas e reserva estável para partidos não mapeados', () => {
    expect(new Set(Object.values(CORES_PARTIDOS)).size).toBe(Object.keys(CORES_PARTIDOS).length);
    expect(corPartido('99')).toBe(corPartido('99'));
  });

  it('todos os partidos das fixtures têm cor', () => {
    const r = normalizarResultado(lerFixture('oficial/ele2026/6259/dados/sp/sp-c0006-e006259-u.json'));
    for (const c of r.candidatos) expect(CORES_PARTIDOS[c.partido.numero], c.partido.sigla).toBeDefined();
  });
});

describe('líder e margem', () => {
  it('presidente Brasil: Flavio sobre Lula por 1,87 p.p.', () => {
    const r = normalizarResultado(lerFixture('oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json'));
    const lm = liderEMargem(r.candidatos)!;
    expect(lm.lider.nomeUrna).toBe('FLAVIO BOLSONARO');
    expect(lm.segundo?.nomeUrna).toBe('LULA');
    expect(lm.margem).toBeCloseTo(1.865, 2);
    expect(degrauMargem(lm.margem)).toBe(0);
  });

  it('degraus', () => {
    expect([0, 4.99, 5, 9.9, 10, 19, 20, 34.9, 35, 80].map(degrauMargem)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('sem votos → null', () => {
    expect(liderEMargem([])).toBeNull();
  });
});
