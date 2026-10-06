/**
 * Formatação pt-BR sem depender de Intl (o suporte do Hermes a locales varia entre
 * plataformas). Horários sempre em Brasília (UTC−3, sem horário de verão desde 2019),
 * independente do fuso do aparelho.
 */

const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;

/** 56104503 → "56.104.503" */
export function formatInteiro(n: number): string {
  const sinal = n < 0 ? '-' : '';
  return sinal + Math.trunc(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 47.027772356 → "47,03" (sem o símbolo %). */
export function formatPct(n: number, casas = 2): string {
  const [int = '0', dec] = Math.abs(n).toFixed(casas).split('.');
  const sinal = n < 0 && Number(Math.abs(n).toFixed(casas)) !== 0 ? '-' : '';
  return sinal + formatInteiro(Number(int)) + (dec ? `,${dec}` : '');
}

function partesBrasilia(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + BRASILIA_OFFSET_MS);
  const p2 = (x: number) => String(x).padStart(2, '0');
  return {
    dia: p2(d.getUTCDate()),
    mes: p2(d.getUTCMonth() + 1),
    ano: String(d.getUTCFullYear()),
    hh: p2(d.getUTCHours()),
    mm: p2(d.getUTCMinutes()),
    ss: p2(d.getUTCSeconds()),
  };
}

/** ISO → "12:51:05 de 05/10/2026" (horário de Brasília). */
export function formatDataHora(iso: string | null): string {
  const p = iso ? partesBrasilia(iso) : null;
  return p ? `${p.hh}:${p.mm}:${p.ss} de ${p.dia}/${p.mes}/${p.ano}` : '—';
}

/** ISO → "12:51" (horário de Brasília). */
export function formatHora(iso: string | null): string {
  const p = iso ? partesBrasilia(iso) : null;
  return p ? `${p.hh}:${p.mm}` : '—';
}

const MINUSCULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** Siglas com vogal que não dá para detectar pela forma. */
const SIGLAS = new Set(['ACM', 'ONG', 'TV', 'UFBA', 'USP']);
/** Abreviações sem vogal que são títulos, não siglas: "Dr", "Sgt". */
const TITULOS = new Set(['DR', 'DRA', 'JR', 'SGT', 'SR', 'SRA', 'PR', 'PROF', 'CB', 'TEN', 'CEL', 'MAJ', 'CAP']);

/**
 * "ESCRITOR AUGUSTO CURY" → "Escritor Augusto Cury"; conectivos ficam minúsculos.
 * Palavras sem vogal ("DJ", "MLB") e siglas conhecidas ("ACM") ficam em maiúsculas.
 */
export function nomeProprio(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .map((original, i) => {
      const nu = original.replace(/[.,]/g, '');
      const semVogal = !/[AEIOUÁÉÍÓÚÂÊÔÃÕÀY]/iu.test(nu);
      if (SIGLAS.has(nu) || (semVogal && nu.length >= 2 && !TITULOS.has(nu))) return original;
      const p = original.toLocaleLowerCase('pt-BR');
      return i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1);
    })
    .join(' ');
}

/** Iniciais para o avatar: primeira e última palavra significativas. "FLAVIO BOLSONARO" → "FB". */
export function iniciais(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .filter((p) => p && !MINUSCULAS.has(p.toLocaleLowerCase('pt-BR')));
  if (partes.length === 0) return '?';
  const primeira = partes[0]!.charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
