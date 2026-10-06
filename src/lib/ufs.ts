/** Unidades da Federação (geografia fixa; não são códigos do TSE). Siglas em minúsculas como nas URLs. */
export const UFS = [
  { uf: 'ac', nome: 'Acre' },
  { uf: 'al', nome: 'Alagoas' },
  { uf: 'ap', nome: 'Amapá' },
  { uf: 'am', nome: 'Amazonas' },
  { uf: 'ba', nome: 'Bahia' },
  { uf: 'ce', nome: 'Ceará' },
  { uf: 'df', nome: 'Distrito Federal' },
  { uf: 'es', nome: 'Espírito Santo' },
  { uf: 'go', nome: 'Goiás' },
  { uf: 'ma', nome: 'Maranhão' },
  { uf: 'mt', nome: 'Mato Grosso' },
  { uf: 'ms', nome: 'Mato Grosso do Sul' },
  { uf: 'mg', nome: 'Minas Gerais' },
  { uf: 'pa', nome: 'Pará' },
  { uf: 'pb', nome: 'Paraíba' },
  { uf: 'pr', nome: 'Paraná' },
  { uf: 'pe', nome: 'Pernambuco' },
  { uf: 'pi', nome: 'Piauí' },
  { uf: 'rj', nome: 'Rio de Janeiro' },
  { uf: 'rn', nome: 'Rio Grande do Norte' },
  { uf: 'rs', nome: 'Rio Grande do Sul' },
  { uf: 'ro', nome: 'Rondônia' },
  { uf: 'rr', nome: 'Roraima' },
  { uf: 'sc', nome: 'Santa Catarina' },
  { uf: 'sp', nome: 'São Paulo' },
  { uf: 'se', nome: 'Sergipe' },
  { uf: 'to', nome: 'Tocantins' },
] as const;

export function nomeAbrangencia(uf: string): string {
  if (uf === 'br') return 'Brasil';
  return UFS.find((u) => u.uf === uf)?.nome ?? uf.toUpperCase();
}
