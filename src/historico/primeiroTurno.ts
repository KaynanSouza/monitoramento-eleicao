/**
 * Evolução do 1º turno (04/10/2026) reconstruída a partir dos arquivos oficiais do TSE
 * (scripts/build-evolucao-1t.ts): o app não estava instalado naquele dia, então não há
 * histórico gravado ao vivo. Devolve snapshots no formato do banco, para a mesma
 * `montarSerie` do gráfico.
 */
import type { Snapshot } from '@/db/sql';

interface SerieGravada {
  candidatos: { sqcand: string; numero: string; nomeUrna: string; partido: string; sigla: string }[];
  /** [minutos desde a época, % seções, % de cada candidato na ordem acima] */
  pontos: number[][];
}

let series: Record<string, SerieGravada> | null = null;

/** Null se não houver reconstrução para o escopo (ex.: 2º turno, Dep. Federal). */
export function snapshotsPrimeiroTurno(eleicao: string, cargo: string, uf: string): Snapshot[] | null {
  // require tardio: o JSON só é avaliado quando o gráfico do 1º turno é aberto.
  series ??= (require('./primeiroTurno.json') as { series: Record<string, SerieGravada> }).series;
  const s = series[`${eleicao}:${cargo}:${uf}`];
  if (!s?.pontos.length) return null;
  return s.pontos.map(([minuto, pctSecoes, ...pcts]) => {
    const t = minuto! * 60_000;
    return {
      eleicao,
      turno: 1,
      cargo,
      abrangencia: uf,
      capturadoEm: t,
      atualizadoEm: new Date(t).toISOString(),
      pctSecoes: pctSecoes!,
      totalizacaoFinal: false,
      segundoPlano: false,
      // Sem votos absolutos na reconstrução: o % serve para ordenar (mesma base em cada ponto).
      candidatos: s.candidatos.map((c, i) => ({ ...c, votos: pcts[i] ?? 0, pct: pcts[i] ?? 0 })),
    };
  });
}
