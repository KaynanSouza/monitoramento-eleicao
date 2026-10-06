import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { UFS } from '@/lib/ufs';
import { camadasMunicipios, resumir, type ResumoArea } from '@/mapa/dados';
import { obterMalha } from '@/mapa/malha';
import { obterServicos } from '@/servicos';
import type { Resultado } from '@/tse/types';
import { useTema } from '../tema';

/** O mapa atualiza com menos frequência que a lista (são muitos arquivos). */
const INTERVALO_MAPA_MS = 90_000;

const SIGLAS_UF = UFS.map((u) => u.uf);

/** Resultado por UF (mapa nacional por estado): 27 arquivos estaduais. */
export function useMapaUfs(turno: 1 | 2, cargo: string, ativo: boolean, finalizada: boolean) {
  return useQuery({
    queryKey: ['mapa-ufs', turno, cargo],
    enabled: ativo,
    queryFn: async () => {
      const s = await obterServicos();
      const rs = await s.apuracao.resultadosUfs({ turno, cargo }, SIGLAS_UF);
      const resumos = new Map<string, ResumoArea>();
      for (const [uf, r] of rs) {
        const x = resumir(r);
        if (x) resumos.set(uf, x);
      }
      return { resultados: rs, resumos };
    },
    refetchInterval: finalizada ? false : INTERVALO_MAPA_MS,
    staleTime: 30_000,
  });
}

export interface DadosMunicipios {
  resultados: Map<string, Resultado>; // por código IBGE
  resumos: Map<string, ResumoArea>;
}

async function carregarUf(
  turno: 1 | 2,
  cargo: string,
  uf: string,
  aoProgredir?: (feitos: number, total: number) => void,
): Promise<DadosMunicipios> {
  const s = await obterServicos();
  const resultados = await s.apuracao.carregarMunicipios({ turno, cargo, uf }, { aoProgredir });
  const resumos = new Map<string, ResumoArea>();
  for (const [ibge, r] of resultados) {
    const x = resumir(r);
    if (x) resumos.set(ibge, x);
  }
  return { resultados, resumos };
}

export const chaveMunicipios = (turno: 1 | 2, cargo: string, uf: string) => ['mapa-mun', turno, cargo, uf] as const;

/**
 * Municípios das UFs pedidas, carregados sob demanda (cada UF é uma query separada,
 * guardada em cache). Retorna as camadas prontas para o mapa e o progresso.
 */
export function useMapaMunicipios(turno: 1 | 2, cargo: string, ufs: string[], finalizada: boolean) {
  const t = useTema();
  const [progresso, setProgresso] = useState<Record<string, [number, number]>>({});
  const qs = useQueries({
    queries: ufs.map((uf) => ({
      queryKey: chaveMunicipios(turno, cargo, uf),
      queryFn: () =>
        carregarUf(turno, cargo, uf, (f, total) => setProgresso((p) => ({ ...p, [uf]: [f, total] }))),
      refetchInterval: finalizada ? (false as const) : INTERVALO_MAPA_MS,
      staleTime: 30_000,
    })),
  });

  const versao = qs.map((q) => q.dataUpdatedAt).join(',');
  const combinado = useMemo(() => {
    const resultados = new Map<string, Resultado>();
    const resumos = new Map<string, ResumoArea>();
    for (const q of qs) {
      if (!q.data) continue;
      for (const [k, v] of q.data.resultados) resultados.set(k, v);
      for (const [k, v] of q.data.resumos) resumos.set(k, v);
    }
    return { resultados, resumos, ...camadasMunicipios(obterMalha(), resumos, t.fundo) };
  }, [versao, t.fundo]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregando = qs.some((q) => q.isFetching);
  let feitos = 0;
  let total = 0;
  for (const uf of ufs) {
    const p = progresso[uf];
    if (p) {
      feitos += p[0];
      total += p[1];
    }
  }
  return { ...combinado, carregando, progresso: total ? feitos / total : null };
}

export { carregarUf };

/** Nome e UF de cada município (do mun-cm.json do TSE), por código IBGE. */
export function useNomesMunicipios(turno: 1 | 2, cargo: string) {
  return useQuery({
    queryKey: ['nomes-municipios', turno, cargo],
    queryFn: async () => {
      const s = await obterServicos();
      const el = await s.apuracao.resolver(turno, cargo);
      if (!el) return new Map<string, { nome: string; uf: string }>();
      const { cfg } = await s.apuracao.municipios(el.codigo);
      return new Map(cfg.ufs.flatMap((u) => u.municipios.map((m) => [m.ibge, { nome: m.nome, uf: u.uf }] as const)));
    },
    staleTime: Infinity,
  });
}
