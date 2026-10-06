import { describe, expect, it } from 'vitest';
import { RepositorioAjustes, RepositorioHistorico, SqlCacheHttp } from '@/db/sql';
import { lerFixture } from '@/test/fixtures';
import { BASE_TESTE, servidorFixtures } from '@/test/servidorFixtures';
import { bancoEmMemoria } from '@/test/sqliteNode';
import { SemDisputaError, SemEleicaoError, ServicoApuracao } from './apuracao';
import { TseHttp } from './http';
import { Limitador } from './limitador';

const endpoint = { base: BASE_TESTE, ambiente: 'oficial', ciclo: 'ele2026' };
const AB_BR = 'oficial/ele2026/6257/dados/br/br-e006257-ab.json';
const PRES_BR = 'oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json';

async function montar() {
  const rel = { t: 1_000_000 };
  const db = await bancoEmMemoria();
  const srv = servidorFixtures();
  const http = new TseHttp({
    fetch: srv.fetchFn,
    cache: new SqlCacheHttp(db),
    limitador: new Limitador(4, 0),
    agora: () => rel.t,
  });
  const historico = new RepositorioHistorico(db);
  const ajustes = new RepositorioAjustes(db);
  const apuracao = new ServicoApuracao({ http, endpoint, historico, ajustes, agora: () => rel.t });
  const contar = (sufixo: string) => srv.chamadas.filter((u) => u.endsWith(sufixo)).length;
  return { rel, srv, apuracao, historico, ajustes, contar };
}

describe('ServicoApuracao (fixtures reais via fetch falso)', () => {
  it('Presidente Brasil: resolve 6257 pelo ele-c e normaliza', async () => {
    const { apuracao } = await montar();
    const r = await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(r.eleicao).toEqual({ codigo: '6257', origem: 'ele-c', abrangencias: ['br'] });
    expect(r.origem).toBe('rede');
    expect(r.resultado.candidatos[0]!.nomeUrna).toBe('FLAVIO BOLSONARO');
  });

  it('não rebaixa o resultado se o marcador do EA14 não mudou', async () => {
    const { apuracao, rel, contar } = await montar();
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    rel.t += 60_000; // passou o intervalo mínimo
    const r = await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(r.origem).toBe('cache');
    expect(contar('br-c0001-e006257-u.json')).toBe(1);
    expect(contar('br-e006257-ab.json')).toBe(2); // o acompanhamento é consultado
  });

  it('rebaixa quando o marcador muda', async () => {
    const { apuracao, rel, srv, contar } = await montar();
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    const ab = lerFixture(AB_BR) as { abr: { tpabr: string; ht: string }[] };
    ab.abr.find((a) => a.tpabr === 'br')!.ht = '13:00:00';
    srv.sobrescritas.set(AB_BR, JSON.stringify(ab));
    rel.t += 60_000;
    const r = await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(r.origem).toBe('rede');
    expect(contar('br-c0001-e006257-u.json')).toBe(2);
  });

  it('checagem de segurança após 5 min mesmo com marcador igual', async () => {
    const { apuracao, rel, contar } = await montar();
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    rel.t += 5 * 60_000 + 1;
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    expect(contar('br-c0001-e006257-u.json')).toBe(2);
  });

  it('grava snapshot só de observações novas', async () => {
    const { apuracao, rel, historico } = await montar();
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' });
    rel.t += 60_000;
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' }); // veio do cache: mesma observação
    rel.t += 5 * 60_000;
    await apuracao.resultado({ turno: 1, cargo: '1', uf: 'br' }, { segundoPlano: true });
    const s = await historico.listar({ eleicao: '6257', cargo: '1', abrangencia: 'br' });
    expect(s.map((x) => x.segundoPlano)).toEqual([false, true]);
    expect(s[0]!.atualizadoEm).toBe('2026-10-05T12:51:05-03:00');
    expect(s[0]!.candidatos[0]).toMatchObject({ nomeUrna: 'FLAVIO BOLSONARO', votos: 56104503, sigla: 'PL' });
  });

  it('não grava histórico de Dep. Federal', async () => {
    const { apuracao, historico } = await montar();
    await apuracao.resultado({ turno: 1, cargo: '6', uf: 'ac' });
    expect(await historico.listar({ eleicao: '6259', cargo: '6', abrangencia: 'ac' })).toEqual([]);
  });

  it('2º turno ainda não publicado: tenta o cdt2 e informa que não há arquivo', async () => {
    const { apuracao, contar } = await montar();
    await expect(apuracao.resultado({ turno: 2, cargo: '1', uf: 'br' })).rejects.toThrow(/não publicado|Sem conexão/);
    expect(contar('br-c0001-e006258-u.json')).toBe(1);
  });

  it('cargo sem eleição no turno', async () => {
    const { apuracao } = await montar();
    await expect(apuracao.resultado({ turno: 2, cargo: '6', uf: 'sp' })).rejects.toBeInstanceOf(SemEleicaoError);
  });

  it('2º turno estadual só nas UFs declaradas no ele-c', async () => {
    const { apuracao, srv } = await montar();
    const eleC = lerFixture('oficial/comum/config/ele-c.json') as { pl: unknown[] };
    eleC.pl.push({
      cd: '3221',
      c: 'ele2026',
      dt: '25/10/2026',
      e: [{ cd: '6260', cdt2: '', nm: 'Estadual 2º turno', t: '2', tp: '1', abr: [{ cd: 'sp', cp: [{ cd: '3', ds: 'Governador', tp: '1' }] }] }],
    });
    srv.sobrescritas.set('oficial/comum/config/ele-c.json', JSON.stringify(eleC));
    await expect(apuracao.resultado({ turno: 2, cargo: '3', uf: 'rj' })).rejects.toBeInstanceOf(SemDisputaError);
  });

  it('ajuste manual do código de eleição', async () => {
    const { apuracao, ajustes, contar } = await montar();
    await ajustes.salvarCodigosManuais({ '2:1': '6257' });
    const r = await apuracao.resultado({ turno: 2, cargo: '1', uf: 'br' });
    expect(r.eleicao.origem).toBe('manual');
    expect(contar(PRES_BR)).toBe(1);
  });

  it('municípios: só busca os que o EA15 lista como totalizados (evita rajada de 404)', async () => {
    const { apuracao, srv } = await montar();
    const AB_AC = 'oficial/ele2026/6257/dados/ac/ac-e006257-ab.json';
    const ab = lerFixture(AB_AC) as { abr: { tpabr: string; dt: string; ht: string }[] };
    ab.abr.filter((a) => a.tpabr === 'mun').slice(2).forEach((a) => ((a.dt = ''), (a.ht = '')));
    srv.sobrescritas.set(AB_AC, JSON.stringify(ab));
    const m = await apuracao.carregarMunicipios({ turno: 1, cargo: '1', uf: 'ac' });
    expect(m.size).toBe(2);
    expect(srv.chamadas.filter((u) => /ac\d{5}-c0001/.test(u))).toHaveLength(2);
  });

  it('municípios: sem EA15 publicado, nenhuma requisição de município', async () => {
    const { apuracao, srv } = await montar();
    srv.sobrescritas.set('oficial/ele2026/6257/dados/rj/rj-e006257-ab.json', null);
    const m = await apuracao.carregarMunicipios({ turno: 1, cargo: '1', uf: 'rj' });
    expect(m.size).toBe(0);
    expect(srv.chamadas.filter((u) => /rj\d{5}-c0001/.test(u))).toHaveLength(0);
  });

  it('mapa nacional: resultado das 27 UFs', async () => {
    const { apuracao } = await montar();
    const ufs = ['sp', 'rj', 'mg'];
    const m = await apuracao.resultadosUfs({ turno: 1, cargo: '1' }, ufs);
    expect([...m.keys()].sort()).toEqual(['mg', 'rj', 'sp']);
    expect(m.get('sp')!.abrangencia).toBe('sp');
  });

  it('municípios do AC: só URLs do mun-cm, todos carregados, progresso informado', async () => {
    const { apuracao, srv } = await montar();
    const progresso: number[] = [];
    const m = await apuracao.carregarMunicipios(
      { turno: 1, cargo: '1', uf: 'ac' },
      { aoProgredir: (f) => progresso.push(f) },
    );
    expect(m.size).toBe(22);
    expect(progresso.at(-1)).toBe(22);
    expect(srv.chamadas.some((u) => /ac\d{5}-c0001/.test(u) && !u.includes('-e006257-'))).toBe(false);
  });
});
