/**
 * Gera src/replay/dados.json: o subconjunto das fixtures reais que o modo replay
 * embute no app (JSON minificado, chave = caminho relativo à base do TSE).
 *
 * Inclui: ele-c, mun-cm (só o da eleição federal, servido também para a estadual),
 * Presidente BR + UFs + exterior, Governador e Senador por UF, EA14 de ambas,
 * EA15 e municípios do AC. Dep. Federal fica fora (arquivos grandes).
 *
 * Uso: npm run build-replay
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const FIX = join(RAIZ, 'fixtures');
const SAIDA = join(RAIZ, 'src', 'replay', 'dados.json');

const INCLUIR = [
  /^oficial\/comum\/config\/ele-c\.json$/,
  /^oficial\/ele2026\/6257\/config\/mun-e006257-cm\.json$/,
  /^oficial\/ele2026\/6257\/dados\/[a-z]{2}\/[a-z]{2}-c0001-e006257-u\.json$/,
  /^oficial\/ele2026\/(6257|6259)\/dados\/br\/br-e\d{6}-ab\.json$/,
  /^oficial\/ele2026\/(6257|6259)\/dados\/ac\/ac-e\d{6}-ab\.json$/,
  /^oficial\/ele2026\/6259\/dados\/[a-z]{2}\/[a-z]{2}-c000[35]-e006259-u\.json$/,
  /^oficial\/ele2026\/(6257|6259)\/dados\/ac\/ac\d{5}-c000[13]-e\d{6}-u\.json$/,
];

const percorrer = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? percorrer(p) : [p];
  });

const dados: Record<string, unknown> = {};
for (const p of percorrer(FIX)) {
  const rel = relative(FIX, p).replaceAll('\\', '/');
  if (INCLUIR.some((r) => r.test(rel))) dados[rel] = JSON.parse(readFileSync(p, 'utf8'));
}

const texto = JSON.stringify(dados);
writeFileSync(SAIDA, texto);
console.log(`${Object.keys(dados).length} arquivos, ${(texto.length / 1024 / 1024).toFixed(2)} MB → ${relative(RAIZ, SAIDA)}`);
