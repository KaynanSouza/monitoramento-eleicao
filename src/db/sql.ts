/**
 * Persistência local (SQLite). Só depende da interface `SqlDb`, que é o subconjunto
 * da API do expo-sqlite usado aqui; nos testes ela é implementada com node:sqlite.
 */
import type { CacheHttp, EntradaCache } from '@/api/http';
import type { AjustesManuais } from '@/tse/eleicoes';

export type SqlParam = string | number | null;

export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlParam[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
}

const MIGRACOES: string[] = [
  `CREATE TABLE http_cache (
     url TEXT PRIMARY KEY NOT NULL,
     status INTEGER NOT NULL,
     etag TEXT,
     last_modified TEXT,
     corpo TEXT,
     verificado_em INTEGER NOT NULL,
     alterado_em INTEGER,
     marcador TEXT
   );
   CREATE TABLE snapshots (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     eleicao TEXT NOT NULL,
     turno INTEGER NOT NULL,
     cargo TEXT NOT NULL,
     abrangencia TEXT NOT NULL,
     capturado_em INTEGER NOT NULL,
     atualizado_em TEXT,
     pct_secoes REAL NOT NULL,
     totalizacao_final INTEGER NOT NULL,
     segundo_plano INTEGER NOT NULL,
     candidatos TEXT NOT NULL
   );
   CREATE INDEX snapshots_escopo ON snapshots (eleicao, cargo, abrangencia, capturado_em);
   CREATE TABLE ajustes (
     chave TEXT PRIMARY KEY NOT NULL,
     valor TEXT NOT NULL
   );`,
];

export async function migrar(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const versao = row?.user_version ?? 0;
  for (let v = versao; v < MIGRACOES.length; v++) {
    await db.execAsync(`BEGIN; ${MIGRACOES[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
  }
}

// ---------- cache HTTP ----------

interface LinhaCache {
  url: string;
  status: number;
  etag: string | null;
  last_modified: string | null;
  corpo: string | null;
  verificado_em: number;
  alterado_em: number | null;
  marcador: string | null;
}

export class SqlCacheHttp implements CacheHttp {
  constructor(private readonly db: SqlDb) {}

  async obter(url: string): Promise<EntradaCache | null> {
    const r = await this.db.getFirstAsync<LinhaCache>('SELECT * FROM http_cache WHERE url = ?', [url]);
    return r
      ? {
          url: r.url,
          status: r.status,
          etag: r.etag,
          lastModified: r.last_modified,
          corpo: r.corpo,
          verificadoEm: r.verificado_em,
          alteradoEm: r.alterado_em,
          marcador: r.marcador,
        }
      : null;
  }

  async salvar(e: EntradaCache): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO http_cache
         (url, status, etag, last_modified, corpo, verificado_em, alterado_em, marcador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [e.url, e.status, e.etag, e.lastModified, e.corpo, e.verificadoEm, e.alteradoEm, e.marcador],
    );
  }
}

// ---------- histórico ----------

export interface CandidatoSnapshot {
  sqcand: string;
  numero: string;
  nomeUrna: string;
  partido: string; // número do partido
  sigla: string;
  votos: number;
  pct: number;
}

export interface Snapshot {
  eleicao: string;
  turno: 1 | 2;
  cargo: string;
  abrangencia: string;
  /** Momento em que o app confirmou o estado com o TSE (epoch ms). */
  capturadoEm: number;
  /** dt/ht da totalização (ISO −03:00). */
  atualizadoEm: string | null;
  pctSecoes: number;
  totalizacaoFinal: boolean;
  segundoPlano: boolean;
  candidatos: CandidatoSnapshot[];
}

export interface Escopo {
  eleicao: string;
  cargo: string;
  abrangencia: string;
}

interface LinhaSnapshot {
  eleicao: string;
  turno: number;
  cargo: string;
  abrangencia: string;
  capturado_em: number;
  atualizado_em: string | null;
  pct_secoes: number;
  totalizacao_final: number;
  segundo_plano: number;
  candidatos: string;
}

export class RepositorioHistorico {
  constructor(private readonly db: SqlDb) {}

  /**
   * Grava um snapshot, a não ser que o último do mesmo escopo tenha o mesmo
   * `capturadoEm` (mesma observação do TSE servida de novo pelo cache).
   * Retorna true se gravou.
   */
  async registrar(s: Snapshot): Promise<boolean> {
    const ultimo = await this.ultimo(s);
    if (ultimo && ultimo.capturadoEm >= s.capturadoEm) return false;
    await this.db.runAsync(
      `INSERT INTO snapshots
         (eleicao, turno, cargo, abrangencia, capturado_em, atualizado_em, pct_secoes,
          totalizacao_final, segundo_plano, candidatos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.eleicao,
        s.turno,
        s.cargo,
        s.abrangencia,
        s.capturadoEm,
        s.atualizadoEm,
        s.pctSecoes,
        s.totalizacaoFinal ? 1 : 0,
        s.segundoPlano ? 1 : 0,
        JSON.stringify(s.candidatos),
      ],
    );
    return true;
  }

  /** Apaga todo o histórico (usado ao iniciar o modo replay, cujo banco é descartável). */
  async limpar(): Promise<void> {
    await this.db.runAsync('DELETE FROM snapshots', []);
  }

  async ultimo(e: Escopo): Promise<Snapshot | null> {
    const r = await this.db.getFirstAsync<LinhaSnapshot>(
      `SELECT * FROM snapshots WHERE eleicao = ? AND cargo = ? AND abrangencia = ?
       ORDER BY capturado_em DESC LIMIT 1`,
      [e.eleicao, e.cargo, e.abrangencia],
    );
    return r ? linhaParaSnapshot(r) : null;
  }

  async listar(e: Escopo): Promise<Snapshot[]> {
    const rs = await this.db.getAllAsync<LinhaSnapshot>(
      `SELECT * FROM snapshots WHERE eleicao = ? AND cargo = ? AND abrangencia = ?
       ORDER BY capturado_em ASC`,
      [e.eleicao, e.cargo, e.abrangencia],
    );
    return rs.map(linhaParaSnapshot);
  }
}

function linhaParaSnapshot(r: LinhaSnapshot): Snapshot {
  return {
    eleicao: r.eleicao,
    turno: r.turno === 2 ? 2 : 1,
    cargo: r.cargo,
    abrangencia: r.abrangencia,
    capturadoEm: r.capturado_em,
    atualizadoEm: r.atualizado_em,
    pctSecoes: r.pct_secoes,
    totalizacaoFinal: r.totalizacao_final === 1,
    segundoPlano: r.segundo_plano === 1,
    candidatos: JSON.parse(r.candidatos) as CandidatoSnapshot[],
  };
}

// ---------- ajustes ----------

export interface EscopoObservado {
  turno: 1 | 2;
  cargo: string;
  uf: string;
}

export class RepositorioAjustes {
  constructor(private readonly db: SqlDb) {}

  private async ler<T>(chave: string, padrao: T): Promise<T> {
    const r = await this.db.getFirstAsync<{ valor: string }>('SELECT valor FROM ajustes WHERE chave = ?', [chave]);
    return r ? (JSON.parse(r.valor) as T) : padrao;
  }

  private async gravar(chave: string, valor: unknown): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO ajustes (chave, valor) VALUES (?, ?)', [
      chave,
      JSON.stringify(valor),
    ]);
  }

  /** Códigos de eleição sobrescritos à mão (tela de configurações). */
  codigosManuais(): Promise<AjustesManuais> {
    return this.ler('codigos_manuais', {});
  }

  salvarCodigosManuais(a: AjustesManuais): Promise<void> {
    return this.gravar('codigos_manuais', a);
  }

  /** Escopos que a tarefa em segundo plano deve atualizar (os últimos vistos na tela). */
  escoposObservados(): Promise<EscopoObservado[]> {
    return this.ler('escopos_observados', []);
  }

  async observar(e: EscopoObservado, maximo = 4): Promise<void> {
    const atuais = await this.escoposObservados();
    const chave = (x: EscopoObservado) => `${x.turno}:${x.cargo}:${x.uf}`;
    const lista = [e, ...atuais.filter((x) => chave(x) !== chave(e))].slice(0, maximo);
    await this.gravar('escopos_observados', lista);
  }
}
