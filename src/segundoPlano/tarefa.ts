/**
 * Tarefa em segundo plano (melhor esforço). O Android roda em intervalos de no
 * mínimo 15 min e quando o sistema achar conveniente; serve só para preencher
 * lacunas do histórico quando o app está fechado. O gráfico mostra as lacunas.
 *
 * Este módulo precisa ser importado no escopo global (app/_layout.tsx), pois o
 * TaskManager exige que a tarefa seja definida antes de o app montar.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { obterServicos } from '@/servicos';

export const TAREFA_APURACAO = 'apuracao-atualizar';

TaskManager.defineTask(TAREFA_APURACAO, async () => {
  try {
    const { apuracao, ajustes } = await obterServicos();
    for (const escopo of await ajustes.escoposObservados()) {
      try {
        await apuracao.resultado(escopo, { segundoPlano: true });
      } catch {
        // um escopo com erro não impede os demais
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registrarTarefaSegundoPlano(): Promise<boolean> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(TAREFA_APURACAO))) {
    await BackgroundTask.registerTaskAsync(TAREFA_APURACAO, { minimumInterval: 15 });
  }
  return true;
}
