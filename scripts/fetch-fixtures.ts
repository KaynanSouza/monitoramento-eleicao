/**
 * Baixa arquivos REAIS da divulgação do TSE (1º turno 2026) para fixtures/.
 * Respeita o limite do TSE: concorrência baixa, ~5 req/s, aborta após poucos 404
 * (muitos 404 bloqueiam o IP por 10 min). Municípios só a partir do mun-cm.json.
 *
 * Uso: npm run fixtures
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BASE = 'https://resultados.tse.jus.br';
const AMB = 'oficial';
const CICLO = 'ele2026';
const OUT = join(import.meta.dirname, '..', 'fixtures');

const MAX_404 = 5;
const MIN_INTERVAL_MS = 200; // ~5 req/s
let notFound = 0;
let last = 0;

const pad = (n: string | number, len: number) => String(n).padStart(len, '0');

async function get(path: string): Promise<unknown | null> {
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();

  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 404) {
    notFound++;
    console.warn(`404 ${path}`);
    if (notFound >= MAX_404) throw new Error(`Abortando: ${notFound} respostas 404`);
    return null;
  }
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const text = await res.text();
  const file = join(OUT, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  console.log(`ok  ${path} (${(text.length / 1024).toFixed(0)} KB)`);
  return JSON.parse(text);
}

type EleC = { pl: { c: string; cd: string; e: { cd: string; cdt2: string }[] }[] };
type MunCm = { abr: { cd: string; mu: { cd: string; cdi: string; nm: string }[] }[] };

const dados = (ele: string, uf: string, file: string) => `${AMB}/${CICLO}/${ele}/dados/${uf}/${file}`;
const result = (ele: string, uf: string, cargo: string, mun = '') =>
  dados(ele, uf, `${uf}${mun}-c${pad(cargo, 4)}-e${pad(ele, 6)}-u.json`);
const acomp = (ele: string, uf: string) => dados(ele, uf, `${uf}-e${pad(ele, 6)}-ab.json`);

async function main() {
  const eleC = (await get(`${AMB}/comum/config/ele-c.json`)) as EleC;
  const pleitos = eleC.pl.filter((p) => p.c === CICLO);
  console.log('Eleições 2026:', pleitos.flatMap((p) => p.e.map((e) => `${e.cd}→${e.cdt2 || '-'}`)).join(' '));

  const FED = '6257';
  const EST = '6259';

  const cm = (await get(`${AMB}/${CICLO}/${FED}/config/mun-e${pad(FED, 6)}-cm.json`)) as MunCm;
  await get(`${AMB}/${CICLO}/${EST}/config/mun-e${pad(EST, 6)}-cm.json`);
  const ufs = cm.abr.map((a) => a.cd);
  console.log('Abrangências no cm:', ufs.join(' '));

  // Presidente: Brasil + cada UF (mapa nacional por UF) + acompanhamento
  await get(acomp(FED, 'br'));
  await get(result(FED, 'br', '1'));
  for (const uf of ufs) {
    await get(result(FED, uf, '1'));
    await get(acomp(FED, uf));
  }

  // Estaduais: governador, senador, dep. federal por UF + acompanhamento
  await get(acomp(EST, 'br'));
  for (const uf of ufs.filter((u) => u !== 'zz')) {
    await get(acomp(EST, uf));
    for (const cargo of ['3', '5', '6']) await get(result(EST, uf, cargo));
  }

  // Municípios: AC inteiro (pres + gov) e as capitais SP/RJ (pres). Códigos só do cm.
  const munOf = (uf: string) => cm.abr.find((a) => a.cd === uf)?.mu ?? [];
  for (const m of munOf('ac')) {
    await get(result(FED, 'ac', '1', m.cd));
    await get(result(EST, 'ac', '3', m.cd));
  }
  for (const [uf, nome] of [['sp', 'SÃO PAULO'], ['rj', 'RIO DE JANEIRO']] as const) {
    const m = munOf(uf).find((x) => x.nm === nome);
    if (m) await get(result(FED, uf, '1', m.cd));
  }

  console.log(`Concluído. 404s: ${notFound}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
