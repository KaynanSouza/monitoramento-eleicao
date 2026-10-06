/**
 * Modo replay: reproduz uma apuração a partir dos arquivos finais REAIS do 1º turno,
 * sem acessar o TSE. Cada UF (e cada município) avança numa curva própria, com
 * início e duração determinísticos; o resultado Brasil é a soma das UFs no instante,
 * o que reproduz o efeito real de a curva nacional mudar conforme as regiões entram.
 *
 * Os arquivos gerados têm o mesmo formato do TSE e passam pelos mesmos parsers.
 * Situações ("Eleito", "2º turno") só aparecem quando a simulação chega a 100%.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
export type DadosReplay = Record<string, Json>;

const MINUTO = 60_000;

export interface OpcoesSimulador {
  /** Instante simulado do início da divulgação (epoch ms). Padrão: 04/10/2026 17:00 Brasília. */
  inicioSimulado?: number;
  /** Duração da apuração simulada, em minutos. */
  duracaoMin?: number;
  /** Minutos simulados por minuto real. */
  velocidade?: number;
  /** Minuto simulado em que o replay começa (0 = início da divulgação). */
  inicioMin?: number;
  agoraReal?: () => number;
}

/** Hash FNV-1a → [0, 1). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

const fmt = (n: number, casas: number) => n.toFixed(casas).replace('.', ',');
const int = (s: string | undefined) => Number(s ?? 0) || 0;

function dataHoraBrasilia(ms: number): { d: string; h: string } {
  const x = new Date(ms - 3 * 60 * MINUTO);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    d: `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`,
    h: `${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())}`,
  };
}

export class Simulador {
  readonly inicioSimulado: number;
  readonly duracaoMin: number;
  readonly velocidade: number;
  private readonly agoraReal: () => number;
  private readonly inicioReal: number;
  private readonly inicioMin: number;

  constructor(
    private readonly dados: DadosReplay,
    o: OpcoesSimulador = {},
  ) {
    this.inicioSimulado = o.inicioSimulado ?? Date.parse('2026-10-04T17:00:00-03:00');
    this.duracaoMin = o.duracaoMin ?? 300;
    this.velocidade = o.velocidade ?? 20;
    this.agoraReal = o.agoraReal ?? Date.now;
    this.inicioReal = this.agoraReal();
    this.inicioMin = o.inicioMin ?? 0;
  }

  /** Instante simulado atual (epoch ms). Para no fim da apuração: depois disso nada muda. */
  agora(): number {
    const decorrido = this.inicioMin * MINUTO + (this.agoraReal() - this.inicioReal) * this.velocidade;
    return this.inicioSimulado + Math.min(decorrido, this.duracaoMin * MINUTO);
  }

  private minutos(): number {
    return (this.agora() - this.inicioSimulado) / MINUTO;
  }

  /** Curva de uma abrangência ("sp", "ac01120"): atraso 5–75 min, duração 90–220 min. */
  private curva(chave: string) {
    const atraso = 5 + hash01(chave) * 70;
    const duracao = 90 + hash01(`${chave}#`) * 130;
    return { atraso, fim: atraso + duracao };
  }

  /** Fração apurada (0..1) da abrangência no instante simulado. */
  progresso(chave: string): number {
    const t = this.minutos();
    if (t >= this.duracaoMin) return 1;
    const { atraso, fim } = this.curva(chave);
    const x = Math.min(1, Math.max(0, (t - atraso) / (fim - atraso)));
    return x * x * (3 - 2 * x);
  }

  /** dt/ht da abrangência: horário em que terminou, ou o instante atual (meio-minuto). */
  private quando(chave: string, p: number): number {
    if (p >= 1) {
      const fim = Math.min(this.curva(chave).fim, this.duracaoMin);
      return Math.min(this.agora(), this.inicioSimulado + fim * MINUTO);
    }
    return Math.floor(this.agora() / 30_000) * 30_000;
  }

  /** Conteúdo simulado do arquivo, ou null (404). `caminho` é relativo à base: "oficial/ele2026/...". */
  gerar(caminho: string): string | null {
    if (caminho.endsWith('/comum/config/ele-c.json') && this.dados[caminho]) {
      return JSON.stringify(this.eleicoesComSegundoTurno(this.dados[caminho]));
    }
    const t2 = /\/ele2026\/(6258|6260)\//.exec(caminho);
    if (t2) return this.segundoTurno(caminho, t2[1]!);

    const config = caminho.replace('/6259/config/mun-e006259-cm.json', '/6257/config/mun-e006257-cm.json');
    if (/\/config\/[^/]+\.json$/.test(config)) return this.dados[config] ? JSON.stringify(this.dados[config]) : null;

    const ab = /\/dados\/([a-z]{2})\/\1-e(\d{6})-ab\.json$/.exec(caminho);
    if (ab) return this.dados[caminho] ? JSON.stringify(this.acompanhamento(this.dados[caminho])) : null;

    const u = /\/dados\/([a-z]{2})\/\1(\d{5})?-c(\d{4})-e(\d{6})-u\.json$/.exec(caminho);
    if (u) {
      const [, uf, mun] = u;
      if (uf === 'br') return this.dados[caminho] ? JSON.stringify(this.brasil(caminho)) : null;
      if (!this.dados[caminho]) return null;
      const chave = `${uf}${mun ?? ''}`;
      const p = this.progresso(chave);
      return JSON.stringify(this.escalar(this.dados[caminho], p, this.quando(chave, p)));
    }
    return null;
  }

  // ---------- 2º turno simulado ----------
  //
  // Só existe no replay, para testar a tela de disputa antes de 25/10. Usa os 2
  // candidatos que o arquivo REAL do 1º turno marca como "2º turno", com os votos
  // do 1º turno entre eles (números fictícios). Nunca marca "Eleito": a simulação
  // não inventa resultado.

  private static readonly ORIGEM: Record<string, string> = { '6258': '6257', '6260': '6259' };

  /** UFs com 2º turno para governador, segundo os arquivos reais do 1º turno. */
  private ufsGovernador2t(): string[] {
    return Object.keys(this.dados)
      .map((k) => /\/6259\/dados\/([a-z]{2})\/\1-c0003-e006259-u\.json$/.exec(k)?.[1])
      .filter((uf): uf is string => !!uf && this.finalistas(`oficial/ele2026/6259/dados/${uf}/${uf}-c0003-e006259-u.json`).size === 2)
      .sort();
  }

  private finalistas(caminho: string): Set<string> {
    const d = this.dados[caminho];
    const s = new Set<string>();
    if (!d) return s;
    for (const cargo of d.carg)
      for (const agr of cargo.agr) for (const par of agr.par) for (const c of par.cand) if (c.st === '2º turno') s.add(c.sqcand);
    return s;
  }

  private eleicoesComSegundoTurno(original: Json): Json {
    const r = JSON.parse(JSON.stringify(original));
    r.pl.push({
      cd: '9999',
      cdpr: '',
      c: 'ele2026',
      dt: '25/10/2026',
      dtlim: '',
      e: [
        {
          cd: '6258',
          cdt2: '',
          nm: 'Eleição Ordinária Federal - 2026 2º Turno (SIMULADO no replay)',
          t: '2',
          tp: '8',
          abr: [{ cd: 'br', cp: [{ cd: '1', ds: 'Presidente', tp: '1' }] }],
        },
        {
          cd: '6260',
          cdt2: '',
          nm: 'Eleição Ordinária Estadual - 2026 2º Turno (SIMULADO no replay)',
          t: '2',
          tp: '1',
          abr: this.ufsGovernador2t().map((uf) => ({ cd: uf, cp: [{ cd: '3', ds: 'Governador', tp: '1' }] })),
        },
      ],
    });
    return r;
  }

  private segundoTurno(caminho: string, ele: string): string | null {
    const orig = Simulador.ORIGEM[ele]!;
    const base = caminho.replaceAll(`/${ele}/`, `/${orig}/`).replaceAll(`e00${ele}`, `e00${orig}`);
    const u = /\/dados\/([a-z]{2})\/\1(\d{5})?-c(\d{4})-e\d{6}-u\.json$/.exec(base);
    if (u) {
      const [, uf, , cargo] = u;
      // 2º turno só de Presidente (6258) e de Governador nas UFs com disputa (6260).
      if (ele === '6258' && cargo !== '0001') return null;
      if (ele === '6260' && (cargo !== '0003' || !this.ufsGovernador2t().includes(uf!))) return null;
    }
    const corpo = this.gerar(base);
    if (corpo == null) return null;
    const r = JSON.parse(corpo);
    r.ele = ele;
    r.t = '2';
    if (!u) return JSON.stringify(r); // acompanhamento / config
    const fonte =
      ele === '6258'
        ? 'oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json'
        : `oficial/ele2026/6259/dados/${u[1]}/${u[1]}-c0003-e006259-u.json`;
    const dois = this.finalistas(fonte);
    for (const cargo of r.carg) {
      for (const agr of cargo.agr) for (const par of agr.par) par.cand = par.cand.filter((c: Json) => dois.has(c.sqcand));
      for (const agr of cargo.agr) agr.par = agr.par.filter((p: Json) => p.cand.length);
      cargo.agr = cargo.agr.filter((a: Json) => a.par.length);
    }
    const final = r.tf === 's';
    const votos = new Map<string, number>();
    for (const cargo of r.carg)
      for (const agr of cargo.agr) for (const par of agr.par) for (const c of par.cand) votos.set(c.sqcand, int(c.vap));
    // Votos já vêm escalados pelo progresso: fator 1 (só recalcula percentuais entre os 2).
    this.aplicarVotos(r, (c) => votos.get(c.sqcand) ?? 0, 1, false);
    // Simulação: nenhum selo de situação, mesmo ao fim.
    r.tf = final ? 's' : 'n';
    return JSON.stringify(r);
  }

  private carimbar(r: Json, quando: number, final: boolean) {
    const t = dataHoraBrasilia(quando);
    const g = dataHoraBrasilia(this.agora());
    r.dt = t.d;
    r.ht = t.h;
    r.dg = g.d;
    r.hg = g.h;
    r.tf = final ? 's' : 'n';
    r.and = final ? 'f' : 'p';
    delete r.mntf;
  }

  private secoes(s: Json, totalizadas: number) {
    const ts = int(s.ts);
    const pct = ts ? (totalizadas / ts) * 100 : 0;
    return { ...s, st: String(totalizadas), pst: fmt(pct, 2), pstn: fmt(pct, 9).replace(/,?0+$/, '') || '0' };
  }

  /** Recalcula votos e percentuais de um EA20 a partir de votos por sqcand. */
  private aplicarVotos(r: Json, votosDe: (c: Json) => number, fator: number, final: boolean) {
    let validos = 0;
    for (const cargo of r.carg)
      for (const agr of cargo.agr)
        for (const par of agr.par)
          for (const c of par.cand) {
            const v = votosDe(c);
            c.vap = String(v);
            if (String(c.dvt).startsWith('Válido')) validos += v;
            if (!final) {
              c.st = '';
              c.e = 'n';
            }
          }
    const legenda = Math.round(int(r.v.vl) * fator);
    validos += legenda;
    for (const cargo of r.carg)
      for (const agr of cargo.agr)
        for (const par of agr.par)
          for (const c of par.cand) {
            const pct = validos && String(c.dvt).startsWith('Válido') ? (int(c.vap) / validos) * 100 : 0;
            c.pvap = fmt(pct, 2);
            c.pvapn = fmt(pct, 9);
          }
    const esc = (k: string) => String(Math.round(int(r.v[k]) * fator));
    r.v = { ...r.v, vv: String(validos), vb: esc('vb'), tvn: esc('tvn'), vansj: esc('vansj') };
    if (r.v.vl !== undefined) r.v.vl = String(legenda);
    r.v.tv = String(validos + int(r.v.vb) + int(r.v.tvn));
    r.e = { ...r.e, c: String(Math.round(int(r.e.c) * fator)), a: String(Math.round(int(r.e.a) * fator)) };
  }

  private escalar(original: Json, p: number, quando: number): Json {
    const r = JSON.parse(JSON.stringify(original));
    const final = p >= 1;
    this.carimbar(r, quando, final);
    r.s = this.secoes(r.s, Math.round(int(r.s.ts) * p));
    this.aplicarVotos(r, (c) => Math.round(int(c.vap) * p), p, final);
    return r;
  }

  /** Presidente Brasil = soma das UFs (e exterior) no instante. */
  private brasil(caminho: string): Json {
    const r = JSON.parse(JSON.stringify(this.dados[caminho]));
    const sufixo = caminho.slice(caminho.lastIndexOf('-c')); // "-c0001-e006257-u.json"
    const base = caminho.slice(0, caminho.indexOf('/dados/'));
    const porCand = new Map<string, number>();
    let totalizadas = 0;
    let secoesTotal = 0;
    let fim = 0;
    let todasFinais = true;
    const ufs = Object.keys(this.dados)
      .map((k) => new RegExp(`^${base}/dados/([a-z]{2})/\\1${sufixo}$`).exec(k)?.[1])
      .filter((x): x is string => !!x && x !== 'br');

    for (const uf of ufs) {
      const d = this.dados[`${base}/dados/${uf}/${uf}${sufixo}`];
      const p = this.progresso(uf);
      if (p < 1) todasFinais = false;
      fim = Math.max(fim, this.quando(uf, p));
      totalizadas += Math.round(int(d.s.ts) * p);
      secoesTotal += int(d.s.ts);
      for (const cargo of d.carg)
        for (const agr of cargo.agr)
          for (const par of agr.par)
            for (const c of par.cand)
              porCand.set(c.sqcand, (porCand.get(c.sqcand) ?? 0) + Math.round(int(c.vap) * p));
    }
    const fator = secoesTotal ? totalizadas / secoesTotal : 0;
    this.carimbar(r, todasFinais ? fim : Math.floor(this.agora() / 30_000) * 30_000, todasFinais);
    r.s = this.secoes(r.s, totalizadas);
    this.aplicarVotos(r, (c) => porCand.get(c.sqcand) ?? 0, fator, todasFinais);
    return r;
  }

  private acompanhamento(original: Json): Json {
    const r = JSON.parse(JSON.stringify(original));
    const g = dataHoraBrasilia(this.agora());
    r.dg = g.d;
    r.hg = g.h;
    let totBr = 0;
    let tsBr = 0;
    const uf = (r.abr as Json[]).find((a) => a.tpabr === 'uf' && r.abr.some((x: Json) => x.tpabr === 'mun'));
    for (const a of r.abr as Json[]) {
      if (a.tpabr === 'br') continue;
      const chave = a.tpabr === 'mun' ? `${uf?.cdabr ?? ''}${a.cdabr}` : a.cdabr;
      const p = this.progresso(chave);
      const tot = Math.round(int(a.s.ts) * p);
      totBr += tot;
      tsBr += int(a.s.ts);
      Object.assign(a, this.itemAcomp(a, p, tot, this.quando(chave, p)));
    }
    const br = (r.abr as Json[]).find((a) => a.tpabr === 'br');
    if (br) {
      const p = tsBr ? totBr / tsBr : 0;
      Object.assign(br, this.itemAcomp(br, p, totBr, Math.floor(this.agora() / 30_000) * 30_000));
    }
    return r;
  }

  private itemAcomp(a: Json, p: number, totalizadas: number, quando: number) {
    const t = dataHoraBrasilia(quando);
    return {
      and: p >= 1 ? 'f' : 'p',
      dt: p > 0 ? t.d : '',
      ht: p > 0 ? t.h : '',
      s: this.secoes(a.s, totalizadas),
    };
  }
}

/** `fetch` falso que serve o simulador, com ETag e 304 como a CDN do TSE. */
export function criarFetchReplay(sim: Simulador, base: string): typeof fetch {
  return (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const prefixo = `${base}/`;
    const corpo = url.startsWith(prefixo) ? sim.gerar(url.slice(prefixo.length)) : null;
    if (corpo == null) return new Response('Not Found', { status: 404 });
    const etag = `"${hash01(corpo).toString(36).slice(2)}"`;
    const headers = new Headers(init?.headers);
    if (headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(corpo, { status: 200, headers: { etag, 'content-type': 'application/json' } });
  }) as typeof fetch;
}
