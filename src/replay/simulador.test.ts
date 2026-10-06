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
