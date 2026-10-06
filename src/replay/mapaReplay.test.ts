import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ServicoApuracao } from '@/api/apuracao';
import { MemoriaCacheHttp, TseHttp } from '@/api/http';
import { Limitador } from '@/api/limitador';
import { UFS } from '@/lib/ufs';
import { criarFetchReplay, type DadosReplay, Simulador } from './simulador';

const dados = JSON.parse(readFileSync(join(__dirname, 'dados.json'), 'utf8')) as DadosReplay;

describe('mapa sobre o replay', () => {
  it('carregar todas as UFs termina (AC com municípios, demais vazias sem EA15)', async () => {
    const sim = new Simulador(dados, { inicioMin: 300 });
    const base = 'https://replay.local';
    const http = new TseHttp({ fetch: criarFetchReplay(sim, base), cache: new MemoriaCacheHttp(), limitador: new Limitador(4, 5) });
    const svc = new ServicoApuracao({ http, endpoint: { base, ambiente: 'oficial', ciclo: 'ele2026' } });
    const progresso = new Map<string, number>();
    const res = await Promise.all(
      UFS.map((u) =>
        svc.carregarMunicipios({ turno: 1, cargo: '1', uf: u.uf }, { aoProgredir: (f, t) => progresso.set(u.uf, f / t) }),
      ),
    );
    const porUf = Object.fromEntries(UFS.map((u, i) => [u.uf, res[i]!.size]));
    expect(porUf.ac).toBe(22);
    expect(Object.values(porUf).reduce((a, b) => a + b, 0)).toBe(22);
    expect(progresso.get('ac')).toBe(1);
    const ufs = await svc.resultadosUfs({ turno: 1, cargo: '1' }, UFS.map((u) => u.uf));
    expect(ufs.size).toBe(27);
  }, 30_000);

  it('limitador não trava com centenas de tarefas na fila', async () => {
    const lim = new Limitador(4, 0);
    let feitas = 0;
    await Promise.all(Array.from({ length: 900 }, () => lim.executar(async () => void feitas++)));
    expect(feitas).toBe(900);
  });
});
