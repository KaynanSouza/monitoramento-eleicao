import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
// Define a tarefa em segundo plano no escopo global (exigência do TaskManager).
import { registrarTarefaSegundoPlano } from '@/segundoPlano/tarefa';

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
