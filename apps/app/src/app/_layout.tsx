import { migrar } from '@dragometro/armazenamento';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ErroBanco } from '../lib/ErroBanco';
import { EXPLICACAO, problemaNaWeb } from '../lib/suporteWeb';
import { cores, espaco } from '../tema';

// Calculado uma vez: o contexto da página não muda enquanto ela está aberta.
const problema = problemaNaWeb();

export default function Layout() {
  if (problema) {
    const { titulo, texto } = EXPLICACAO[problema];
    return (
      <ScrollView contentContainerStyle={estilos.aviso}>
        <Text style={estilos.titulo}>🐉 {titulo}</Text>
        <Text style={estilos.texto}>{texto}</Text>
      </ScrollView>
    );
  }

  return (
    // Banco local: as compras ficam no aparelho. `migrar` cria/atualiza as tabelas antes das telas abrirem.
    <ErroBanco>
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
          <Stack.Screen name="inflacao" options={{ title: 'Minha inflação' }} />
          <Stack.Screen name="chave" options={{ title: 'Cupom sem QR Code' }} />
        </Stack>
      </SQLiteProvider>
    </ErroBanco>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espaco(4),
    gap: espaco(2),
    backgroundColor: cores.fundo,
  },
  titulo: { color: cores.dragao, fontSize: 22, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 16, lineHeight: 24 },
});
