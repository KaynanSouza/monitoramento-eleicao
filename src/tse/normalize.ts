import type { z } from 'zod';
import { parseDataHoraBrasilia, parseInteiro, parsePercentual } from './parse';
import {
  AcompanhamentoSchema,
  EleicoesConfigSchema,
  MunicipiosConfigSchema,
  ResultadoSchema,
  type ResultadoRaw,
} from './schemas';
import type {
  Acompanhamento,
  Candidato,
  EleicaoMeta,
  MunicipiosConfig,
  Resultado,
  Situacao,
} from './types';

/** O JSON do TSE não tem o formato esperado. `detalhes` é para log; `message` é amigável. */
export class TseFormatoError extends Error {
  constructor(
    readonly arquivo: string,
    readonly detalhes: string,
  ) {
    super('Os dados do TSE vieram em um formato inesperado. Mostrando o último resultado válido.');
    this.name = 'TseFormatoError';
  }
}

function validar<S extends z.ZodType>(schema: S, json: unknown, arquivo: string): z.infer<S> {
  const r = schema.safeParse(json);
  if (!r.success) {
    const detalhes = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('; ');
    throw new TseFormatoError(arquivo, detalhes);
  }
  return r.data;
}

const turno = (t: string): 1 | 2 => (t === '2' ? 2 : 1);

const SITUACOES: Record<string, Situacao> = {
  'eleito': 'eleito',
  'eleito por qp': 'eleito',
  'eleito por média': 'eleito',
  '2º turno': 'segundo_turno',
  'suplente': 'suplente',
  'não eleito': 'nao_eleito',
};

/** Mapeia `st` do TSE. Valor vazio ou desconhecido → "pendente" (nenhum selo é exibido). */
export function mapearSituacao(st: string): Situacao {
  return SITUACOES[st.trim().toLowerCase()] ?? 'pendente';
}

function candidatos(cargo: ResultadoRaw['carg'][number]): Candidato[] {
  const lista: (Candidato & { seq: number })[] = [];
  for (const agr of cargo.agr) {
    for (const par of agr.par) {
      for (const c of par.cand) {
        lista.push({
          numero: c.n,
          sqcand: c.sqcand,
          nomeUrna: c.nmu,
          nome: c.nm,
          partido: { numero: par.n, sigla: par.sg, nome: par.nm },
          coligacao: agr.com,
          votos: parseInteiro(c.vap),
          pct: parsePercentual(c.pvapn),
          pctTexto: c.pvap,
          situacao: mapearSituacao(c.st),
          situacaoTexto: c.st.trim(),
          votoValido: c.dvt.startsWith('Válido'),
          vices: (c.vs ?? []).map((v) => ({ tipo: v.tp, nomeUrna: v.nmu, partido: v.sgp })),
          seq: parseInteiro(c.seq),
        });
      }
    }
  }
  lista.sort((a, b) => b.votos - a.votos || a.seq - b.seq);
  return lista.map(({ seq: _seq, ...c }) => c);
}

/**
 * EA20 → Resultado. Um arquivo "-u.json" traz um único cargo; se vier mais de um,
 * use `codigoCargo` para escolher.
 */
export function normalizarResultado(json: unknown, arquivo = 'resultado', codigoCargo?: string): Resultado {
  const raw = validar(ResultadoSchema, json, arquivo);
  const cargo = codigoCargo ? raw.carg.find((c) => c.cd === codigoCargo) : raw.carg[0];
  if (!cargo) throw new TseFormatoError(arquivo, `cargo ${codigoCargo ?? '(primeiro)'} ausente`);

  return {
    eleicao: raw.ele,
    turno: turno(raw.t),
    tipoAbrangencia: raw.tpabr,
    abrangencia: raw.cdabr,
    cargo: { codigo: cargo.cd, nome: cargo.nmn, vagas: parseInteiro(cargo.nv) },
    atualizadoEm: parseDataHoraBrasilia(raw.dt, raw.ht),
    geradoEm: parseDataHoraBrasilia(raw.dg, raw.hg),
    totalizacaoFinal: raw.tf === 's',
    andamento: raw.and,
    mensagem: raw.mntf?.trim() || null,
    secoes: {
      total: parseInteiro(raw.s.ts),
      totalizadas: parseInteiro(raw.s.st),
      pct: parsePercentual(raw.s.pstn),
      pctTexto: raw.s.pst,
    },
    eleitorado: {
      total: parseInteiro(raw.e.te),
      comparecimento: parseInteiro(raw.e.c),
      abstencao: parseInteiro(raw.e.a),
    },
    votos: {
      total: parseInteiro(raw.v.tv),
      validos: parseInteiro(raw.v.vv),
      brancos: parseInteiro(raw.v.vb),
      nulos: parseInteiro(raw.v.tvn),
      anuladosSubJudice: parseInteiro(raw.v.vansj),
    },
    candidatos: candidatos(cargo),
  };
}

/** EA14/EA15 → lista de abrangências com horário da última totalização. */
export function normalizarAcompanhamento(json: unknown, arquivo = 'acompanhamento'): Acompanhamento {
  const raw = validar(AcompanhamentoSchema, json, arquivo);
  return {
    eleicao: raw.ele,
    turno: turno(raw.t),
    geradoEm: parseDataHoraBrasilia(raw.dg, raw.hg),
    itens: raw.abr.map((a) => ({
      tipo: a.tpabr,
      codigo: a.cdabr,
      atualizadoEm: parseDataHoraBrasilia(a.dt, a.ht),
      andamento: a.and,
      secoes: {
        total: parseInteiro(a.s.ts),
        totalizadas: parseInteiro(a.s.st),
        pct: parsePercentual(a.s.pstn),
      },
    })),
  };
}

export function normalizarMunicipios(json: unknown, arquivo = 'mun-cm'): MunicipiosConfig {
  const raw = validar(MunicipiosConfigSchema, json, arquivo);
  return {
    ufs: raw.abr.map((a) => ({
      uf: a.cd,
      nome: a.ds,
      municipios: a.mu.map((m) => ({ tse: m.cd, ibge: m.cdi, nome: m.nm, capital: m.c === 's' })),
    })),
  };
}

/** ele-c.json → eleições do ciclo informado. */
export function normalizarEleicoes(json: unknown, ciclo: string, arquivo = 'ele-c'): EleicaoMeta[] {
  const raw = validar(EleicoesConfigSchema, json, arquivo);
  return raw.pl
    .filter((p) => p.c === ciclo)
    .flatMap((p) =>
      p.e.map((e) => {
        const cargos = new Map<string, { codigo: string; nome: string; tipo: string }>();
        for (const a of e.abr) for (const c of a.cp) cargos.set(c.cd, { codigo: c.cd, nome: c.ds, tipo: c.tp });
        return {
          codigo: e.cd,
          codigoSegundoTurno: e.cdt2 || null,
          turno: turno(e.t),
          nome: e.nm,
          pleito: p.cd,
          data: p.dt,
          abrangencias: e.abr.map((a) => a.cd),
          cargos: [...cargos.values()],
        };
      }),
    );
}
