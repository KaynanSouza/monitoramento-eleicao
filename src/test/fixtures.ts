/** Acesso às fixtures reais do TSE nos testes (Node). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const FIXTURES = join(__dirname, '..', '..', 'fixtures');
export const ELE2026 = join(FIXTURES, 'oficial', 'ele2026');

export function lerFixture(caminho: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, caminho), 'utf8'));
}

function percorrer(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? percorrer(p) : [p];
  });
}

/** Caminhos relativos a fixtures/ (com "/") dos arquivos que casam com o filtro. */
export function listarFixtures(filtro: RegExp): string[] {
  return percorrer(FIXTURES)
    .map((p) => relative(FIXTURES, p).replaceAll('\\', '/'))
    .filter((p) => filtro.test(p))
    .sort();
}
