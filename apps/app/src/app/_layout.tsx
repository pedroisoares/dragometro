import { migrar } from '@dragometro/armazenamento';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { cores } from '../tema';

export default function Layout() {
  return (
    // Banco local: as compras ficam no aparelho. `migrar` cria/atualiza as tabelas antes das telas abrirem.
    <SQLiteProvider databaseName="dragometro.db" onInit={migrar}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Dragômetro' }} />
        <Stack.Screen name="ler-cupom" options={{ title: 'Ler cupom fiscal' }} />
        <Stack.Screen name="compras" options={{ title: 'Minhas compras' }} />
        <Stack.Screen name="produtos/index" options={{ title: 'Produtos' }} />
        <Stack.Screen name="produtos/[id]" options={{ title: 'Produto' }} />
      </Stack>
    </SQLiteProvider>
  );
}
