import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ServicoApuracao } from '@/api/apuracao';
import { MemoriaCacheHttp, TseHttp } from '@/api/http';
import { Limitador } from '@/api/limitador';
import { normalizarAcompanhamento, normalizarResultado } from '@/tse/normalize';
import { criarFetchReplay, type DadosReplay, Simulador } from './simulador';

const dados = JSON.parse(readFileSync(join(__dirname, 'dados.json'), 'utf8')) as DadosReplay;
const MIN = 60_000;
const PRES_BR = 'oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json';
const GOV_SP = 'oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json';

function emMinuto(min: number) {
  const rel = { t: 0 };
  const sim = new Simulador(dados, { velocidade: 1, agoraReal: () => rel.t });
  rel.t = min * MIN;
  return sim;
}

const pres = (sim: Simulador) => normalizarResultado(JSON.parse(sim.gerar(PRES_BR)!), PRES_BR);

describe('Simulador de apuração', () => {
  it('17:00: nada apurado, sem selos, formato válido', () => {
    const r = pres(emMinuto(0));
    expect(r.secoes.totalizadas).toBe(0);
    expect(r.totalizacaoFinal).toBe(false);
    expect(r.candidatos.every((c) => c.votos === 0 && c.situacao === 'pendente')).toBe(true);
  });

  it('no meio: parcial, Brasil = soma das UFs, sem selos', () => {
    const sim = emMinuto(90);
    const r = pres(sim);
    expect(r.secoes.pct).toBeGreaterThan(0);
    expect(r.secoes.pct).toBeLessThan(100);
    expect(r.atualizadoEm).toBe('2026-10-04T18:30:00-03:00');
    expect(r.candidatos.every((c) => c.situacao === 'pendente')).toBe(true);
    const soma = r.candidatos.reduce((s, c) => s + c.pct, 0);
    expect(soma).toBeCloseTo(100, 6);
    const ufs = Object.keys(dados).filter((k) => /\/dados\/([a-z]{2})\/\1-c0001-e006257-u\.json$/.test(k) && !k.includes('/br/'));
    const votosUfs = ufs.reduce((s, k) => s + normalizarResultado(JSON.parse(sim.gerar(k)!), k).votos.validos, 0);
    expect(r.votos.validos).toBe(votosUfs);
  });

  it('a curva nacional muda ao longo do tempo (regiões entram em momentos diferentes)', () => {
    const flavio = [30, 60, 120, 180].map((m) => pres(emMinuto(m)).candidatos.find((c) => c.numero === '22')!.pct);
    expect(new Set(flavio.map((x) => x.toFixed(2))).size).toBeGreaterThan(2);
  });

  it('ao final reproduz exatamente o resultado oficial, com selos', () => {
    const r = pres(emMinuto(300));
    expect(r.totalizacaoFinal).toBe(true);
    expect(r.secoes.pctTexto).toBe('100,00');
    const top = r.candidatos.slice(0, 2).map((c) => [c.nomeUrna, c.votos, c.pctTexto, c.situacao]);
    expect(top).toEqual([
      ['FLAVIO BOLSONARO', 56104503, '47,03', 'segundo_turno'],
      ['LULA', 53879538, '45,16', 'segundo_turno'],
    ]);
  });

  it('UF e acompanhamento coerentes com o progresso', () => {
    const sim = emMinuto(60);
    const gov = normalizarResultado(JSON.parse(sim.gerar(GOV_SP)!), GOV_SP);
    const p = sim.progresso('sp');
    expect(gov.secoes.totalizadas).toBe(Math.round(gov.secoes.total * p));
    const ab = normalizarAcompanhamento(JSON.parse(sim.gerar('oficial/ele2026/6259/dados/br/br-e006259-ab.json')!));
    const sp = ab.itens.find((i) => i.codigo === 'sp')!;
    expect(sp.secoes.totalizadas).toBe(gov.secoes.totalizadas);
    expect(sp.atualizadoEm === null).toBe(p === 0);
  });

  it('arquivo fora do conjunto → 404', () => {
    expect(emMinuto(10).gerar('oficial/ele2026/6259/dados/sp/sp-c0006-e006259-u.json')).toBeNull();
  });

  it('serviço completo sobre o replay, com ETag/304', async () => {
    const rel = { t: 0 };
    const sim = new Simulador(dados, { velocidade: 20, agoraReal: () => rel.t });
    const base = 'https://replay.local';
    const http = new TseHttp({
      fetch: criarFetchReplay(sim, base),
      cache: new MemoriaCacheHttp(),
      limitador: new Limitador(4, 0),
      agora: () => rel.t,
      intervaloMinimoMs: 5_000,
    });
    const svc = new ServicoApuracao({ http, endpoint: { base, ambiente: 'oficial', ciclo: 'ele2026' }, agora: () => rel.t });
    rel.t = 3 * MIN; // 60 min simulados
    const a = await svc.resultado({ turno: 1, cargo: '1', uf: 'br' });
    rel.t = 6 * MIN; // 120 min simulados
    const b = await svc.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(b.resultado.secoes.pct).toBeGreaterThan(a.resultado.secoes.pct);
    rel.t = 20 * MIN; // fim
    const c = await svc.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(c.resultado.totalizacaoFinal).toBe(true);
    rel.t = 21 * MIN;
    const d = await svc.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(d.origem === 'cache' || d.origem === 'nao-modificado').toBe(true);
  });
});

describe('2º turno simulado (só replay)', () => {
  it('ele-c ganha a eleição de 2º turno e o resolvedor a encontra', async () => {
    const { normalizarEleicoes } = await import('@/tse/normalize');
    const { resolverEleicao, cargosDisponiveis } = await import('@/tse/eleicoes');
    const sim = emMinuto(300);
    const els = normalizarEleicoes(JSON.parse(sim.gerar('oficial/comum/config/ele-c.json')!), 'ele2026');
    expect(resolverEleicao(els, 2, '1')).toMatchObject({ codigo: '6258', origem: 'ele-c' });
    const gov = resolverEleicao(els, 2, '3')!;
    expect(gov.codigo).toBe('6260');
    expect(gov.abrangencias!.length).toBeGreaterThan(0);
    expect(gov.abrangencias).not.toContain('sp'); // SP elegeu no 1º turno
    expect(cargosDisponiveis(els, 2).map((c) => c.nome)).toEqual(['Presidente', 'Governador']);
  });

  it('Presidente: só os 2 finalistas reais, percentuais somam 100, sem selos', () => {
    const arq = 'oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json';
    const r = normalizarResultado(JSON.parse(emMinuto(300).gerar(arq)!), arq);
    expect(r.turno).toBe(2);
    expect(r.candidatos.map((c) => c.nomeUrna)).toEqual(['FLAVIO BOLSONARO', 'LULA']);
    expect(r.candidatos[0]!.pct + r.candidatos[1]!.pct).toBeCloseTo(100, 6);
    expect(r.candidatos.every((c) => c.situacao === 'pendente')).toBe(true);
  });

  it('Governador só nas UFs com disputa; Senador não existe no 2º turno', () => {
    const sim = emMinuto(200);
    expect(sim.gerar('oficial/ele2026/6260/dados/sp/sp-c0003-e006260-u.json')).toBeNull();
    expect(sim.gerar('oficial/ele2026/6260/dados/ba/ba-c0005-e006260-u.json')).toBeNull();
  });
});
