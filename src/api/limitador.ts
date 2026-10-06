/**
 * Fila global de requisições ao TSE: concorrência máxima e espaçamento mínimo
 * entre inícios (taxa). Todas as buscas do app passam por aqui.
 */

export type Dormir = (ms: number) => Promise<void>;
export const dormir: Dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export class Limitador {
  private ativos = 0;
  private proximoInicio = 0;
  private readonly fila: (() => void)[] = [];

  constructor(
    private readonly concorrencia: number,
    private readonly espacamentoMs: number,
    private readonly agora: () => number = Date.now,
    private readonly esperar: Dormir = dormir,
  ) {}

  /** Requisições aguardando vaga (útil para barra de progresso). */
  get pendentes(): number {
    return this.fila.length;
  }

  async executar<T>(tarefa: () => Promise<T>): Promise<T> {
    if (this.ativos >= this.concorrencia) {
      await new Promise<void>((r) => this.fila.push(r));
    }
    this.ativos++;
    try {
      const inicio = Math.max(this.agora(), this.proximoInicio);
      this.proximoInicio = inicio + this.espacamentoMs;
      const espera = inicio - this.agora();
      if (espera > 0) await this.esperar(espera);
      return await tarefa();
    } finally {
      this.ativos--;
      this.fila.shift()?.();
    }
  }
}
