/** Modelo normalizado usado pelo app (independente dos nomes de campo do TSE). */

export type Abrangencia = 'br' | Uf;
export type Uf = string; // "sp", "rj", ... "zz" (exterior)

/**
 * Situação oficial do candidato, mapeada de `st`. "pendente" = sem situação
 * no arquivo (totalização não finalizada): a UI não deve exibir selo.
 */
export type Situacao = 'eleito' | 'segundo_turno' | 'suplente' | 'nao_eleito' | 'pendente';

export interface Candidato {
  numero: string;
  sqcand: string;
  nomeUrna: string;
  nome: string;
  partido: { numero: string; sigla: string; nome: string };
  /** Composição da coligação/federação ("PSB / PDT / PT ..."), igual à sigla se isolado. */
  coligacao: string;
  votos: number;
  /** % dos votos válidos com precisão total (para barras e gráfico). */
  pct: number;
  /** % exatamente como publicado pelo TSE, 2 casas ("47,03"). */
  pctTexto: string;
  situacao: Situacao;
  /** Texto original do TSE ("Eleito por QP"), vazio se pendente. */
  situacaoTexto: string;
  /** false quando os votos são "Anulado sub judice" etc. */
  votoValido: boolean;
  vices: { tipo: 'v' | 's1' | 's2'; nomeUrna: string; partido: string }[];
}

export interface Resultado {
  eleicao: string;
  turno: 1 | 2;
  tipoAbrangencia: 'br' | 'uf' | 'mu';
  abrangencia: string; // "br" | uf | código TSE do município
  cargo: { codigo: string; nome: string; vagas: number };
  /** Última totalização (dt/ht), ISO com offset −03:00. */
  atualizadoEm: string | null;
  /** Geração do arquivo (dg/hg). */
  geradoEm: string | null;
  totalizacaoFinal: boolean;
  /** "f" finalizada | "p" em processamento | outro valor bruto. */
  andamento: string;
  mensagem: string | null;
  secoes: { total: number; totalizadas: number; pct: number; pctTexto: string };
  eleitorado: { total: number; comparecimento: number; abstencao: number };
  votos: { total: number; validos: number; brancos: number; nulos: number; anuladosSubJudice: number };
  /** Ordenados por votos (desc), desempate pela ordem oficial `seq`. */
  candidatos: Candidato[];
}

export interface AcompanhamentoItem {
  tipo: 'br' | 'uf' | 'mun';
  codigo: string;
  atualizadoEm: string | null;
  andamento: string;
  secoes: { total: number; totalizadas: number; pct: number };
}

export interface Acompanhamento {
  eleicao: string;
  turno: 1 | 2;
  geradoEm: string | null;
  itens: AcompanhamentoItem[];
}

export interface Municipio {
  tse: string; // 5 dígitos
  ibge: string; // 7 dígitos ("" no exterior)
  nome: string;
  capital: boolean;
}

export interface MunicipiosConfig {
  ufs: { uf: Uf; nome: string; municipios: Municipio[] }[];
}

export interface CargoMeta {
  codigo: string; // "1", "3", "5", "6"...
  nome: string;
  /** "1" majoritário, "2" proporcional, "3" consulta (valores de ele-c.json). */
  tipo: string;
}

export interface EleicaoMeta {
  codigo: string;
  /** Código da eleição de 2º turno anunciado no 1º turno (cdt2), se houver. */
  codigoSegundoTurno: string | null;
  turno: 1 | 2;
  nome: string;
  pleito: string;
  data: string; // dd/mm/aaaa
  /** Abrangências declaradas: ["br"] = todo o país; no 2º turno estadual, as UFs com disputa. */
  abrangencias: string[];
  cargos: CargoMeta[];
}
