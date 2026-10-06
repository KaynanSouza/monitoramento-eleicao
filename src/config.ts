// Configuração lida do .env (variáveis EXPO_PUBLIC_* são inlined pelo Metro no build).

export type MockMode = 'off' | 'replay';

export const config = {
  tseBase: process.env.EXPO_PUBLIC_TSE_BASE ?? 'https://resultados.tse.jus.br',
  ambiente: process.env.EXPO_PUBLIC_TSE_AMBIENTE ?? 'oficial',
  ciclo: process.env.EXPO_PUBLIC_TSE_CICLO ?? 'ele2026',
  mock: (process.env.EXPO_PUBLIC_MOCK === 'replay' ? 'replay' : 'off') as MockMode,
  replaySpeed: Number(process.env.EXPO_PUBLIC_REPLAY_SPEED ?? 20),
} as const;
