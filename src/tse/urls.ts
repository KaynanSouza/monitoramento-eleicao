/**
 * Construtor de URLs da divulgação do TSE. Toda URL de UF/município é validada
 * contra o mun-cm.json antes de ser gerada: muitos 404 bloqueiam o IP por 10 min.
 *
 * Padrões confirmados com arquivos reais (ver docs/formato-tse.md):
 *   {base}/{amb}/comum/config/ele-c.json
 *   {base}/{amb}/{ciclo}/{ele}/config/mun-e{ele6}-cm.json
 *   {base}/{amb}/{ciclo}/{ele}/dados/{uf}/{uf}-e{ele6}-ab.json              EA14 (br) / EA15 (uf)
 *   {base}/{amb}/{ciclo}/{ele}/dados/{uf}/{uf}[{mun5}]-c{cargo4}-e{ele6}-u.json  EA20
 *   {base}/{amb}/{ciclo}/{ele}/fotos/{uf}/{sqcand}.jpeg
 */
import type { MunicipiosConfig } from './types';

export interface TseEndpoint {
  base: string; // https://resultados.tse.jus.br
  ambiente: string; // oficial | simulado2026
  ciclo: string; // ele2026
}

export class UrlInvalidaError extends Error {
  constructor(motivo: string) {
    super(`URL do TSE não gerada: ${motivo}`);
    this.name = 'UrlInvalidaError';
  }
}

const pad = (s: string, n: number) => s.padStart(n, '0');

function codigoEleicao(ele: string): string {
  if (!/^\d{1,6}$/.test(ele)) throw new UrlInvalidaError(`código de eleição inválido "${ele}"`);
  return ele;
}

function codigoCargo(cargo: string): string {
  if (!/^\d{1,4}$/.test(cargo)) throw new UrlInvalidaError(`código de cargo inválido "${cargo}"`);
  return pad(cargo, 4);
}

/** Índice de UFs e municípios válidos, construído a partir do mun-cm.json. */
export class IndiceMunicipios {
  private readonly porUf = new Map<string, Set<string>>();

  constructor(cfg: MunicipiosConfig) {
    for (const u of cfg.ufs) this.porUf.set(u.uf, new Set(u.municipios.map((m) => m.tse)));
  }

  temUf(uf: string): boolean {
    return this.porUf.has(uf);
  }

  temMunicipio(uf: string, tse: string): boolean {
    return this.porUf.get(uf)?.has(tse) ?? false;
  }
}

export function criarUrls(ep: TseEndpoint, indice?: IndiceMunicipios) {
  const raiz = `${ep.base}/${ep.ambiente}`;
  const eleicao = (ele: string) => `${raiz}/${ep.ciclo}/${codigoEleicao(ele)}`;

  function validarUf(uf: string): string {
    if (uf === 'br') return uf;
    if (!/^[a-z]{2}$/.test(uf)) throw new UrlInvalidaError(`UF inválida "${uf}"`);
    if (indice && !indice.temUf(uf)) throw new UrlInvalidaError(`UF "${uf}" não consta no mun-cm.json`);
    return uf;
  }

  return {
    eleicoesConfig: () => `${raiz}/comum/config/ele-c.json`,

    municipiosConfig: (ele: string) => `${eleicao(ele)}/config/mun-e${pad(ele, 6)}-cm.json`,

    /** EA14 com uf="br" (UFs do país); EA15 com uf (municípios da UF). */
    acompanhamento: (ele: string, uf: string) => {
      const u = validarUf(uf);
      return `${eleicao(ele)}/dados/${u}/${u}-e${pad(ele, 6)}-ab.json`;
    },

    /** EA20 de abrangência Brasil ou UF. */
    resultado: (ele: string, cargo: string, uf: string) => {
      const u = validarUf(uf);
      return `${eleicao(ele)}/dados/${u}/${u}-c${codigoCargo(cargo)}-e${pad(ele, 6)}-u.json`;
    },

    /** EA20 de município. Exige o índice: nunca gera URL de município não listado no mun-cm. */
    resultadoMunicipio: (ele: string, cargo: string, uf: string, tse: string) => {
      const u = validarUf(uf);
      if (u === 'br') throw new UrlInvalidaError('município exige UF');
      if (!/^\d{5}$/.test(tse)) throw new UrlInvalidaError(`código de município deve ter 5 dígitos: "${tse}"`);
      if (!indice) throw new UrlInvalidaError('índice de municípios não carregado');
      if (!indice.temMunicipio(u, tse)) throw new UrlInvalidaError(`município ${tse} não existe em ${u}`);
      return `${eleicao(ele)}/dados/${u}/${u}${tse}-c${codigoCargo(cargo)}-e${pad(ele, 6)}-u.json`;
    },

    foto: (ele: string, uf: string, sqcand: string) => {
      if (!/^\d+$/.test(sqcand)) throw new UrlInvalidaError(`sqcand inválido "${sqcand}"`);
      return `${eleicao(ele)}/fotos/${validarUf(uf)}/${sqcand}.jpeg`;
    },
  };
}

export type TseUrls = ReturnType<typeof criarUrls>;
