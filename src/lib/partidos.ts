/**
 * Cores por partido, indexadas pelo número do partido (2 primeiros dígitos do
 * número do candidato). As cores são só identificação visual, sem conotação editorial.
 * A cor do texto sobre o selo é escolhida pelo contraste (WCAG).
 */

export const CORES_PARTIDOS: Record<string, string> = {
  '10': '#1F5FA8', // REPUBLICANOS
  '11': '#2F6FB5', // PP
  '12': '#C2410C', // PDT
  '13': '#C8102E', // PT
  '14': '#F28C28', // MISSÃO
  '15': '#23784A', // MDB
  '16': '#8B1A1A', // PSTU
  '18': '#1BA39C', // REDE
  '20': '#4B9CD3', // PODE
  '21': '#7F1D1D', // PCB
  '22': '#1B2A6B', // PL (azul-marinho)
  '23': '#E06C9F', // CIDADANIA
  '25': '#0F766E', // PRD
  '27': '#6D8B3A', // DC
  '28': '#5B8C2A', // PRTB
  '29': '#991B1B', // PCO
  '30': '#F07F1A', // NOVO
  '33': '#7C3AED', // MOBILIZA
  '35': '#A16207', // DEMOCRATA
  '36': '#0E7490', // AGIR
  '40': '#E4A11B', // PSB
  '43': '#16A34A', // PV
  '44': '#1D4ED8', // UNIÃO
  '45': '#0A66C2', // PSDB
  '50': '#FBBF24', // PSOL
  '55': '#6B7A2C', // PSD (oliva)
  '65': '#B91C1C', // PCdoB
  '70': '#0B7A7C', // AVANTE (verde-azulado)
  '77': '#EA580C', // SOLIDARIEDADE
  '80': '#9F1239', // UP
};

const RESERVA = ['#64748B', '#7C6F64', '#5B6B8C', '#6B7F5E', '#8C5B7A', '#5E7C7F'];

/** Cor do partido; partidos não mapeados recebem um cinza estável derivado do número. */
export function corPartido(numero: string): string {
  const n = numero.slice(0, 2);
  const cor = CORES_PARTIDOS[n];
  if (cor) return cor;
  const h = [...n].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return RESERVA[h % RESERVA.length]!;
}

function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const v = parseInt(m[1]!, 16);
  const canais = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canais[0]! + 0.7152 * canais[1]! + 0.0722 * canais[2]!;
}

/** Razão de contraste WCAG entre duas cores hex. */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Branco ou quase-preto, o que tiver mais contraste com o fundo do selo. */
export function corTextoSobre(fundo: string): '#FFFFFF' | '#111111' {
  return contraste(fundo, '#FFFFFF') >= contraste(fundo, '#111111') ? '#FFFFFF' : '#111111';
}
