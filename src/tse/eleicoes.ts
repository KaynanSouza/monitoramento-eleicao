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
