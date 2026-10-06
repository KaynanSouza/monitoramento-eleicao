import { describe, expect, it } from 'vitest';
import { bancoEmMemoria } from '@/test/sqliteNode';
import { migrar, RepositorioAjustes, RepositorioHistorico, type Snapshot, SqlCacheHttp } from './sql';

const snap = (capturadoEm: number, extra: Partial<Snapshot> = {}): Snapshot => ({
  eleicao: '6258',
  turno: 2,
  cargo: '1',
  abrangencia: 'br',
  capturadoEm,
  atualizadoEm: '2026-10-25T17:30:00-03:00',
  pctSecoes: 12.5,
  totalizacaoFinal: false,
  segundoPlano: false,
  candidatos: [{ sqcand: '1', numero: '22', nomeUrna: 'A', partido: '22', sigla: 'PL', votos: 10, pct: 50 }],
  ...extra,
});

describe('SQLite (node:sqlite com o mesmo SQL do app)', () => {
  it('migração é idempotente', async () => {
    const db = await bancoEmMemoria();
    await migrar(db);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))?.user_version).toBe(1);
  });

  it('cache HTTP: ida e volta', async () => {
    const c = new SqlCacheHttp(await bancoEmMemoria());
    const e = {
      url: 'u',
      status: 200,
      etag: '"x"',
      lastModified: null,
      corpo: '{}',
      verificadoEm: 5,
      alteradoEm: 4,
      marcador: 'm',
    };
    await c.salvar(e);
    expect(await c.obter('u')).toEqual(e);
    await c.salvar({ ...e, verificadoEm: 9 });
    expect((await c.obter('u'))?.verificadoEm).toBe(9);
    expect(await c.obter('nada')).toBeNull();
  });

  it('histórico: grava, ignora observação repetida, lista em ordem', async () => {
    const h = new RepositorioHistorico(await bancoEmMemoria());
    expect(await h.registrar(snap(1000))).toBe(true);
    expect(await h.registrar(snap(1000))).toBe(false);
    expect(await h.registrar(snap(2000, { pctSecoes: 20, segundoPlano: true }))).toBe(true);
    const l = await h.listar({ eleicao: '6258', cargo: '1', abrangencia: 'br' });
    expect(l.map((s) => [s.capturadoEm, s.pctSecoes, s.segundoPlano])).toEqual([
      [1000, 12.5, false],
      [2000, 20, true],
    ]);
    expect(l[0]!.candidatos[0]!.sigla).toBe('PL');
    expect(await h.listar({ eleicao: '6258', cargo: '1', abrangencia: 'sp' })).toEqual([]);
    await h.limpar();
    expect(await h.listar({ eleicao: '6258', cargo: '1', abrangencia: 'br' })).toEqual([]);
  });

  it('ajustes: escopos observados sem repetição, mais recente primeiro', async () => {
    const a = new RepositorioAjustes(await bancoEmMemoria());
    await a.observar({ turno: 2, cargo: '1', uf: 'br' });
    await a.observar({ turno: 2, cargo: '3', uf: 'sp' });
    await a.observar({ turno: 2, cargo: '1', uf: 'br' });
    expect(await a.escoposObservados()).toEqual([
      { turno: 2, cargo: '1', uf: 'br' },
      { turno: 2, cargo: '3', uf: 'sp' },
    ]);
    await a.salvarCodigosManuais({ '2:1': '6258' });
    expect(await a.codigosManuais()).toEqual({ '2:1': '6258' });
  });
});
