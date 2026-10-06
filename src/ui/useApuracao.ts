import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Consulta, ResultadoApuracao } from '@/api/apuracao';
import { obterServicos } from '@/servicos';
import { cargosDisponiveis } from '@/tse/eleicoes';
import { criarUrls } from '@/tse/urls';

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
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DadosTela> => {
      const s = await obterServicos();
      const r = await s.apuracao.resultado(consulta!);
      s.ajustes.observar(consulta!).catch(() => undefined);
      const urls = criarUrls(s.apuracao.endpoint);
      // Fotos só para cargos majoritários (poucos candidatos); proporcionais usam iniciais
      // para não disparar milhares de requisições ao TSE.
      const comFoto = s.modo === 'oficial' && r.resultado.cargo.vagas <= 2;
      const pastaFoto = consulta!.uf === 'br' ? 'br' : consulta!.uf;
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
