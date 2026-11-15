import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { cores } from '../tema';

export default function Layout() {
  return (
    <>
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
      </Stack>
    </>
  );
}
