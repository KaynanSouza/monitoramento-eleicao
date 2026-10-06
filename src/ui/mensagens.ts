import { SemDisputaError, SemEleicaoError } from '@/api/apuracao';
import { NaoEncontradoError, SemDadosError } from '@/api/http';
import { TseFormatoError } from '@/tse/normalize';

/** Mensagem amigável para qualquer erro da coleta. */
export function mensagemErro(e: unknown): string {
  if (e instanceof NaoEncontradoError) {
    return 'Os resultados ainda não foram publicados pelo TSE. A divulgação começa às 17h (horário de Brasília).';
  }
  if (e instanceof SemDadosError) return 'Sem conexão com o TSE e nenhum dado salvo ainda. Tente de novo em instantes.';
  if (e instanceof SemDisputaError || e instanceof SemEleicaoError) return e.message;
  if (e instanceof TseFormatoError) return e.message;
  return 'Não foi possível carregar os resultados agora.';
}
