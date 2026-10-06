/**
 * Teste de fumaça contra o TSE real, pelo mesmo serviço usado no app
 * (~4 requisições: ele-c, mun-cm, EA14, EA20).
 *
 * Uso: npm run smoke -- [turno] [cargo] [uf]     ex.: npm run smoke -- 2 1 br
 */
import { ServicoApuracao } from '../src/api/apuracao';
import { MemoriaCacheHttp, TseHttp } from '../src/api/http';
import { Limitador } from '../src/api/limitador';
import { formatDataHora, formatInteiro, formatPct } from '../src/lib/format';

const [turno = '1', cargo = '1', uf = 'br'] = process.argv.slice(2);

const http = new TseHttp({ fetch, cache: new MemoriaCacheHttp(), limitador: new Limitador(2, 250) });
const svc = new ServicoApuracao({
  http,
  endpoint: {
    base: process.env.EXPO_PUBLIC_TSE_BASE ?? 'https://resultados.tse.jus.br',
    ambiente: process.env.EXPO_PUBLIC_TSE_AMBIENTE ?? 'oficial',
    ciclo: process.env.EXPO_PUBLIC_TSE_CICLO ?? 'ele2026',
  },
});

async function main() {
  const t = Number(turno) === 2 ? 2 : 1;
  const eleicoes = await svc.eleicoes();
  console.log('Eleições:', eleicoes.map((e) => `${e.codigo} (t${e.turno}, 2ºt=${e.codigoSegundoTurno ?? '-'})`).join(', '));

  try {
    const { resultado: r, eleicao, origem } = await svc.resultado({ turno: t, cargo, uf });
    console.log(`\n${r.cargo.nome} · ${uf.toUpperCase()} · ${t}º turno · eleição ${eleicao.codigo} (${eleicao.origem}) · ${origem}`);
    console.log(`Seções: ${r.secoes.pctTexto}% (${formatInteiro(r.secoes.totalizadas)} de ${formatInteiro(r.secoes.total)})`);
    console.log(`Atualizado: ${formatDataHora(r.atualizadoEm)} · final=${r.totalizacaoFinal}${r.mensagem ? ` · ${r.mensagem}` : ''}`);
    for (const c of r.candidatos.slice(0, 6)) {
      const selo = c.situacao === 'pendente' ? '' : ` [${c.situacaoTexto}]`;
      console.log(`  ${c.nomeUrna.padEnd(28)} ${c.numero.padStart(5)} ${c.partido.sigla.padEnd(14)} ${formatPct(c.pct).padStart(6)}%  ${formatInteiro(c.votos).padStart(12)}${selo}`);
    }
  } catch (e) {
    console.log(`\nSem resultado: ${(e as Error).message}`);
  }
}

main();
