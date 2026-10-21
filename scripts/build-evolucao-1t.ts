/**
 * Reconstrói a "Evolução da apuração" do 1º turno (04/10/2026) a partir dos arquivos
 * oficiais do TSE e grava src/historico/primeiroTurno.json, embutido no app.
 *
 * O app só tem histórico do que ele mesmo gravou ao vivo, e no 1º turno ele ainda não
 * existia. A reconstrução usa, para cada município, o horário em que ele terminou de
 * ser totalizado (EA15, `dt`/`ht`; o `dt` do próprio arquivo do município foi regerado
 * em 05/10 e não serve) e o resultado final do município (EA20). Em cada instante, a
 * curva soma os municípios já concluídos. Difere um pouco do que o TSE mostrava ao vivo
 * (que incluía municípios parcialmente apurados), mas usa só dados oficiais.
 *
 * Cerca de 17 mil requisições, a ~8 req/s (≈ 35 min na primeira vez). Cada arquivo baixado
 * fica resumido em node_modules/.cache/evolucao-1t, então rodar de novo é rápido.
 *
 * Uso: npx tsx scripts/build-evolucao-1t.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';
const RAIZ = join(import.meta.dirname, '..');
const FIX = join(RAIZ, 'fixtures', 'oficial', 'ele2026');
const CACHE = join(RAIZ, 'node_modules', '.cache', 'evolucao-1t');
const SAIDA = join(RAIZ, 'src', 'historico', 'primeiroTurno.json');

const CONCORRENCIA = 4;
const ESPACAMENTO_MS = 125; // ~8 req/s, bem abaixo do limite do TSE
const MAX_FALHAS = 5; // 404/erros seguidos: para antes de o IP ser bloqueado
const PASSO_MIN = 5; // um ponto a cada 5 min
const INICIO = Date.parse('2026-10-04T17:00:00-03:00'); // início da divulgação
const FIM = Date.parse('2026-10-05T06:00:00-03:00'); // mesma janela do app (serie.ts)
const TOP = 5;

const pad = (s: string | number, n: number) => String(s).padStart(n, '0');
const int = (s: string | undefined) => (s ? Number(s) || 0 : 0);
const quando = (dt: string, ht: string) => {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dt);
  return d && ht ? Date.parse(`${d[3]}-${d[2]}-${d[1]}T${ht}-03:00`) : NaN;
};

interface Resumo {
  ts: number; // seções
  vv: number; // válidos
  votos: Record<string, number>; // por sqcand
}

type Ea20 = {
  s: { ts: string };
  v: { vv: string; vansj?: string };
  carg: { agr: { par: { n: string; sg: string; cand: { sqcand: string; n: string; nmu: string; vap: string; dvt: string }[] }[] }[] }[];
};
type Ea15 = { abr: { tpabr: string; cdabr: string; dt: string; ht: string }[] };
type MunCm = { abr: { cd: string; mu: { cd: string }[] }[] };

function resumir(j: Ea20): Resumo {
  const votos: Record<string, number> = {};
  for (const a of j.carg[0]!.agr) for (const p of a.par) for (const c of p.cand) votos[c.sqcand] = int(c.vap);
  return { ts: int(j.s.ts), vv: int(j.v.vv), votos };
}

// ---------- rede, com fila e cache ----------

let ativos = 0;
let proximo = 0;
let falhasSeguidas = 0;
let feitos = 0;
const fila: (() => void)[] = [];

async function baixar(caminho: string): Promise<unknown> {
  if (ativos >= CONCORRENCIA) await new Promise<void>((r) => fila.push(r));
  else ativos++;
  try {
    const espera = Math.max(0, proximo - Date.now());
    proximo = Math.max(Date.now(), proximo) + ESPACAMENTO_MS;
    if (espera) await new Promise((r) => setTimeout(r, espera));
    for (let tentativa = 1; ; tentativa++) {
      const res = await fetch(`${BASE}/${caminho}`).catch(() => null);
      if (res?.ok) {
        falhasSeguidas = 0;
        return await res.json();
      }
      if (res && (res.status === 403 || res.status === 404)) {
        if (++falhasSeguidas >= MAX_FALHAS) throw new Error(`Abortando: ${falhasSeguidas} falhas seguidas (${res.status} ${caminho})`);
        throw new Error(`${res.status} ${caminho}`);
      }
      if (tentativa >= 4) throw new Error(`${res?.status ?? 'rede'} ${caminho}`);
      await new Promise((r) => setTimeout(r, 2000 * tentativa)); // 429/5xx/rede: espera e tenta de novo
    }
  } finally {
    const p = fila.shift();
    if (p) p();
    else ativos--;
  }
}

async function comCache<T>(chave: string, obter: () => Promise<T>): Promise<T> {
  const arq = join(CACHE, `${chave}.json`);
  if (existsSync(arq)) return JSON.parse(readFileSync(arq, 'utf8')) as T;
  const v = await obter();
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, JSON.stringify(v));
  if (++feitos % 250 === 0) console.log(`  ${feitos} arquivos baixados…`);
  return v;
}

const lerFixture = <T>(rel: string): T => JSON.parse(readFileSync(join(FIX, rel), 'utf8')) as T;

// ---------- montagem da série ----------

interface Escopo {
  ele: string;
  cargo: string;
  uf: string; // "br" ou UF
}

type Ponto = [minuto: number, pctSecoes: number, ...pct: number[]];

interface SerieGravada {
  candidatos: { sqcand: string; numero: string; nomeUrna: string; partido: string; sigla: string }[];
  /** [minutos desde a época, % seções, % de cada candidato na ordem acima] */
  pontos: Ponto[];
}

async function main() {
  const munCm = (ele: string) => lerFixture<MunCm>(`${ele}/config/mun-e${pad(ele, 6)}-cm.json`);
  const conclusao = new Map<string, number>(); // `${ele}:${mun}` → epoch ms

  for (const ele of ['6257', '6259']) {
    for (const { cd: uf } of munCm(ele).abr) {
      if (ele === '6259' && uf === 'zz') continue; // eleição estadual não tem exterior
      const rel = `${ele}/dados/${uf}/${uf}-e${pad(ele, 6)}-ab.json`;
      // EA15 do 1º turno é final: a fixture serve; senão, baixa.
      const ab = existsSync(join(FIX, rel))
        ? lerFixture<Ea15>(rel)
        : await comCache(`${ele}/${uf}-ab`, () => baixar(`${ele}/dados/${uf}/${uf}-e${pad(ele, 6)}-ab.json`) as Promise<Ea15>);
      for (const a of ab.abr) {
        const t = quando(a.dt, a.ht);
        if (a.tpabr === 'mun' && !Number.isNaN(t)) conclusao.set(`${ele}:${a.cdabr}`, t);
      }
    }
  }

  const escopos: Escopo[] = [];
  const ufs6257 = munCm('6257').abr.map((a) => a.cd);
  const ufs6259 = munCm('6259').abr.map((a) => a.cd).filter((u) => u !== 'zz');
  escopos.push({ ele: '6257', cargo: '1', uf: 'br' }, ...ufs6257.map((uf) => ({ ele: '6257', cargo: '1', uf })));
  for (const cargo of ['3', '5']) escopos.push(...ufs6259.map((uf) => ({ ele: '6259', cargo, uf })));

  // Resumo de cada município, por (eleição, cargo). Baixa tudo antes de montar.
  const municipios = new Map<string, { uf: string; mun: string; r: Resumo }[]>();
  for (const [ele, cargo, ufs] of [
    ['6257', '1', ufs6257],
    ['6259', '3', ufs6259],
    ['6259', '5', ufs6259],
  ] as const) {
    console.log(`Eleição ${ele}, cargo ${cargo}…`);
    const lista: { uf: string; mun: string }[] = munCm(ele)
      .abr.filter((a) => ufs.includes(a.cd))
      .flatMap((a) => a.mu.map((m) => ({ uf: a.cd, mun: m.cd })))
      .filter((m) => conclusao.has(`${ele}:${m.mun}`)); // sem horário = nunca totalizado (exterior sem votos)
    const resumos = await Promise.all(
      lista.map(async (m) => ({
        ...m,
        r: await comCache(`${ele}/${cargo}/${m.uf}${m.mun}`, async () =>
          resumir((await baixar(`${ele}/dados/${m.uf}/${m.uf}${m.mun}-c${pad(cargo, 4)}-e${pad(ele, 6)}-u.json`)) as Ea20),
        ),
      })),
    );
    municipios.set(`${ele}:${cargo}`, resumos);
  }

  const saida: Record<string, SerieGravada> = {};
  for (const e of escopos) {
    const final = lerFixture<Ea20>(`${e.ele}/dados/${e.uf}/${e.uf}-c${pad(e.cargo, 4)}-e${pad(e.ele, 6)}-u.json`);
    const totalSecoes = int(final.s.ts);
    // O % do TSE usa válidos + anulados sub judice como base (ex.: Governador RJ). Esses votos
    // não vêm por município: a base é escalada pela proporção final da abrangência.
    const vvFinal = int(final.v.vv);
    const escalaBase = vvFinal ? (vvFinal + int(final.v.vansj)) / vvFinal : 1;
    // Votos "anulados sub judice" vêm zerados nos arquivos municipais: esses candidatos
    // não têm como ser reconstruídos e ficam fora (top 5 entre os válidos).
    const cands = final.carg[0]!.agr
      .flatMap((a) => a.par.flatMap((p) => p.cand.filter((c) => c.dvt.startsWith('Válido')).map((c) => ({ sqcand: c.sqcand, numero: c.n, nomeUrna: c.nmu, partido: p.n, sigla: p.sg, votos: int(c.vap) }))))
      .sort((a, b) => b.votos - a.votos)
      .slice(0, TOP);

    const eventos = municipios
      .get(`${e.ele}:${e.cargo}`)!
      .filter((m) => e.uf === 'br' || m.uf === e.uf)
      .map((m) => ({ t: Math.max(INICIO, conclusao.get(`${e.ele}:${m.mun}`)!), r: m.r }))
      .filter((x) => x.t < FIM)
      .sort((a, b) => a.t - b.t);

    const pontos: Ponto[] = [];
    let secoes = 0;
    let validos = 0;
    const votos = cands.map(() => 0);
    let i = 0;
    for (let fimPasso = INICIO; i < eventos.length; fimPasso += PASSO_MIN * 60_000) {
      let mudou = false;
      while (i < eventos.length && eventos[i]!.t <= fimPasso) {
        const { r } = eventos[i++]!;
        secoes += r.ts;
        validos += r.vv;
        cands.forEach((c, k) => (votos[k]! += r.votos[c.sqcand] ?? 0));
        mudou = true;
      }
      if (!mudou || !validos) continue;
      const r3 = (x: number) => Math.round(x * 1000) / 1000;
      pontos.push([Math.round(fimPasso / 60_000), r3((secoes / totalSecoes) * 100), ...votos.map((v) => r3((v / (validos * escalaBase)) * 100))]);
    }
    saida[`${e.ele}:${e.cargo}:${e.uf}`] = { candidatos: cands.map(({ votos: _v, ...c }) => c), pontos };
  }

  writeFileSync(SAIDA, JSON.stringify({ fonte: 'TSE: EA15 (horário de conclusão) + EA20 municipal', series: saida }));
  console.log(`Gravado ${SAIDA}: ${Object.keys(saida).length} séries, ${(readFileSync(SAIDA).length / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
