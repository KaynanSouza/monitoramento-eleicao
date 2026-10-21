/**
 * Monta a série do gráfico "Evolução da apuração" a partir dos snapshots locais.
 *
 * - Eixo X: horário da totalização do TSE (dt/ht), não o horário do celular.
 * - Lacunas: se entre duas observações consecutivas o app ficou mais que
 *   `lacunaMs` sem observar o TSE (app fechado, sem rede, segundo plano esparso),
 *   a série é quebrada em segmentos. A UI liga segmentos com linha tracejada
 *   (ou não liga) e nunca interpola como se fosse dado observado.
 */
import type { Snapshot } from '@/db/sql';

export interface PontoSerie {
  /** Horário da totalização (epoch ms). */
  t: number;
  pctSecoes: number;
  /** % dos válidos por sqcand. */
  pct: Record<string, number>;
}

export interface SerieCandidato {
  sqcand: string;
  numero: string;
  nomeUrna: string;
  partido: string;
  sigla: string;
}

export interface SerieEvolucao {
  /** "gravado" = observado ao vivo pelo app; "reconstruido" = 1º turno, montado dos arquivos do TSE. */
  origem: 'gravado' | 'reconstruido';
  /** Primeira observação gravada (epoch ms do celular), para "histórico gravado a partir de HH:MM". */
  gravadoDesde: number | null;
  /** Candidatos na ordem do último snapshot. */
  candidatos: SerieCandidato[];
  /** Trechos contínuos de observação. */
  segmentos: PontoSerie[][];
}

export interface Janela {
  /** epoch ms, inclusivo */
  inicio: number;
  /** epoch ms, exclusivo */
  fim: number;
}

const HORA = 3_600_000;

/**
 * Janela do dia da votação no horário de Brasília: 00h do dia até 06h do dia seguinte
 * (a apuração pode passar da meia-noite). Aceita "dd/mm/aaaa" (ele-c) ou ISO −03:00.
 * Null se a data for inválida (aí a série não é filtrada).
 */
export function janelaDoDia(data: string | null): Janela | null {
  if (!data) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  let dia: string | null = br ? `${br[3]}-${br[2]}-${br[1]}` : null;
  if (!dia) {
    const ms = Date.parse(data);
    if (Number.isNaN(ms)) return null;
    dia = new Date(ms - 3 * HORA).toISOString().slice(0, 10); // dia em Brasília
  }
  const inicio = Date.parse(`${dia}T00:00:00-03:00`);
  return Number.isNaN(inicio) ? null : { inicio, fim: inicio + 30 * HORA };
}

export function montarSerie(
  snapshots: Snapshot[],
  opcoes: {
    lacunaMs?: number;
    maxCandidatos?: number;
    janela?: Janela | null;
    origem?: SerieEvolucao['origem'];
  } = {},
): SerieEvolucao {
  const lacunaMs = opcoes.lacunaMs ?? 3 * 60_000;
  const j = opcoes.janela;
  const noDia = (s: Snapshot) => {
    if (!j) return true;
    const t = s.atualizadoEm ? Date.parse(s.atualizadoEm) : NaN;
    return !Number.isNaN(t) && t >= j.inicio && t < j.fim;
  };
  const ordenados = snapshots.filter(noDia).sort((a, b) => a.capturadoEm - b.capturadoEm);
  const ultimo = ordenados[ordenados.length - 1];
  const origem = opcoes.origem ?? 'gravado';
  if (!ultimo) return { origem, gravadoDesde: null, candidatos: [], segmentos: [] };

  const candidatos = [...ultimo.candidatos]
    .sort((a, b) => b.votos - a.votos)
    .slice(0, opcoes.maxCandidatos ?? 5)
    .map(({ sqcand, numero, nomeUrna, partido, sigla }) => ({ sqcand, numero, nomeUrna, partido, sigla }));

  const segmentos: PontoSerie[][] = [];
  let atual: PontoSerie[] = [];
  let capturaAnterior: number | null = null;

  for (const s of ordenados) {
    if (!s.atualizadoEm) continue; // TSE ainda sem totalização
    const t = Date.parse(s.atualizadoEm);
    if (Number.isNaN(t)) continue;

    if (capturaAnterior !== null && s.capturadoEm - capturaAnterior > lacunaMs && atual.length) {
      segmentos.push(atual);
      atual = [];
    }
    capturaAnterior = s.capturadoEm;

    const ponto: PontoSerie = {
      t,
      pctSecoes: s.pctSecoes,
      pct: Object.fromEntries(s.candidatos.map((c) => [c.sqcand, c.pct])),
    };
    const ultimoPonto = atual[atual.length - 1] ?? segmentos[segmentos.length - 1]?.at(-1);
    // Mesma totalização observada de novo: não duplica o ponto.
    if (ultimoPonto && ultimoPonto.t === t) continue;
    atual.push(ponto);
  }
  if (atual.length) segmentos.push(atual);

  return { origem, gravadoDesde: ordenados[0]!.capturadoEm, candidatos, segmentos };
}
