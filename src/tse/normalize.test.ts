import { describe, expect, it } from 'vitest';
import { lerFixture, listarFixtures } from '@/test/fixtures';
import {
  mapearSituacao,
  normalizarAcompanhamento,
  normalizarEleicoes,
  normalizarMunicipios,
  normalizarResultado,
  TseFormatoError,
} from './normalize';

const PRES_BR = 'oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json';

describe('EA20 Presidente, Brasil, 1º turno (arquivo real)', () => {
  const r = normalizarResultado(lerFixture(PRES_BR), PRES_BR);

  it('metadados da apuração', () => {
    expect(r.eleicao).toBe('6257');
    expect(r.turno).toBe(1);
    expect(r.tipoAbrangencia).toBe('br');
    expect(r.cargo).toEqual({ codigo: '1', nome: 'Presidente', vagas: 1 });
    expect(r.totalizacaoFinal).toBe(true);
    expect(r.andamento).toBe('f');
    expect(r.mensagem).toBeNull();
    expect(r.atualizadoEm).toBe('2026-10-05T12:51:05-03:00');
  });

  it('seções apuradas', () => {
    expect(r.secoes).toEqual({ total: 499248, totalizadas: 499248, pct: 100, pctTexto: '100,00' });
  });

  it('cinco primeiros na ordem e com os números oficiais', () => {
    const top = r.candidatos.slice(0, 5).map((c) => [c.nomeUrna, c.numero, c.partido.sigla, c.pctTexto, c.votos]);
    expect(top).toEqual([
      ['FLAVIO BOLSONARO', '22', 'PL', '47,03', 56104503],
      ['LULA', '13', 'PT', '45,16', 53879538],
      ['ESCRITOR AUGUSTO CURY', '70', 'AVANTE', '2,89', 3448569],
      ['RENAN SANTOS', '14', 'MISSÃO', '2,24', 2675887],
      ['RONALDO CAIADO', '55', 'PSD', '2,18', 2605148],
    ]);
  });

  it('selos só conforme o arquivo: 2 no 2º turno, nenhum eleito', () => {
    const seg = r.candidatos.filter((c) => c.situacao === 'segundo_turno').map((c) => c.nomeUrna);
    expect(seg).toEqual(['FLAVIO BOLSONARO', 'LULA']);
    expect(r.candidatos.some((c) => c.situacao === 'eleito')).toBe(false);
  });

  it('soma dos votos dos candidatos = votos válidos', () => {
    expect(r.candidatos.reduce((s, c) => s + c.votos, 0)).toBe(r.votos.validos);
  });
});

describe('todos os EA20 reais', () => {
  const arquivos = listarFixtures(/-u\.json$/);

  it('há fixtures', () => expect(arquivos.length).toBeGreaterThan(100));

  it.each(arquivos)('%s valida e normaliza', (arq) => {
    const r = normalizarResultado(lerFixture(arq), arq);
    expect(r.candidatos.length).toBeGreaterThan(0);
    expect(r.secoes.totalizadas).toBeLessThanOrEqual(r.secoes.total);
    for (let i = 1; i < r.candidatos.length; i++) {
      expect(r.candidatos[i - 1]!.votos).toBeGreaterThanOrEqual(r.candidatos[i]!.votos);
    }
    // Sem totalização final, nenhum selo pode aparecer.
    if (!r.totalizacaoFinal) expect(r.candidatos.every((c) => c.situacao === 'pendente')).toBe(true);
  });

  it('majoritários: soma dos votos válidos dos candidatos = votos válidos', () => {
    for (const arq of arquivos.filter((a) => /-c000[135]-/.test(a))) {
      const r = normalizarResultado(lerFixture(arq), arq);
      const soma = r.candidatos.filter((c) => c.votoValido).reduce((s, c) => s + c.votos, 0);
      expect(soma, arq).toBe(r.votos.validos);
    }
  });
});

describe('situações e totalização em andamento', () => {
  it('mapeia todos os valores de `st` vistos nos arquivos reais', () => {
    expect(mapearSituacao('2º turno')).toBe('segundo_turno');
    expect(mapearSituacao('Eleito')).toBe('eleito');
    expect(mapearSituacao('Eleito por QP')).toBe('eleito');
    expect(mapearSituacao('Eleito por média')).toBe('eleito');
    expect(mapearSituacao('Suplente')).toBe('suplente');
    expect(mapearSituacao('Não eleito')).toBe('nao_eleito');
    expect(mapearSituacao('')).toBe('pendente');
    expect(mapearSituacao('Valor novo')).toBe('pendente');
  });

  it('Dep. Federal PE em reprocessamento: tf=n, mensagem e sem selos', () => {
    const arq = 'oficial/ele2026/6259/dados/pe/pe-c0006-e006259-u.json';
    const r = normalizarResultado(lerFixture(arq), arq);
    expect(r.totalizacaoFinal).toBe(false);
    expect(r.andamento).toBe('p');
    expect(r.mensagem).toBe('Aguarde reprocessamento da eleição');
    expect(r.candidatos.every((c) => c.situacao === 'pendente')).toBe(true);
  });

  it('Governador SP: eleito ou 2º turno vem do arquivo', () => {
    const arq = 'oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json';
    const r = normalizarResultado(lerFixture(arq), arq);
    expect(r.cargo.codigo).toBe('3');
    const comSelo = r.candidatos.filter((c) => c.situacao === 'eleito' || c.situacao === 'segundo_turno');
    expect(comSelo.length === 1 || comSelo.length === 2).toBe(true);
  });

  it('Senador: vagas e candidatos anulados sub judice marcados', () => {
    const arqs = listarFixtures(/-c0005-e006259-u\.json$/);
    const todos = arqs.flatMap((a) => normalizarResultado(lerFixture(a), a).candidatos);
    expect(todos.some((c) => !c.votoValido)).toBe(true);
    expect(todos.filter((c) => !c.votoValido).every((c) => c.situacao !== 'eleito')).toBe(true);
  });
});

describe('município (EA20 abrangência mu)', () => {
  it('Rio Branco/AC presidente', () => {
    const arqs = listarFixtures(/\/ac\/ac\d{5}-c0001-e006257-u\.json$/);
    expect(arqs.length).toBe(22);
    const r = normalizarResultado(lerFixture(arqs[0]!), arqs[0]);
    expect(r.tipoAbrangencia).toBe('mu');
    expect(r.abrangencia).toMatch(/^\d{5}$/);
  });
});

describe('EA14/EA15 acompanhamento', () => {
  it('EA14 presidente: 27 UFs + exterior, todas totalizadas', () => {
    const a = normalizarAcompanhamento(lerFixture('oficial/ele2026/6257/dados/br/br-e006257-ab.json'));
    const ufs = a.itens.filter((i) => i.tipo === 'uf');
    expect(ufs.length).toBe(28);
    expect(ufs.every((u) => u.atualizadoEm && u.secoes.pct === 100)).toBe(true);
    expect(a.itens.find((i) => i.tipo === 'br')?.secoes.totalizadas).toBe(499248);
  });

  it('EA15 SP: municípios com código de 5 dígitos', () => {
    const a = normalizarAcompanhamento(lerFixture('oficial/ele2026/6259/dados/sp/sp-e006259-ab.json'));
    const mun = a.itens.filter((i) => i.tipo === 'mun');
    expect(mun.length).toBe(645);
    expect(mun.every((m) => /^\d{5}$/.test(m.codigo))).toBe(true);
  });
});

describe('mun-cm.json', () => {
  const cfg = normalizarMunicipios(lerFixture('oficial/ele2026/6257/config/mun-e006257-cm.json'));
  const brasil = cfg.ufs.filter((u) => u.uf !== 'zz');

  it('27 UFs e 5.571 municípios (inclui Boa Esperança do Norte/MT, criado em 2024)', () => {
    expect(brasil.length).toBe(27);
    expect(brasil.reduce((s, u) => s + u.municipios.length, 0)).toBe(5571);
  });

  it('todo município do Brasil tem código IBGE de 7 dígitos, únicos', () => {
    const ibge = brasil.flatMap((u) => u.municipios.map((m) => m.ibge));
    expect(ibge.every((c) => /^\d{7}$/.test(c))).toBe(true);
    expect(new Set(ibge).size).toBe(ibge.length);
  });

  it('uma capital por UF', () => {
    for (const u of brasil) expect(u.municipios.filter((m) => m.capital).length, u.uf).toBe(1);
  });
});

describe('ele-c.json', () => {
  const eleicoes = normalizarEleicoes(lerFixture('oficial/comum/config/ele-c.json'), 'ele2026');

  it('eleições de 2026 e códigos de 2º turno', () => {
    expect(eleicoes.map((e) => [e.codigo, e.codigoSegundoTurno, e.turno])).toEqual([
      ['6257', '6258', 1],
      ['6259', '6260', 1],
      ['6261', null, 1],
    ]);
    expect(eleicoes[1]!.cargos.map((c) => c.codigo)).toEqual(['3', '5', '6', '7', '8']);
  });
});

describe('erro amigável quando o formato diverge', () => {
  it('lança TseFormatoError com detalhes', () => {
    const quebrado = { ...(lerFixture(PRES_BR) as object), s: { ts: 1 } };
    try {
      normalizarResultado(quebrado, 'x.json');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TseFormatoError);
      expect((e as TseFormatoError).message).toMatch(/formato inesperado/);
      expect((e as TseFormatoError).detalhes).toMatch(/^s\./);
    }
  });
});
