/**
 * Resolve (turno, cargo) → código da eleição a partir do ele-c.json. Nada fixo no código.
 *
 * O 1º turno declara `cdt2` (código do 2º turno) antes de o 2º turno ser publicado
 * em ele-c.json. Ordem de preferência:
 *   1. ajuste manual (tela de configurações);
 *   2. eleição publicada com aquele turno que tenha o cargo;
 *   3. para o 2º turno, o `cdt2` da eleição de 1º turno que tem o cargo (provisório).
 */
import type { EleicaoMeta } from './types';

export type Origem = 'manual' | 'ele-c' | 'cdt2';

/** Pelo nome do cargo em ele-c.json (`cp[].ds`). */
const CARGOS_COM_SEGUNDO_TURNO = /^(presidente|governador|prefeito)$/i;

export interface EleicaoResolvida {
  codigo: string;
  origem: Origem;
  /** Abrangências em disputa (["br"] = todas). Desconhecidas quando origem = "cdt2". */
  abrangencias: string[] | null;
}

export interface CargoDisponivel {
  codigo: string;
  nome: string;
  /** true se o cargo tem resultado nacional (abrangência "br"), ex.: Presidente. */
  nacional: boolean;
}

/** Cargos exibidos como abas (na ordem do ele-c). Os demais (Dep. Estadual etc.) ficam fora. */
const CARGOS_EXIBIDOS = /^(presidente|governador|senador|deputado federal)$/i;
const CARGOS_NACIONAIS = /^presidente$/i;

/**
 * Cargos disponíveis no turno, derivados do ele-c.json. No 2º turno ainda não
 * publicado, usa os cargos do 1º turno que podem ter 2º turno (via cdt2).
 */
export function cargosDisponiveis(eleicoes: EleicaoMeta[], turno: 1 | 2): CargoDisponivel[] {
  let cargos = eleicoes.filter((e) => e.turno === turno).flatMap((e) => e.cargos);
  if (turno === 2 && cargos.length === 0) {
    cargos = eleicoes
      .filter((e) => e.turno === 1 && e.codigoSegundoTurno)
      .flatMap((e) => e.cargos)
      .filter((c) => CARGOS_COM_SEGUNDO_TURNO.test(c.nome.trim()));
  }
  const vistos = new Set<string>();
  return cargos
    .filter((c) => CARGOS_EXIBIDOS.test(c.nome.trim()) && !vistos.has(c.codigo) && vistos.add(c.codigo))
    .map((c) => ({ codigo: c.codigo, nome: c.nome.trim(), nacional: CARGOS_NACIONAIS.test(c.nome.trim()) }));
}

/** Chave de ajuste manual: "1:1" = 1º turno, Presidente. */
export type AjustesManuais = Partial<Record<`${1 | 2}:${string}`, string>>;

export function resolverEleicao(
  eleicoes: EleicaoMeta[],
  turno: 1 | 2,
  cargo: string,
  ajustes: AjustesManuais = {},
): EleicaoResolvida | null {
  const manual = ajustes[`${turno}:${cargo}`];
  if (manual) return { codigo: manual, origem: 'manual', abrangencias: null };

  const temCargo = (e: EleicaoMeta) => e.cargos.some((c) => c.codigo === cargo);

  const publicada = eleicoes.find((e) => e.turno === turno && temCargo(e));
  if (publicada) return { codigo: publicada.codigo, origem: 'ele-c', abrangencias: publicada.abrangencias };

  if (turno === 2) {
    // O cdt2 vale para a eleição inteira, mas só cargos executivos têm 2º turno
    // (CF art. 77 e 28): Senador e deputados nunca vão ao 2º turno.
    const primeiro = eleicoes.find(
      (e) =>
        e.turno === 1 &&
        e.codigoSegundoTurno &&
        e.cargos.some((c) => c.codigo === cargo && CARGOS_COM_SEGUNDO_TURNO.test(c.nome.trim())),
    );
    if (primeiro?.codigoSegundoTurno) {
      return { codigo: primeiro.codigoSegundoTurno, origem: 'cdt2', abrangencias: null };
    }
  }
  return null;
}
