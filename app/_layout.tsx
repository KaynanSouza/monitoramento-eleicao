import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
// Define a tarefa em segundo plano no escopo global (exigência do TaskManager).
import { registrarTarefaSegundoPlano } from '@/segundoPlano/tarefa';

// No celular não existe "visibilitychange": informa o TanStack Query quando o app
// volta ao primeiro plano, para atualizar na hora (o polling pausa em segundo plano).
if (Platform.OS !== 'web') {
  focusManager.setEventListener((ativar) => {
    const sub = AppState.addEventListener('change', (estado) => ativar(estado === 'active'));
    return () => sub.remove();
  });
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    registrarTarefaSegundoPlano().catch(() => {
      // melhor esforço: sem segundo plano o app continua funcionando em primeiro plano
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
