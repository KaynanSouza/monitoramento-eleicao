/**
 * Cliente HTTP do TSE com as regras de boa convivência:
 * - no máximo 1 busca de rede por arquivo a cada `intervaloMinimoMs` (padrão 45 s);
 * - requisições condicionais (If-None-Match / If-Modified-Since);
 * - cache negativo de 404 (não insistir: muitos 404 bloqueiam o IP);
 * - pausa global com backoff exponencial em 403/429/5xx;
 * - offline: devolve o último corpo salvo, marcado como "offline".
 */
import { Limitador } from './limitador';

export interface EntradaCache {
  url: string;
  status: number; // 200 ou 404
  etag: string | null;
  lastModified: string | null;
  corpo: string | null;
  /** Último contato bem-sucedido com o servidor (200, 304 ou 404), epoch ms. */
  verificadoEm: number;
  /** Última vez que o corpo mudou (200), epoch ms. */
  alteradoEm: number | null;
  /** Marcador do EA14/EA15 visto quando o arquivo foi buscado (ver apuracao.ts). */
  marcador: string | null;
}

export interface CacheHttp {
  obter(url: string): Promise<EntradaCache | null>;
  salvar(e: EntradaCache): Promise<void>;
}

export class MemoriaCacheHttp implements CacheHttp {
  readonly mapa = new Map<string, EntradaCache>();
  async obter(url: string) {
    return this.mapa.get(url) ?? null;
  }
  async salvar(e: EntradaCache) {
    this.mapa.set(e.url, { ...e });
  }
}

/** rede = corpo novo; nao-modificado = 304; cache = dentro do intervalo mínimo; offline = falha de rede/servidor. */
export type Origem = 'rede' | 'nao-modificado' | 'cache' | 'offline';

export interface Resposta {
  url: string;
  corpo: string;
  origem: Origem;
  verificadoEm: number;
  alteradoEm: number | null;
  marcador: string | null;
}

export class NaoEncontradoError extends Error {
  constructor(readonly url: string) {
    super('Arquivo ainda não publicado pelo TSE.');
    this.name = 'NaoEncontradoError';
  }
}

export class SemDadosError extends Error {
  constructor(
    readonly url: string,
    motivo: string,
  ) {
    super(`Sem conexão com o TSE e sem dados salvos (${motivo}).`);
    this.name = 'SemDadosError';
  }
}

export interface OpcoesHttp {
  fetch: typeof fetch;
  cache: CacheHttp;
  limitador: Limitador;
  agora?: () => number;
  intervaloMinimoMs?: number;
  ttl404Ms?: number;
  timeoutMs?: number;
  backoffInicialMs?: number;
  backoffMaximoMs?: number;
}

export interface OpcoesBusca {
  /** Sobrescreve o intervalo mínimo (ex.: configs que mudam pouco). Nunca menor que o padrão. */
  intervaloMinimoMs?: number;
  /** Marcador a gravar junto com a entrada após uma busca de rede. */
  marcador?: string | null;
}

export class TseHttp {
  private readonly agora: () => number;
  private readonly intervaloMinimoMs: number;
  private readonly ttl404Ms: number;
  private readonly timeoutMs: number;
  private readonly backoffInicialMs: number;
  private readonly backoffMaximoMs: number;
  private pausadoAte = 0;
  private backoffAtualMs = 0;
  private readonly emVoo = new Map<string, Promise<Resposta>>();

  constructor(private readonly o: OpcoesHttp) {
    this.agora = o.agora ?? Date.now;
    this.intervaloMinimoMs = o.intervaloMinimoMs ?? 45_000;
    this.ttl404Ms = o.ttl404Ms ?? 120_000;
    this.timeoutMs = o.timeoutMs ?? 20_000;
    this.backoffInicialMs = o.backoffInicialMs ?? 30_000;
    this.backoffMaximoMs = o.backoffMaximoMs ?? 10 * 60_000;
  }

  /** Até quando as buscas estão pausadas por erro do servidor (epoch ms, 0 = não pausado). */
  get pausaAte(): number {
    return this.pausadoAte > this.agora() ? this.pausadoAte : 0;
  }

  /** Lê a entrada em cache sem tocar a rede. */
  espiar(url: string): Promise<EntradaCache | null> {
    return this.o.cache.obter(url);
  }

  buscar(url: string, opcoes: OpcoesBusca = {}): Promise<Resposta> {
    const existente = this.emVoo.get(url);
    if (existente) return existente;
    const p = this.buscarInterno(url, opcoes).finally(() => this.emVoo.delete(url));
    this.emVoo.set(url, p);
    return p;
  }

  private async buscarInterno(url: string, opcoes: OpcoesBusca): Promise<Resposta> {
    const entrada = await this.o.cache.obter(url);
    const agora = this.agora();
    const intervalo = Math.max(this.intervaloMinimoMs, opcoes.intervaloMinimoMs ?? 0);

    if (entrada?.status === 404 && agora - entrada.verificadoEm < this.ttl404Ms) {
      if (entrada.corpo != null) return this.resposta(entrada, 'offline');
      throw new NaoEncontradoError(url);
    }
    if (entrada?.corpo != null && entrada.status === 200 && agora - entrada.verificadoEm < intervalo) {
      return this.resposta(entrada, 'cache');
    }
    if (this.pausadoAte > agora) return this.semRede(url, entrada, 'servidor pediu pausa');

    const headers: Record<string, string> = {};
    if (entrada?.status === 200 && entrada.corpo != null) {
      if (entrada.etag) headers['If-None-Match'] = entrada.etag;
      if (entrada.lastModified) headers['If-Modified-Since'] = entrada.lastModified;
    }

    let res: Response;
    try {
      res = await this.o.limitador.executar(() => this.comTimeout(url, headers));
    } catch (e) {
      return this.semRede(url, entrada, e instanceof Error ? e.message : 'falha de rede');
    }

    const verificadoEm = this.agora();
    const marcador = opcoes.marcador !== undefined ? opcoes.marcador : (entrada?.marcador ?? null);

    if (res.status === 304 && entrada?.corpo != null) {
      this.backoffAtualMs = 0;
      const nova = { ...entrada, verificadoEm, marcador };
      await this.o.cache.salvar(nova);
      return this.resposta(nova, 'nao-modificado');
    }
    if (res.status === 200) {
      this.backoffAtualMs = 0;
      const corpo = await res.text();
      const nova: EntradaCache = {
        url,
        status: 200,
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        corpo,
        verificadoEm,
        alteradoEm: entrada?.corpo === corpo ? entrada.alteradoEm : verificadoEm,
        marcador,
      };
      await this.o.cache.salvar(nova);
      return this.resposta(nova, 'rede');
    }
    if (res.status === 404) {
      // Mantém o último corpo bom (se houver) mas registra o 404 para não insistir.
      await this.o.cache.salvar({
        url,
        status: 404,
        etag: null,
        lastModified: null,
        corpo: entrada?.corpo ?? null,
        verificadoEm,
        alteradoEm: entrada?.alteradoEm ?? null,
        marcador: entrada?.marcador ?? null,
      });
      if (entrada?.corpo != null) return this.resposta({ ...entrada, verificadoEm }, 'offline');
      throw new NaoEncontradoError(url);
    }
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      this.backoffAtualMs = Math.min(
        this.backoffMaximoMs,
        this.backoffAtualMs ? this.backoffAtualMs * 2 : this.backoffInicialMs,
      );
      // 403 da CDN costuma ser o bloqueio de 10 min por excesso de requisições.
      const pausa = res.status === 403 ? this.backoffMaximoMs : this.backoffAtualMs;
      this.pausadoAte = verificadoEm + pausa;
    }
    return this.semRede(url, entrada, `HTTP ${res.status}`);
  }

  private async comTimeout(url: string, headers: Record<string, string>): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await this.o.fetch(url, { headers, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  private semRede(url: string, entrada: EntradaCache | null, motivo: string): Resposta {
    if (entrada?.corpo != null) return this.resposta(entrada, 'offline');
    throw new SemDadosError(url, motivo);
  }

  private resposta(e: EntradaCache, origem: Origem): Resposta {
    return {
      url: e.url,
      corpo: e.corpo!,
      origem,
      verificadoEm: e.verificadoEm,
      alteradoEm: e.alteradoEm,
      marcador: e.marcador,
    };
  }
}
