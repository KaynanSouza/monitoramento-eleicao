import { useQuery } from '@tanstack/react-query';
import type { Consulta, ResultadoApuracao } from '@/api/apuracao';
import { obterServicos } from '@/servicos';
import { cargosDisponiveis, ehCargoNacional } from '@/tse/eleicoes';
import { criarUrls } from '@/tse/urls';
import { snapshotsPrimeiroTurno } from '@/historico/primeiroTurno';
import { janelaDoDia, montarSerie } from '@/historico/serie';

/** Intervalo de atualização da tela. O cliente HTTP garante o mínimo de 45 s por arquivo. */
const INTERVALO_MS = 30_000;

export function useCargos(turno: 1 | 2) {
  return useQuery({
    queryKey: ['cargos', turno],
    queryFn: async () => cargosDisponiveis(await (await obterServicos()).apuracao.eleicoes(), turno),
    staleTime: 10 * 60_000,
  });
}

export interface DadosTela extends ResultadoApuracao {
  modo: 'oficial' | 'replay';
  /** Até quando as buscas estão pausadas por erro do TSE (epoch ms, 0 = não). */
  pausaAte: number;
  /** URL da foto por sqcand; null = usar iniciais. */
  foto: (sqcand: string) => string | null;
}

export function useResultado(consulta: Consulta | null) {
  return useQuery({
    queryKey: ['resultado', consulta?.turno, consulta?.cargo, consulta?.uf],
    enabled: consulta !== null,
    // Sem placeholder: ao trocar UF/cargo/turno, os números da consulta anterior não podem
    // aparecer sob o título novo. O refetch da mesma consulta já mantém os dados na tela.
    queryFn: async (): Promise<DadosTela> => {
      const s = await obterServicos();
      const r = await s.apuracao.resultado(consulta!);
      s.ajustes.observar(consulta!).catch(() => undefined);
      const urls = criarUrls(s.apuracao.endpoint);
      // Fotos só para cargos majoritários (poucos candidatos); proporcionais usam iniciais
      // para não disparar milhares de requisições ao TSE.
      const comFoto = s.modo === 'oficial' && r.resultado.cargo.vagas <= 2;
      // As fotos de Presidente só existem em fotos/br/ (fotos/sp/... dá 404), mesmo vendo uma UF.
      const pastaFoto = ehCargoNacional(r.resultado.cargo.nome) ? 'br' : consulta!.uf;
      return {
        ...r,
        modo: s.modo,
        pausaAte: s.http.pausaAte,
        foto: (sq) => (comFoto ? urls.foto(r.eleicao.codigo, pastaFoto, sq) : null),
      };
    },
    refetchInterval: (q) => (q.state.data?.resultado.totalizacaoFinal ? false : INTERVALO_MS),
    retry: 1,
  });
}

/** Turno inicial: o 2º se o TSE já publicou alguma eleição de 2º turno no ele-c; senão o 1º. */
export function useTurnoPadrao() {
  return useQuery({
    queryKey: ['turno-padrao'],
    queryFn: async (): Promise<1 | 2> =>
      (await (await obterServicos()).apuracao.eleicoes()).some((e) => e.turno === 2) ? 2 : 1,
    staleTime: 10 * 60_000,
  });
}

/** UFs em disputa no turno/cargo (null = todas). No 2º turno estadual, só as listadas no ele-c. */
export function useUfsEmDisputa(turno: 1 | 2, cargo: string | undefined) {
  return useQuery({
    queryKey: ['ufs-disputa', turno, cargo],
    enabled: cargo !== undefined,
    queryFn: async () => {
      const r = await (await obterServicos()).apuracao.resolver(turno, cargo!);
      const abr = r?.abrangencias;
      return abr && !abr.includes('br') ? abr : null;
    },
    staleTime: 10 * 60_000,
  });
}

/**
 * Série do gráfico para o escopo. `versao` (ex.: verificadoEm do resultado) faz a
 * série ser relida do banco sempre que uma nova observação é gravada.
 */
export function useHistorico(consulta: Consulta | null, eleicao: string | undefined, versao: number | undefined) {
  return useQuery({
    queryKey: ['historico', eleicao, consulta?.cargo, consulta?.uf, versao],
    enabled: consulta !== null && eleicao !== undefined,
    // Mantém a série anterior só enquanto relê o MESMO escopo (não mostra o gráfico de outra UF).
    placeholderData: (anterior, q) =>
      q && q.queryKey.slice(0, 4).join('|') === ['historico', eleicao, consulta?.cargo, consulta?.uf].join('|')
        ? anterior
        : undefined,
    queryFn: async () => {
      const s = await obterServicos();
      const snaps = await s.historico.listar({ eleicao: eleicao!, cargo: consulta!.cargo, abrangencia: consulta!.uf });
      // Só o dia da votação: o TSE regera os arquivos dias depois (reprocessamentos) e cada
      // abertura do app gravaria um ponto novo, esticando o eixo por vários dias.
      // No replay o horário é simulado (sempre 04/10), então vale o dia da primeira totalização.
      const data =
        s.modo === 'oficial'
          ? (await s.apuracao.eleicoes().catch(() => [])).find((e) => e.codigo === eleicao)?.data
          : undefined;
      const janela = janelaDoDia(data ?? snaps.find((x) => x.atualizadoEm)?.atualizadoEm ?? null);
      const maxCandidatos = consulta!.turno === 2 ? 2 : 5;
      const gravada = montarSerie(snaps, { maxCandidatos, janela });
      // 1º turno sem gravação ao vivo (app instalado depois de 04/10): usa a reconstrução
      // a partir dos arquivos do TSE. O 2º turno é sempre o que o app gravar no dia.
      if (gravada.segmentos.length || consulta!.turno !== 1 || s.modo !== 'oficial') return gravada;
      const reconstruida = snapshotsPrimeiroTurno(eleicao!, consulta!.cargo, consulta!.uf);
      return reconstruida
        ? montarSerie(reconstruida, { maxCandidatos, lacunaMs: Infinity, origem: 'reconstruido' })
        : gravada;
    },
  });
}
