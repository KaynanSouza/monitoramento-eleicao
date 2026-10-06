import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  // networkMode "always": quem trata falta de rede é o cliente HTTP (devolve o último dado salvo);
  // no modo padrão o TanStack pausaria as consultas offline e a tela ficaria sem o cache.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { networkMode: 'always' }, mutations: { networkMode: 'always' } } }),
  );
  // Só em desenvolvimento: acesso pelo console para diagnóstico.
  if (__DEV__) (globalThis as { __queryClient?: QueryClient }).__queryClient = queryClient;

  useEffect(() => {
    registrarTarefaSegundoPlano().catch(() => {
      // melhor esforço: sem segundo plano o app continua funcionando em primeiro plano
    });
  }, []);

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
