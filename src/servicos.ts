/**
 * Monta os serviços do app (uma instância por processo): banco local, cliente HTTP
 * com limites do TSE e serviço de apuração. Em MOCK=replay, troca o fetch pelo
 * simulador e usa um banco separado.
 */
import { ServicoApuracao } from './api/apuracao';
import { TseHttp } from './api/http';
import { Limitador } from './api/limitador';
import { config } from './config';
import { abrirBanco } from './db/expo';
import { RepositorioAjustes, RepositorioHistorico, SqlCacheHttp } from './db/sql';
import type { TseEndpoint } from './tse/urls';

export interface Servicos {
  apuracao: ServicoApuracao;
  historico: RepositorioHistorico;
  ajustes: RepositorioAjustes;
  http: TseHttp;
  modo: 'oficial' | 'replay';
  endpoint: TseEndpoint;
  /** Apaga o cache HTTP local (o histórico do gráfico é mantido). */
  limparCache: () => Promise<void>;
}

let instancia: Promise<Servicos> | null = null;

export function obterServicos(): Promise<Servicos> {
  instancia ??= criar();
  // Só em desenvolvimento: acesso pelo console para diagnóstico.
  if (__DEV__) (globalThis as { __servicos?: Promise<Servicos> }).__servicos = instancia;
  return instancia;
}

async function criar(): Promise<Servicos> {
  const replay = config.mock === 'replay';
  const db = await abrirBanco(replay ? 'apuracao-replay.db' : 'apuracao.db');

  let endpoint: TseEndpoint = { base: config.tseBase, ambiente: config.ambiente, ciclo: config.ciclo };
  let fetchFn: typeof fetch = fetch;
  if (replay) {
    // Carregado só no replay; o JSON (~1,3 MB) vai no bundle, mas não é avaliado no modo oficial.
    const { Simulador, criarFetchReplay } = require('./replay/simulador') as typeof import('./replay/simulador');
    const dados = require('./replay/dados.json');
    endpoint = { base: 'https://replay.local', ambiente: 'oficial', ciclo: 'ele2026' };
    fetchFn = criarFetchReplay(new Simulador(dados, { velocidade: config.replaySpeed, inicioMin: config.replayInicioMin }), endpoint.base);
  }

  const http = new TseHttp({
    fetch: fetchFn,
    cache: new SqlCacheHttp(db),
    // ~8 req/s, 4 simultâneas: bem abaixo do limite de 100 req/s do TSE.
    limitador: new Limitador(4, 125),
    // No replay o "servidor" é local; intervalo curto para o gráfico ter pontos.
    intervaloMinimoMs: replay ? 5_000 : 45_000,
  });
  const historico = new RepositorioHistorico(db);
  if (replay) {
    // Cada execução do replay é uma apuração nova: não misturar com execuções anteriores.
    await historico.limpar();
    await db.runAsync('DELETE FROM http_cache', []);
  }
  const ajustes = new RepositorioAjustes(db);
  const apuracao = new ServicoApuracao({ http, endpoint, historico, ajustes });
  return {
    apuracao,
    historico,
    ajustes,
    http,
    modo: replay ? 'replay' : 'oficial',
    endpoint,
    limparCache: async () => {
      await db.runAsync('DELETE FROM http_cache', []);
    },
  };
}
