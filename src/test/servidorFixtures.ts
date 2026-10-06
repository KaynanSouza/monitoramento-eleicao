/** `fetch` falso que serve as fixtures reais (como a CDN do TSE), contando requisições. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURES } from './fixtures';

export const BASE_TESTE = 'https://tse.teste';

export function servidorFixtures() {
  const chamadas: string[] = [];
  const sobrescritas = new Map<string, string>();
  const fetchFn = (async (entrada: RequestInfo | URL) => {
    const url = String(entrada);
    chamadas.push(url);
    const rel = url.slice(BASE_TESTE.length + 1);
    const corpo = sobrescritas.get(rel) ?? (existsSync(join(FIXTURES, rel)) ? readFileSync(join(FIXTURES, rel), 'utf8') : null);
    if (corpo == null) return new Response('Not Found', { status: 404 });
    return new Response(corpo, { status: 200 });
  }) as typeof fetch;
  return { fetchFn, chamadas, sobrescritas };
}
