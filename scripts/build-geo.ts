/**
 * Gera src/mapa/geo-brasil.json: malha municipal do IBGE pré-projetada (inteiros),
 * pronta para desenhar com react-native-svg sem projeção em tempo de execução.
 *
 * Fontes (IBGE):
 *  - API de malhas v3, qualidade mínima: municípios e UFs do Brasil (malha 2022);
 *  - geoftp, malha municipal 2024 de MT: inclui Boa Esperança do Norte (5101837),
 *    criado em 2024 e já presente no mun-cm.json do TSE. Todos os municípios de MT
 *    são trocados pela versão 2024, simplificada para densidade parecida.
 *
 * Valida o join com o TSE: todo município do mun-cm.json (exceto exterior) precisa
 * ter geometria pelo código IBGE (cdi), e vice-versa. Se não casar 100%, falha.
 *
 * Uso: npm run build-geo
 */
import AdmZip from 'adm-zip';
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as shapefile from 'shapefile';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import type { GeometryCollection, Topology } from 'topojson-specification';

const RAIZ = join(import.meta.dirname, '..');
const SAIDA = join(RAIZ, 'src', 'mapa', 'geo-brasil.json');
const CM = join(RAIZ, 'fixtures', 'oficial', 'ele2026', '6257', 'config', 'mun-e006257-cm.json');

const API = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&qualidade=minima';
const MT_2024 =
  'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MT/MT_Municipios_2024.zip';

/** Largura do sistema de coordenadas (inteiros). Altura sai da proporção do Brasil. */
const LARGURA = 2000;

/** Código IBGE de UF (2 primeiros dígitos) → sigla. */
const UF_IBGE: Record<string, string> = {
  '11': 'ro', '12': 'ac', '13': 'am', '14': 'rr', '15': 'pa', '16': 'ap', '17': 'to',
  '21': 'ma', '22': 'pi', '23': 'ce', '24': 'rn', '25': 'pb', '26': 'pe', '27': 'al', '28': 'se', '29': 'ba',
  '31': 'mg', '32': 'es', '33': 'rj', '35': 'sp',
  '41': 'pr', '42': 'sc', '43': 'rs',
  '50': 'ms', '51': 'mt', '52': 'go', '53': 'df',
};

type Geo = Feature<Polygon | MultiPolygon, { id: string }>;

async function baixarJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return (await r.json()) as T;
}

async function topoParaFeatures(url: string): Promise<Geo[]> {
  const topo = await baixarJson<Topology>(url);
  const nome = Object.keys(topo.objects)[0]!;
  const fc = feature(topo, topo.objects[nome] as GeometryCollection) as FeatureCollection<
    Polygon | MultiPolygon,
    { codarea: string }
  >;
  return fc.features.map((f) => ({ ...f, properties: { id: f.properties.codarea } }));
}

function contarPontos(fs: Geo[]): number {
  let n = 0;
  for (const f of fs) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) for (const anel of p) n += anel.length;
  }
  return n;
}

/** MT 2024 do geoftp, simplificado até ~`alvo` pontos. */
async function mt2024(alvo: number): Promise<Geo[]> {
  const cache = join(tmpdir(), 'MT_Municipios_2024.zip');
  let zip: Buffer;
  try {
    zip = await readFile(cache);
  } catch {
    const r = await fetch(MT_2024);
    if (!r.ok) throw new Error(`${r.status} ${MT_2024}`);
    zip = Buffer.from(await r.arrayBuffer());
    await writeFile(cache, zip);
  }
  const z = new AdmZip(zip);
  const entrada = (ext: string) => z.getEntries().find((e) => e.entryName.toLowerCase().endsWith(ext))!.getData();
  const fc = (await shapefile.read(entrada('.shp'), entrada('.dbf'))) as FeatureCollection<
    Polygon | MultiPolygon,
    { CD_MUN: string }
  >;

  const topo = presimplify(topology({ mt: fc }) as unknown as Parameters<typeof presimplify>[0]);
  // Busca binária no quantil de "peso" que dá ~alvo pontos.
  let lo = 0;
  let hi = 1;
  let melhor: Geo[] = [];
  for (let i = 0; i < 20; i++) {
    const q = (lo + hi) / 2;
    const s = simplify(topo, quantile(topo, q));
    const fs = (feature(s, s.objects.mt as GeometryCollection) as FeatureCollection<
      Polygon | MultiPolygon,
      { CD_MUN: string }
    >).features.map((f) => ({ ...f, properties: { id: String(f.properties.CD_MUN) } }));
    melhor = fs;
    const n = contarPontos(fs);
    if (n > alvo) hi = q;
    else lo = q;
    if (Math.abs(n - alvo) / alvo < 0.05) break;
  }
  return melhor;
}

function projetarAneis(f: Geo, proj: (p: Position) => [number, number] | null): number[][] {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const aneis: number[][] = [];
  for (const p of polys) {
    for (const anel of p) {
      const plano: number[] = [];
      let ax = NaN;
      let ay = NaN;
      for (const pos of anel) {
        const xy = proj(pos);
        if (!xy) continue;
        const x = Math.round(xy[0]);
        const y = Math.round(xy[1]);
        if (x === ax && y === ay) continue; // remove pontos repetidos após arredondar
        plano.push(x, y);
        ax = x;
        ay = y;
      }
      if (plano.length >= 6) aneis.push(plano);
    }
  }
  return aneis;
}

function bbox(aneis: number[][]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const a of aneis)
    for (let i = 0; i < a.length; i += 2) {
      x0 = Math.min(x0, a[i]!);
      x1 = Math.max(x1, a[i]!);
      y0 = Math.min(y0, a[i + 1]!);
      y1 = Math.max(y1, a[i + 1]!);
    }
  return [x0, y0, x1, y1];
}

async function main() {
  console.log('Baixando malhas do IBGE (API v3, qualidade mínima)...');
  const municipios2022 = await topoParaFeatures(`${API}&intrarregiao=municipio`);
  const ufs = await topoParaFeatures(`${API}&intrarregiao=UF`);

  const mt2022 = municipios2022.filter((f) => f.properties.id.startsWith('51'));
  console.log(`MT 2022: ${mt2022.length} municípios, ${contarPontos(mt2022)} pontos. Baixando MT 2024 (geoftp)...`);
  const mt = await mt2024(contarPontos(mt2022));
  console.log(`MT 2024: ${mt.length} municípios, ${contarPontos(mt)} pontos.`);
  const municipios = [...municipios2022.filter((f) => !f.properties.id.startsWith('51')), ...mt];

  // Join com o TSE: 100% obrigatório.
  const cm = JSON.parse(await readFile(CM, 'utf8')) as { abr: { cd: string; mu: { cdi: string; nm: string }[] }[] };
  const doTse = new Map(cm.abr.filter((a) => a.cd !== 'zz').flatMap((a) => a.mu.map((m) => [m.cdi, `${m.nm}/${a.cd}`])));
  const daMalha = new Set(municipios.map((f) => f.properties.id));
  const semGeo = [...doTse.keys()].filter((c) => !daMalha.has(c));
  const semTse = [...daMalha].filter((c) => !doTse.has(c));
  if (semGeo.length || semTse.length) {
    console.error('Join TSE × IBGE incompleto.');
    console.error('Sem geometria:', semGeo.map((c) => `${c} ${doTse.get(c)}`));
    console.error('Sem município no TSE:', semTse);
    process.exit(1);
  }
  console.log(`Join TSE × IBGE: ${doTse.size}/${doTse.size} municípios casados (100%).`);

  const proj = geoMercator().fitWidth(LARGURA, { type: 'FeatureCollection', features: ufs } as FeatureCollection);
  const altura = Math.ceil(geoPath(proj).bounds({ type: 'FeatureCollection', features: ufs } as FeatureCollection)[1][1]);
  const p = (pos: Position) => proj(pos as [number, number]);

  const saida = {
    fonte: 'IBGE: API de malhas v3 (qualidade mínima, 2022) + malha municipal 2024 de MT (geoftp)',
    largura: LARGURA,
    altura,
    ufs: ufs.map((f) => {
      const r = projetarAneis(f, p);
      return { uf: UF_IBGE[f.properties.id]!, b: bbox(r), r };
    }),
    mun: municipios
      .map((f) => {
        const r = projetarAneis(f, p);
        return { i: f.properties.id, u: UF_IBGE[f.properties.id.slice(0, 2)]!, b: bbox(r), r };
      })
      .sort((a, b) => a.i.localeCompare(b.i)),
  };
  const vazios = saida.mun.filter((m) => m.r.length === 0).map((m) => m.i);
  if (vazios.length) console.warn(`Atenção: ${vazios.length} municípios sumiram após arredondar:`, vazios.slice(0, 10));

  await mkdir(join(RAIZ, 'src', 'mapa'), { recursive: true });
  const texto = JSON.stringify(saida);
  await writeFile(SAIDA, texto);
  console.log(`Gerado src/mapa/geo-brasil.json: ${(texto.length / 1024 / 1024).toFixed(2)} MB, ${LARGURA}×${altura}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
