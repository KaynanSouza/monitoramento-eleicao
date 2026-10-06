import { describe, expect, it } from 'vitest';
import { MemoriaCacheHttp, NaoEncontradoError, SemDadosError, TseHttp } from './http';
import { Limitador } from './limitador';

/** Servidor falso: responde por URL e registra as requisições. */
function servidor(rotas: Record<string, () => Response>) {
  const chamadas: { url: string; headers: Headers }[] = [];
  const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(url), headers: new Headers(init?.headers) });
    const r = rotas[String(url)];
    if (!r) return new Response('nf', { status: 404 });
    return r();
  }) as typeof fetch;
  return { fetchFn, chamadas };
}

function cliente(fetchFn: typeof fetch, relogio: { t: number }) {
  return new TseHttp({
    fetch: fetchFn,
    cache: new MemoriaCacheHttp(),
    limitador: new Limitador(4, 0),
    agora: () => relogio.t,
    intervaloMinimoMs: 45_000,
    ttl404Ms: 120_000,
    backoffInicialMs: 30_000,
    backoffMaximoMs: 600_000,
  });
}

const U = 'https://tse/a.json';
const ok = (corpo: string, etag = '"v1"') => () =>
  new Response(corpo, { status: 200, headers: { etag, 'last-modified': 'Mon, 05 Oct 2026 15:52:12 GMT' } });

describe('TseHttp', () => {
  it('respeita o intervalo mínimo por arquivo (não vai à rede antes de 45 s)', async () => {
    const rel = { t: 0 };
    const { fetchFn, chamadas } = servidor({ [U]: ok('{"a":1}') });
    const http = cliente(fetchFn, rel);
    expect((await http.buscar(U)).origem).toBe('rede');
    rel.t = 44_000;
    expect((await http.buscar(U)).origem).toBe('cache');
    expect(chamadas).toHaveLength(1);
  });

  it('requisição condicional: envia ETag/Last-Modified e trata 304', async () => {
    const rel = { t: 0 };
    let n = 0;
    const { fetchFn, chamadas } = servidor({
      [U]: () => (n++ === 0 ? ok('{"a":1}')() : new Response(null, { status: 304 })),
    });
    const http = cliente(fetchFn, rel);
    await http.buscar(U);
    rel.t = 60_000;
    const r = await http.buscar(U);
    expect(r.origem).toBe('nao-modificado');
    expect(r.corpo).toBe('{"a":1}');
    expect(r.verificadoEm).toBe(60_000);
    expect(r.alteradoEm).toBe(0);
    expect(chamadas[1]!.headers.get('If-None-Match')).toBe('"v1"');
    expect(chamadas[1]!.headers.get('If-Modified-Since')).toBe('Mon, 05 Oct 2026 15:52:12 GMT');
  });

  it('cache negativo de 404: não insiste antes do TTL', async () => {
    const rel = { t: 0 };
    const { fetchFn, chamadas } = servidor({});
    const http = cliente(fetchFn, rel);
    await expect(http.buscar(U)).rejects.toBeInstanceOf(NaoEncontradoError);
    rel.t = 100_000;
    await expect(http.buscar(U)).rejects.toBeInstanceOf(NaoEncontradoError);
    expect(chamadas).toHaveLength(1);
    rel.t = 121_000;
    await expect(http.buscar(U)).rejects.toBeInstanceOf(NaoEncontradoError);
    expect(chamadas).toHaveLength(2);
  });

  it('429: pausa global com backoff e devolve o último dado como offline', async () => {
    const rel = { t: 0 };
    let status = 200;
    const outra = 'https://tse/b.json';
    const { fetchFn, chamadas } = servidor({
      [U]: () => (status === 200 ? ok('{"a":1}')() : new Response('', { status })),
      [outra]: ok('{"b":1}'),
    });
    const http = cliente(fetchFn, rel);
    await http.buscar(U);
    status = 429;
    rel.t = 50_000;
    expect((await http.buscar(U)).origem).toBe('offline');
    expect(http.pausaAte).toBe(80_000);
    // Durante a pausa, nenhuma URL vai à rede.
    rel.t = 60_000;
    await expect(http.buscar(outra)).rejects.toBeInstanceOf(SemDadosError);
    expect(chamadas).toHaveLength(2);
    // Segundo erro dobra a pausa.
    rel.t = 100_000;
    await http.buscar(U);
    expect(http.pausaAte).toBe(160_000);
  });

  it('403 (bloqueio da CDN): pausa de 10 min', async () => {
    const rel = { t: 0 };
    const { fetchFn } = servidor({ [U]: () => new Response('', { status: 403 }) });
    const http = cliente(fetchFn, rel);
    await expect(http.buscar(U)).rejects.toBeInstanceOf(SemDadosError);
    expect(http.pausaAte).toBe(600_000);
  });

  it('offline: falha de rede devolve o último corpo; sem cache, erro claro', async () => {
    const rel = { t: 0 };
    let online = true;
    const fetchFn = (async () => {
      if (!online) throw new TypeError('Network request failed');
      return ok('{"a":1}')();
    }) as typeof fetch;
    const http = cliente(fetchFn, rel);
    await http.buscar(U);
    online = false;
    rel.t = 90_000;
    const r = await http.buscar(U);
    expect(r.origem).toBe('offline');
    expect(r.verificadoEm).toBe(0);
    await expect(http.buscar('https://tse/nova.json')).rejects.toBeInstanceOf(SemDadosError);
  });

  it('requisições simultâneas ao mesmo arquivo viram uma só', async () => {
    const rel = { t: 0 };
    const { fetchFn, chamadas } = servidor({ [U]: ok('{"a":1}') });
    const http = cliente(fetchFn, rel);
    await Promise.all([http.buscar(U), http.buscar(U), http.buscar(U)]);
    expect(chamadas).toHaveLength(1);
  });

  it('grava o marcador informado', async () => {
    const rel = { t: 0 };
    const { fetchFn } = servidor({ [U]: ok('{"a":1}') });
    const http = cliente(fetchFn, rel);
    await http.buscar(U, { marcador: 'm1' });
    expect((await http.espiar(U))?.marcador).toBe('m1');
  });
});

describe('Limitador', () => {
  it('limita a concorrência', async () => {
    const lim = new Limitador(2, 0);
    let ativos = 0;
    let pico = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        lim.executar(async () => {
          pico = Math.max(pico, ++ativos);
          await new Promise((r) => setTimeout(r, 5));
          ativos--;
        }),
      ),
    );
    expect(pico).toBe(2);
  });

  it('espaça os inícios', async () => {
    let t = 0;
    const esperas: number[] = [];
    const lim = new Limitador(
      10,
      125,
      () => t,
      async (ms) => {
        esperas.push(ms);
      },
    );
    await Promise.all([1, 2, 3, 4].map(() => lim.executar(async () => undefined)));
    expect(esperas).toEqual([125, 250, 375]);
  });
});
