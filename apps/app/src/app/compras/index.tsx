import { excluirNota, listarNotas, type ResumoNota } from '@dragometro/armazenamento';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { dataCurta, reais } from '../../lib/formato';
import { useDados } from '../../lib/useDados';
import { cores, espaco } from '../../tema';

export default function Compras() {
  const db = useSQLiteContext();
  const [versao, setVersao] = useState(0);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const { dados: notas } = useDados(listarNotas, String(versao));

  async function excluir(nota: ResumoNota) {
    if (confirmando !== nota.chave) {
      setConfirmando(nota.chave);
      return;
    }
    await excluirNota(db, nota.chave);
    setConfirmando(null);
    setVersao((v) => v + 1);
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: espaco(2), gap: espaco(1) }}
      data={notas ?? []}
      keyExtractor={(n) => n.chave}
      ListEmptyComponent={
        <Text style={estilos.suave}>{notas ? 'Nenhum cupom salvo ainda.' : 'Carregando...'}</Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.7 }]}
          onPress={() => router.push({ pathname: '/compras/[chave]', params: { chave: item.chave } })}
        >
          <View style={{ flex: 1 }}>
            <Text style={estilos.titulo}>{item.nomeEmitente ?? 'Loja'}</Text>
            <Text style={estilos.suave}>
              {dataCurta(item.dataEmissao)} · {item.quantidadeItens} itens{item.origem === 'foto' ? ' · lido da foto' : ''}
              {item.valorTotal !== null ? ` · ${reais(item.valorTotal)}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => excluir(item)} hitSlop={8}>
            <Text style={{ color: confirmando === item.chave ? cores.vermelho : cores.textoSuave }}>
              {confirmando === item.chave ? 'Confirmar exclusão' : 'Excluir'}
            </Text>
          </Pressable>
          <Text style={estilos.seta}>›</Text>
        </Pressable>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  seta: { color: cores.textoSuave, fontSize: 22, marginLeft: espaco(0.5) },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
  },
  titulo: { color: cores.texto, fontWeight: '600', fontSize: 16 },
  suave: { color: cores.textoSuave, fontSize: 14 },
});
