/** Conversões dos valores-string do TSE. */

/** "56104503" → 56104503. String vazia ou inválida → 0. */
export function parseInteiro(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** "47,03" / "47,027772356" → 47.03 / 47.027772356. */
export function parsePercentual(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Data "dd/mm/aaaa" + hora "hh:mm:ss" no horário de Brasília → ISO 8601 com offset.
 * O Brasil não tem horário de verão desde 2019, então Brasília é sempre UTC−3.
 * Retorna null se a data estiver vazia (abrangência ainda não totalizada).
 */
export function parseDataHoraBrasilia(data: string, hora: string): string | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  const h = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hora);
  if (!d || !h) return null;
  return `${d[3]}-${d[2]}-${d[1]}T${h[1]}:${h[2]}:${h[3]}-03:00`;
}
