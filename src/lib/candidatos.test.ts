import { describe, expect, it } from 'vitest';
import { normalizarResultado } from '@/tse/normalize';
import { lerFixture } from '@/test/fixtures';
import { chaveBusca, FILTRO_VAZIO, filtrarCandidatos, partidosDaLista } from './candidatos';

const DEP_SP = 'oficial/ele2026/6259/dados/sp/sp-c0006-e006259-u.json';
const r = normalizarResultado(lerFixture(DEP_SP), DEP_SP);
const lista = r.candidatos;

describe('busca e filtro de candidatos (Dep. Federal SP, arquivo real)', () => {
  it('sem filtro devolve a própria lista (sem cópia)', () => {
    expect(filtrarCandidatos(lista, FILTRO_VAZIO)).toBe(lista);
  });

  it('chave de busca ignora acentos, caixa e espaços extras', () => {
    expect(chaveBusca('  JOSÉ   Conceição ')).toBe('jose conceicao');
  });

  it('busca por nome sem acento e por início do número', () => {
    const alvo = lista.find((c) => /[ÁÉÍÓÚÃÕÇ]/.test(c.nomeUrna))!;
    const termo = chaveBusca(alvo.nomeUrna).split(' ')[0]!;
    expect(filtrarCandidatos(lista, { ...FILTRO_VAZIO, busca: termo })).toContain(alvo);
    const porNumero = filtrarCandidatos(lista, { ...FILTRO_VAZIO, busca: alvo.numero });
    expect(porNumero[0]?.numero.startsWith(alvo.numero)).toBe(true);
    expect(porNumero.every((c) => c.numero.startsWith(alvo.numero))).toBe(true);
  });

  it('eleitos = 70 vagas; filtro por partido mantém a ordem por votos', () => {
    const eleitos = filtrarCandidatos(lista, { ...FILTRO_VAZIO, situacao: 'eleitos' });
    expect(eleitos).toHaveLength(70);
    const pl = filtrarCandidatos(lista, { ...FILTRO_VAZIO, partido: '22', situacao: 'eleitos' });
    expect(pl.every((c) => c.partido.sigla === 'PL')).toBe(true);
    expect(pl.map((c) => c.votos)).toEqual([...pl.map((c) => c.votos)].sort((a, b) => b - a));
  });

  it('partidos ordenados por eleitos e com contagens que fecham', () => {
    const ps = partidosDaLista(lista);
    expect(ps[0]!.sigla).toBe('PL');
    expect(ps.reduce((s, p) => s + p.candidatos, 0)).toBe(lista.length);
    expect(ps.reduce((s, p) => s + p.eleitos, 0)).toBe(70);
  });
});
