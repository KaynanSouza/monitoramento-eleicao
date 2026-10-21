/**
 * Serviço de apuração: o "coletor" que roda no próprio celular.
 *
 * Para decidir o que rebaixar, usa o acompanhamento (EA14 Brasil / EA15 UF):
 * cada arquivo de resultado guarda o marcador (dt/ht + % seções + andamento) da
 * sua abrangência no momento em que foi buscado. Se o marcador atual é igual,
 * o arquivo não é buscado de novo, exceto por uma checagem condicional de
 * segurança a cada `intervaloSegurancaMs` (o TSE às vezes regera arquivos sem
 * mudar o acompanhamento; a checagem normalmente volta 304).
 */
import type { RepositorioAjustes, RepositorioHistorico, Snapshot } from '@/db/sql';
import { type EleicaoResolvida, resolverEleicao } from '@/tse/eleicoes';
import {
  lerJson,
  normalizarAcompanhamento,
  normalizarEleicoes,
  normalizarMunicipios,
  normalizarResultado,
  TseFormatoError,
} from '@/tse/normalize';
import type { Acompanhamento, EleicaoMeta, MunicipiosConfig, Resultado } from '@/tse/types';
import { criarUrls, IndiceMunicipios, type TseEndpoint } from '@/tse/urls';
import { NaoEncontradoError, type Origem, type Resposta, SemDadosError, type TseHttp } from './http';

export interface Consulta {
  turno: 1 | 2;
  cargo: string;
  /** "br" ou sigla da UF em minúsculas. */
  uf: string;
}

export interface ResultadoApuracao {
  resultado: Resultado;
  eleicao: EleicaoResolvida;
  origem: Origem;
  /** Último contato confirmado com o TSE para este arquivo (epoch ms). */
  verificadoEm: number;
}

export class SemEleicaoError extends Error {
  constructor(readonly consulta: Consulta) {
    super(`Não há eleição de ${consulta.turno}º turno para este cargo.`);
    this.name = 'SemEleicaoError';
  }
}

export class SemDisputaError extends Error {
  constructor(readonly consulta: Consulta) {
    super(`Não há ${consulta.turno}º turno para este cargo em ${consulta.uf.toUpperCase()}.`);
    this.name = 'SemDisputaError';
  }
}

export interface DepsApuracao {
  http: TseHttp;
  endpoint: TseEndpoint;
  historico?: RepositorioHistorico;
  ajustes?: RepositorioAjustes;
  agora?: () => number;
  intervaloSegurancaMs?: number;
}

const MINUTO = 60_000;
/** Buscas de município simultâneas no mapa (o limitador global ainda vale). */
const TRABALHADORES_MAPA = 4;

export class ServicoApuracao {
  private readonly agora: () => number;
  private readonly intervaloSegurancaMs: number;
  private readonly municipiosCache = new Map<string, { cfg: MunicipiosConfig; indice: IndiceMunicipios }>();

  constructor(private readonly d: DepsApuracao) {
    this.agora = d.agora ?? Date.now;
    this.intervaloSegurancaMs = d.intervaloSegurancaMs ?? 5 * MINUTO;
  }

  get endpoint(): TseEndpoint {
    return this.d.endpoint;
  }

  private get urls() {
    return criarUrls(this.d.endpoint);
  }

  async eleicoes(): Promise<EleicaoMeta[]> {
    const r = await this.d.http.buscar(this.urls.eleicoesConfig(), { intervaloMinimoMs: 10 * MINUTO });
    return normalizarEleicoes(lerJson(r.corpo, 'ele-c.json'), this.d.endpoint.ciclo, 'ele-c.json');
  }

  async resolver(turno: 1 | 2, cargo: string): Promise<EleicaoResolvida | null> {
    const [eleicoes, manuais] = await Promise.all([this.eleicoes(), this.d.ajustes?.codigosManuais() ?? {}]);
    return resolverEleicao(eleicoes, turno, cargo, manuais);
  }

  async municipios(eleicao: string): Promise<{ cfg: MunicipiosConfig; indice: IndiceMunicipios }> {
    const url = this.urls.municipiosConfig(eleicao);
    const memo = this.municipiosCache.get(eleicao);
    if (memo) return memo;
    const r = await this.d.http.buscar(url, { intervaloMinimoMs: 6 * 60 * MINUTO });
    const cfg = normalizarMunicipios(lerJson(r.corpo, url), url);
    const v = { cfg, indice: new IndiceMunicipios(cfg) };
    this.municipiosCache.set(eleicao, v);
    return v;
  }

  /** EA14 (uf = "br") ou EA15 (uf). Null se ainda não publicado/indisponível. */
  async acompanhamento(eleicao: string, uf: string): Promise<Acompanhamento | null> {
    const url = criarUrls(this.d.endpoint, await this.indiceOuNada(eleicao)).acompanhamento(eleicao, uf);
    try {
      const r = await this.d.http.buscar(url);
      return normalizarAcompanhamento(lerJson(r.corpo, url), url);
    } catch (e) {
      // O acompanhamento só decide o que rebaixar: se vier quebrado, segue sem marcador.
      if (e instanceof NaoEncontradoError || e instanceof SemDadosError || e instanceof TseFormatoError) return null;
      throw e;
    }
  }

  /** `segundoPlano`: chamado pela tarefa em segundo plano (fica marcado no snapshot). */
  async resultado(q: Consulta, opcoes: { segundoPlano?: boolean } = {}): Promise<ResultadoApuracao> {
    const eleicao = await this.eleicaoPara(q);
    const indice = await this.indiceOuNada(eleicao.codigo);
    const url = criarUrls(this.d.endpoint, indice).resultado(eleicao.codigo, q.cargo, q.uf);

    const acomp = await this.acompanhamento(eleicao.codigo, 'br');
    const marcador = marcadorDe(acomp, q.uf === 'br' ? 'br' : 'uf', q.uf);
    const resp = await this.buscarComMarcador(url, marcador);
    const resultado = normalizarResultado(lerJson(resp.corpo, url), url, q.cargo);

    await this.registrarSnapshot(q, eleicao.codigo, resultado, resp, opcoes.segundoPlano ?? false);
    return { resultado, eleicao, origem: resp.origem, verificadoEm: resp.verificadoEm };
  }

  async resultadoMunicipio(q: Consulta, municipioTse: string): Promise<ResultadoApuracao> {
    const eleicao = await this.eleicaoPara(q);
    const { indice } = await this.municipios(eleicao.codigo);
    const url = criarUrls(this.d.endpoint, indice).resultadoMunicipio(eleicao.codigo, q.cargo, q.uf, municipioTse);
    const acomp = await this.acompanhamento(eleicao.codigo, q.uf);
    const resp = await this.buscarComMarcador(url, marcadorDe(acomp, 'mun', municipioTse));
    const resultado = normalizarResultado(lerJson(resp.corpo, url), url, q.cargo);
    return { resultado, eleicao, origem: resp.origem, verificadoEm: resp.verificadoEm };
  }

  /**
   * Carrega os municípios de uma UF (sob demanda, para o mapa), indexados pelo
   * código IBGE. Respeita o limitador global; municípios sem mudança no EA15 vêm do
   * cache. Só busca municípios que o EA15 lista como já totalizados: assim nunca
   * dispara centenas de 404 (que bloqueiam o IP) antes de a apuração começar.
   * Erros individuais não interrompem o lote.
   */
  async carregarMunicipios(
    q: Consulta,
    opcoes: { aoProgredir?: (feitos: number, total: number) => void; sinal?: AbortSignal } = {},
  ): Promise<Map<string, Resultado>> {
    const eleicao = await this.eleicaoPara(q);
    const { cfg, indice } = await this.municipios(eleicao.codigo);
    const urls = criarUrls(this.d.endpoint, indice);
    const acomp = await this.acompanhamento(eleicao.codigo, q.uf);
    const saida = new Map<string, Resultado>();
    if (!acomp) return saida;
    const totalizados = new Set(
      acomp.itens.filter((i) => i.tipo === 'mun' && i.atualizadoEm).map((i) => i.codigo),
    );
    const lista = (cfg.ufs.find((u) => u.uf === q.uf)?.municipios ?? []).filter((m) => totalizados.has(m.tse));
    let feitos = 0;
    let proximo = 0;

    // Poucos "trabalhadores" puxando da lista (em vez de enfileirar tudo de uma vez no
    // limitador): assim o cancelamento (tela fechada, UF trocada) para as buscas restantes.
    const trabalhador = async () => {
      while (proximo < lista.length && !opcoes.sinal?.aborted) {
        const m = lista[proximo++]!;
        const url = urls.resultadoMunicipio(eleicao.codigo, q.cargo, q.uf, m.tse);
        try {
          const resp = await this.buscarComMarcador(url, marcadorDe(acomp, 'mun', m.tse));
          saida.set(m.ibge, normalizarResultado(lerJson(resp.corpo, url), url, q.cargo));
        } catch {
          // ainda não publicado / offline sem cache: fica fora do mapa
        } finally {
          opcoes.aoProgredir?.(++feitos, lista.length);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(TRABALHADORES_MAPA, lista.length) }, trabalhador));
    return saida;
  }

  /**
   * Resultado de cada UF (para o mapa nacional colorido por estado): 27 arquivos,
   * todos pelo limitador e com os marcadores do EA14. UFs com erro ficam de fora.
   */
  async resultadosUfs(q: Omit<Consulta, 'uf'>, ufs: readonly string[]): Promise<Map<string, Resultado>> {
    const saida = new Map<string, Resultado>();
    await Promise.all(
      ufs.map(async (uf) => {
        try {
          saida.set(uf, (await this.resultado({ ...q, uf })).resultado);
        } catch {
          // UF ainda sem arquivo / offline sem cache
        }
      }),
    );
    return saida;
  }

  private async eleicaoPara(q: Consulta): Promise<EleicaoResolvida> {
    const eleicao = await this.resolver(q.turno, q.cargo);
    if (!eleicao) throw new SemEleicaoError(q);
    const abr = eleicao.abrangencias;
    if (abr && !abr.includes('br') && q.uf !== 'br' && !abr.includes(q.uf)) throw new SemDisputaError(q);
    return eleicao;
  }

  private async indiceOuNada(eleicao: string): Promise<IndiceMunicipios | undefined> {
    try {
      return (await this.municipios(eleicao)).indice;
    } catch {
      return undefined; // sem config de municípios: URLs de BR/UF ainda são validadas por formato
    }
  }

  private async buscarComMarcador(url: string, marcador: string | null): Promise<Resposta> {
    if (marcador) {
      const e = await this.d.http.espiar(url);
      if (
        e?.status === 200 &&
        e.corpo != null &&
        e.marcador === marcador &&
        this.agora() - e.verificadoEm < this.intervaloSegurancaMs
      ) {
        return {
          url,
          corpo: e.corpo,
          origem: 'cache',
          verificadoEm: e.verificadoEm,
          alteradoEm: e.alteradoEm,
          marcador,
        };
      }
    }
    return this.d.http.buscar(url, { marcador });
  }

  private async registrarSnapshot(q: Consulta, eleicao: string, r: Resultado, resp: Resposta, segundoPlano: boolean) {
    if (!this.d.historico || resp.origem === 'offline') return;
    // Histórico só para cargos majoritários (evolução de poucos candidatos).
    if (r.proporcional || r.candidatos.length > 60) return;
    const s: Snapshot = {
      eleicao,
      turno: q.turno,
      cargo: q.cargo,
      abrangencia: q.uf,
      capturadoEm: resp.verificadoEm,
      atualizadoEm: r.atualizadoEm,
      pctSecoes: r.secoes.pct,
      totalizacaoFinal: r.totalizacaoFinal,
      segundoPlano,
      candidatos: r.candidatos.map((c) => ({
        sqcand: c.sqcand,
        numero: c.numero,
        nomeUrna: c.nomeUrna,
        partido: c.partido.numero,
        sigla: c.partido.sigla,
        votos: c.votos,
        pct: c.pct,
      })),
    };
    await this.d.historico.registrar(s);
  }
}

/** Marcador de mudança de uma abrangência no EA14/EA15. Null se não houver item. */
export function marcadorDe(a: Acompanhamento | null, tipo: 'br' | 'uf' | 'mun', codigo: string): string | null {
  const item = a?.itens.find((i) => i.tipo === tipo && i.codigo === codigo);
  if (!item) return null;
  return `${item.atualizadoEm ?? '-'}|${item.secoes.totalizadas}|${item.andamento}`;
}
