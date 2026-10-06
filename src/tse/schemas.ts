/**
 * Schemas zod dos arquivos da divulgação do TSE, derivados dos arquivos REAIS
 * do 1º turno de 2026 salvos em fixtures/ (ver docs/formato-tse.md).
 *
 * Todos os valores vêm como string. Percentuais usam vírgula decimal ("47,03");
 * os campos com sufixo "n" ("pvapn") trazem mais casas decimais.
 * Campos desconhecidos são descartados (z.object), campos ausentes em algumas
 * abrangências/cargos são opcionais.
 */
import { z } from 'zod';

const sn = z.enum(['s', 'n']);
const str = z.string();

/** Bloco "s": seções. */
export const SecoesSchema = z.object({
  ts: str, // total de seções
  st: str, // seções totalizadas
  pst: str, // % seções totalizadas ("100,00")
  pstn: str,
});

/** Bloco "e": eleitorado. */
export const EleitoradoSchema = z.object({
  te: str, // total de eleitores
  c: str, // comparecimento
  pc: str,
  a: str, // abstenção
  pa: str,
});

/** Bloco "v": votos. */
export const VotosSchema = z.object({
  tv: str, // total de votos
  vv: str, // válidos
  pvv: str,
  vb: str, // brancos
  pvb: str,
  tvn: str, // nulos (total)
  ptvn: str,
  vansj: str, // anulados sub judice
  pvansj: str,
  vl: str.optional(), // legenda (proporcionais)
  pvl: str.optional(),
});

export const ViceSuplenteSchema = z.object({
  tp: z.enum(['v', 's1', 's2']),
  sqcand: str,
  nm: str,
  nmu: str,
  sgp: str,
});

export const CandidatoSchema = z.object({
  n: str, // número na urna
  sqcand: str, // sequencial (também nome do arquivo de foto)
  nm: str,
  nmu: str, // nome de urna
  dt: str, // nascimento
  dvt: str, // destinação do voto: "Válido" | "Anulado sub judice" | ...
  seq: str, // ordem oficial
  e: sn, // "s" = eleito ou vai ao 2º turno
  st: str, // situação: "2º turno" | "Eleito" | "Eleito por QP" | "Eleito por média" | "Suplente" | "Não eleito" | ""
  vap: str, // votos apurados
  pvap: str, // % dos válidos ("47,03")
  pvapn: str,
  vs: z.array(ViceSuplenteSchema).optional(),
});

export const PartidoSchema = z.object({
  n: str, // número do partido
  sg: str,
  nm: str,
  nfed: str, // número da federação ("" se não federado)
  tvtn: str.optional(), // total votos nominais
  tvtl: str.optional(), // total votos de legenda
  cand: z.array(CandidatoSchema),
});

export const AgremiacaoSchema = z.object({
  n: str,
  nm: str,
  tp: z.enum(['i', 'c', 'f']), // isolado | coligação | federação
  com: str, // composição ("PL", "PSB / PDT / ...")
  par: z.array(PartidoSchema),
});

export const FederacaoSchema = z.object({
  n: str,
  sg: str,
  nm: str,
  npar: z.array(str),
});

export const CargoResultadoSchema = z.object({
  cd: str,
  nmn: str, // nome neutro
  nv: str, // número de vagas
  qe: str.optional(), // quociente eleitoral (proporcionais)
  fed: z.array(FederacaoSchema).optional(),
  agr: z.array(AgremiacaoSchema),
});

/** EA20: arquivo de resultado unificado ("-u.json"), abrangência br/uf/município. */
export const ResultadoSchema = z.object({
  ele: str,
  t: str, // turno
  tpabr: z.enum(['br', 'uf', 'mu']),
  cdabr: str,
  dg: str, // data/hora de geração do arquivo
  hg: str,
  dt: str, // data/hora da última totalização
  ht: str,
  tf: sn, // totalização final
  and: str, // andamento: "f" finalizada | "p" em processamento
  mntf: str.optional(), // mensagem da totalização ("Aguarde reprocessamento da eleição")
  carg: z.array(CargoResultadoSchema),
  s: SecoesSchema,
  e: EleitoradoSchema,
  v: VotosSchema,
});

/** EA14 (Brasil → UFs) / EA15 (UF → municípios): acompanhamento ("-ab.json"). */
export const AcompanhamentoSchema = z.object({
  ele: str,
  t: str,
  dg: str,
  hg: str,
  abr: z.array(
    z.object({
      and: str,
      tpabr: z.enum(['br', 'uf', 'mun']),
      cdabr: str,
      dt: str, // vazio quando a abrangência ainda não foi totalizada
      ht: str,
      s: SecoesSchema,
    }),
  ),
});

/** Configuração de municípios ("mun-e{ID}-cm.json"): código TSE ↔ IBGE. */
export const MunicipiosConfigSchema = z.object({
  dg: str,
  hg: str,
  abr: z.array(
    z.object({
      cd: str, // uf ("zz" = exterior)
      ds: str,
      mu: z.array(
        z.object({
          cd: z.string().regex(/^\d{5}$/), // código TSE
          cdi: str, // código IBGE (vazio no exterior)
          nm: str,
          c: sn, // capital
        }),
      ),
    }),
  ),
});

/** Configuração de eleições ("comum/config/ele-c.json"). */
export const EleicoesConfigSchema = z.object({
  dg: str,
  hg: str,
  pl: z.array(
    z.object({
      cd: str, // pleito
      c: str, // ciclo ("ele2026")
      dt: str, // data do pleito
      e: z.array(
        z.object({
          cd: str, // código da eleição
          cdt2: str, // código da eleição de 2º turno ("" se não houver)
          nm: str,
          t: str, // turno
          tp: str,
          abr: z.array(
            z.object({
              cd: str,
              cp: z.array(z.object({ cd: str, ds: str, tp: str })),
            }),
          ),
        }),
      ),
    }),
  ),
});

export type ResultadoRaw = z.infer<typeof ResultadoSchema>;
export type AcompanhamentoRaw = z.infer<typeof AcompanhamentoSchema>;
export type MunicipiosConfigRaw = z.infer<typeof MunicipiosConfigSchema>;
export type EleicoesConfigRaw = z.infer<typeof EleicoesConfigSchema>;
