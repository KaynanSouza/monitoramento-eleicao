import { describe, expect, it } from 'vitest';
import { lerFixture } from '@/test/fixtures';
import { cargosDisponiveis, resolverEleicao } from './eleicoes';
import { normalizarEleicoes, normalizarMunicipios } from './normalize';
import { criarUrls, IndiceMunicipios, UrlInvalidaError } from './urls';

const ep = { base: 'https://resultados.tse.jus.br', ambiente: 'oficial', ciclo: 'ele2026' };
const indice = new IndiceMunicipios(
  normalizarMunicipios(lerFixture('oficial/ele2026/6257/config/mun-e006257-cm.json')),
);
const urls = criarUrls(ep, indice);
const B = 'https://resultados.tse.jus.br/oficial';

describe('URLs (padrões confirmados com arquivos reais)', () => {
  it('config', () => {
    expect(urls.eleicoesConfig()).toBe(`${B}/comum/config/ele-c.json`);
    expect(urls.municipiosConfig('6257')).toBe(`${B}/ele2026/6257/config/mun-e006257-cm.json`);
  });

  it('acompanhamento EA14/EA15', () => {
    expect(urls.acompanhamento('6257', 'br')).toBe(`${B}/ele2026/6257/dados/br/br-e006257-ab.json`);
    expect(urls.acompanhamento('6259', 'sp')).toBe(`${B}/ele2026/6259/dados/sp/sp-e006259-ab.json`);
  });

  it('resultado Brasil/UF', () => {
    expect(urls.resultado('6257', '1', 'br')).toBe(`${B}/ele2026/6257/dados/br/br-c0001-e006257-u.json`);
    expect(urls.resultado('6259', '6', 'sp')).toBe(`${B}/ele2026/6259/dados/sp/sp-c0006-e006259-u.json`);
  });

  it('resultado de município com zeros à esquerda', () => {
    expect(urls.resultadoMunicipio('6257', '1', 'ac', '01120')).toBe(
      `${B}/ele2026/6257/dados/ac/ac01120-c0001-e006257-u.json`,
    );
  });

  it('foto oficial', () => {
    expect(urls.foto('6257', 'br', '280002551544')).toBe(`${B}/ele2026/6257/fotos/br/280002551544.jpeg`);
  });

  it('recusa URLs que gerariam 404', () => {
    expect(() => urls.resultadoMunicipio('6257', '1', 'ac', '1120')).toThrow(UrlInvalidaError);
    expect(() => urls.resultadoMunicipio('6257', '1', 'ac', '99999')).toThrow(UrlInvalidaError);
    expect(() => urls.resultadoMunicipio('6257', '1', 'sp', '01120')).toThrow(UrlInvalidaError); // é do AC
    expect(() => urls.resultado('6257', '1', 'xx')).toThrow(UrlInvalidaError);
    expect(() => urls.resultado('6257', '1', 'SP')).toThrow(UrlInvalidaError);
    expect(() => urls.resultado('abc', '1', 'sp')).toThrow(UrlInvalidaError);
    expect(() => criarUrls(ep).resultadoMunicipio('6257', '1', 'ac', '01120')).toThrow(/índice/);
  });
});

describe('resolverEleicao', () => {
  const eleicoes = normalizarEleicoes(lerFixture('oficial/comum/config/ele-c.json'), 'ele2026');

  it('1º turno vem do ele-c', () => {
    expect(resolverEleicao(eleicoes, 1, '1')).toEqual({ codigo: '6257', origem: 'ele-c', abrangencias: ['br'] });
    expect(resolverEleicao(eleicoes, 1, '6')?.codigo).toBe('6259');
  });

  it('2º turno ainda não publicado: usa cdt2 (provisório)', () => {
    expect(resolverEleicao(eleicoes, 2, '1')).toEqual({ codigo: '6258', origem: 'cdt2', abrangencias: null });
    expect(resolverEleicao(eleicoes, 2, '3')?.codigo).toBe('6260');
  });

  it('Senador e deputados nunca resolvem para 2º turno (evita 404)', () => {
    for (const cargo of ['5', '6', '7', '8']) expect(resolverEleicao(eleicoes, 2, cargo), cargo).toBeNull();
  });

  it('2º turno publicado no ele-c tem prioridade sobre cdt2', () => {
    const comT2 = [
      ...eleicoes,
      {
        codigo: '6260',
        codigoSegundoTurno: null,
        turno: 2 as const,
        nome: '2º turno estadual',
        pleito: '3221',
        data: '25/10/2026',
        abrangencias: ['sp', 'rj'],
        cargos: [{ codigo: '3', nome: 'Governador', tipo: '1' }],
      },
    ];
    expect(resolverEleicao(comT2, 2, '3')).toEqual({ codigo: '6260', origem: 'ele-c', abrangencias: ['sp', 'rj'] });
    // Senador não tem 2º turno: o cdt2 da eleição estadual ainda resolveria, mas o
    // cargo não está publicado no 2º turno → a UI decide pela lista de cargos do turno.
  });

  it('ajuste manual tem prioridade', () => {
    expect(resolverEleicao(eleicoes, 2, '1', { '2:1': '9999' })).toEqual({
      codigo: '9999',
      origem: 'manual',
      abrangencias: null,
    });
  });

  it('cargos disponíveis por turno (abas)', () => {
    expect(cargosDisponiveis(eleicoes, 1)).toEqual([
      { codigo: '1', nome: 'Presidente', nacional: true },
      { codigo: '3', nome: 'Governador', nacional: false },
      { codigo: '5', nome: 'Senador', nacional: false },
      { codigo: '6', nome: 'Deputado Federal', nacional: false },
    ]);
    expect(cargosDisponiveis(eleicoes, 2).map((c) => c.nome)).toEqual(['Presidente', 'Governador']);
  });

  it('cargo inexistente', () => {
    expect(resolverEleicao(eleicoes, 1, '42')).toBeNull();
  });
});
