import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerFixture, listarFixtures } from '@/test/fixtures';
import { normalizarMunicipios, normalizarResultado } from '@/tse/normalize';
import { camadasMunicipios, corArea, lideresNoMapa, resumir, type ResumoArea } from './dados';
import { caixaDe, caminhoAneis, type Malha, municipioEm, pontoNosAneis, ufEm } from './geo';

const malha = JSON.parse(readFileSync(join(__dirname, 'geo-brasil.json'), 'utf8')) as Malha;
const cm = normalizarMunicipios(lerFixture('oficial/ele2026/6257/config/mun-e006257-cm.json'));

/** Centro aproximado de um município: ponto interno achado por varredura do bbox. */
function pontoInterno(ibge: string): [number, number] {
  const m = malha.mun.find((x) => x.i === ibge)!;
  const [x0, y0, x1, y1] = m.b;
  for (let k = 1; k < 40; k++)
    for (let j = 1; j < 40; j++) {
      const x = x0 + ((x1 - x0) * k) / 40;
      const y = y0 + ((y1 - y0) * j) / 40;
      if (pontoNosAneis(x, y, m.r)) return [x, y];
    }
  throw new Error(`sem ponto interno em ${ibge}`);
}

describe('malha do mapa', () => {
  it('5.571 municípios e 27 UFs, todos com geometria', () => {
    expect(malha.mun).toHaveLength(5571);
    expect(malha.ufs).toHaveLength(27);
    expect(malha.mun.every((m) => m.r.length > 0)).toBe(true);
  });

  it('join 100% com o mun-cm.json do TSE (inclui Boa Esperança do Norte/MT)', () => {
    const ibge = new Set(malha.mun.map((m) => m.i));
    const tse = cm.ufs.filter((u) => u.uf !== 'zz').flatMap((u) => u.municipios.map((m) => m.ibge));
    expect(tse.filter((c) => !ibge.has(c))).toEqual([]);
    expect(ibge.has('5101837')).toBe(true);
  });

  it('UF do município confere com a UF do TSE', () => {
    const ufPorIbge = new Map(cm.ufs.flatMap((u) => u.municipios.map((m) => [m.ibge, u.uf] as const)));
    expect(malha.mun.filter((m) => ufPorIbge.get(m.i) !== m.u)).toEqual([]);
  });

  it('toque: acha o município e a UF certos', () => {
    for (const [ibge, uf] of [
      ['3550308', 'sp'],
      ['3304557', 'rj'],
      ['5300108', 'df'],
      ['1200401', 'ac'],
      ['5101837', 'mt'],
    ] as const) {
      const [x, y] = pontoInterno(ibge);
      expect(municipioEm(malha, x, y)?.i, ibge).toBe(ibge);
      expect(ufEm(malha, x, y), ibge).toBe(uf);
    }
    expect(municipioEm(malha, -10, -10)).toBeNull();
  });

  it('caminho SVG e caixa', () => {
    expect(caminhoAneis([[0, 0, 10, 0, 10, 10]])).toBe('M0,0 10,0 10,10Z');
    const [x0, , x1] = caixaDe(malha.ufs.filter((u) => u.uf === 'sp'));
    expect(x1 - x0).toBeGreaterThan(50);
  });
});

describe('dados do mapa', () => {
  const resultadosAc = listarFixtures(/\/ac\/ac\d{5}-c0001-e006257-u\.json$/).map((a) => normalizarResultado(lerFixture(a)));
  const ibgePorTse = new Map(cm.ufs.flatMap((u) => u.municipios.map((m) => [m.tse, m.ibge] as const)));
  const resumos = new Map<string, ResumoArea>(
    resultadosAc.map((r) => [ibgePorTse.get(r.abrangencia)!, resumir(r)!] as const),
  );

  it('resumo: líder, segundo e degrau de margem', () => {
    const r = resumir(normalizarResultado(lerFixture('oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json')))!;
    expect(r.lider.nomeUrna).toBe('FLAVIO BOLSONARO');
    expect(r.segundo?.nomeUrna).toBe('LULA');
    expect(r.degrau).toBe(0);
  });

  it('cor mais clara quanto menor a margem', () => {
    const base: ResumoArea = {
      lider: { sqcand: '1', numero: '13', nomeUrna: 'X', partido: '13', sigla: 'PT', pct: 50 },
      segundo: null,
      margem: 2,
      degrau: 0,
      pctSecoes: 100,
    };
    expect(corArea({ ...base, degrau: 4 }, '#FFFFFF')).toBe('#C8102E');
    expect(corArea(base, '#FFFFFF')).not.toBe('#C8102E');
  });

  it('agrupa os 22 municípios do AC em poucas camadas por cor', () => {
    const { camadas, ufsComMunicipios } = camadasMunicipios(malha, resumos, '#FFFFFF');
    expect([...ufsComMunicipios]).toEqual(['ac']);
    expect(camadas.length).toBeGreaterThan(0);
    expect(camadas.length).toBeLessThanOrEqual(10);
    expect(camadas.reduce((n, c) => n + (c.d.match(/Z/g)?.length ?? 0), 0)).toBeGreaterThanOrEqual(22);
    expect(lideresNoMapa(resumos.values())[0]?.nomeUrna).toBeDefined();
  });
});

describe('toque na tela → malha', () => {
  const caixa: [number, number, number, number] = [0, 0, 2000, 2102];
  it('sem zoom: cantos e centro', async () => {
    const { telaParaMalha } = await import('./geo');
    // área 400×400: o Brasil (mais alto que largo) ocupa 400 de altura, centralizado na largura
    const k = 400 / 2102;
    const [x, y] = telaParaMalha(200, 200, 400, 400, caixa);
    expect(x).toBeCloseTo(1000, 0);
    expect(y).toBeCloseTo(1051, 0);
    const [x0, y0] = telaParaMalha((400 - 2000 * k) / 2, 0, 400, 400, caixa);
    expect(x0).toBeCloseTo(0, 0);
    expect(y0).toBeCloseTo(0, 0);
  });
  it('com zoom 2× e arraste', async () => {
    const { telaParaMalha } = await import('./geo');
    // ponto que estava no centro continua no centro após escala 2 sem translação
    expect(telaParaMalha(200, 200, 400, 400, caixa, 2)[0]).toBeCloseTo(1000, 0);
    // arrastar 100 px para a direita: o centro da tela mostra o que estava 50 px (tela) à esquerda
    const [x] = telaParaMalha(200, 200, 400, 400, caixa, 2, 100, 0);
    expect(x).toBeCloseTo(1000 - 50 / (400 / 2102), 0);
  });
  it('toque em SP pela tela acha São Paulo', async () => {
    const { telaParaMalha } = await import('./geo');
    const [mx, my] = pontoInterno('3550308');
    const k = 400 / 2102;
    const ox = (400 - 2000 * k) / 2;
    const [x, y] = telaParaMalha(ox + mx * k, my * k, 400, 400, caixa);
    expect(municipioEm(malha, x, y)?.i).toBe('3550308');
  });
});
