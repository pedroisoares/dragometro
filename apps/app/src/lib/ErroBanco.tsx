import { Component, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { cores, espaco } from '../tema';

/**
 * Mostra uma explicação em vez de uma tela de erro quando o banco local não abre.
 * Caso mais comum na Web: o Dragômetro já está aberto em outra aba. O navegador só
 * deixa uma aba por vez usar o arquivo do banco.
 */
export class ErroBanco extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    const outraAba = /Access Handle|createSyncAccessHandle|database is locked/i.test(erro.message);
    const titulo = outraAba ? 'O Dragômetro já está aberto em outra aba' : 'Não foi possível abrir os seus dados';
    const texto = outraAba
      ? 'O navegador só deixa uma aba por vez usar os seus cupons. Feche as outras abas do Dragômetro e toque em "Tentar de novo".'
      : `Detalhe técnico: ${erro.message}`;

    return (
      <ScrollView contentContainerStyle={estilos.tela}>
        <Text style={estilos.titulo}>🐉 {titulo}</Text>
        <Text style={estilos.texto}>{texto}</Text>
        <Pressable style={estilos.botao} onPress={tentarDeNovo}>
          <Text style={estilos.botaoTexto}>Tentar de novo</Text>
        </Pressable>
      </ScrollView>
    );
  }
}

function tentarDeNovo() {
  // Recarregar garante que o banco é aberto do zero.
  if (Platform.OS === 'web') globalThis.location?.reload();
}

const estilos = StyleSheet.create({
  tela: { flexGrow: 1, justifyContent: 'center', padding: espaco(4), gap: espaco(2), backgroundColor: cores.fundo },
  titulo: { color: cores.dragao, fontSize: 22, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 16, lineHeight: 24 },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center' },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
});
