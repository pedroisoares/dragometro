import { formatarPercentual } from '@dragometro/core';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { porUnidade, reais } from '../../lib/formato';
import { produtosComPreco } from '../../lib/produtos';
import { useDados } from '../../lib/useDados';
import { cores, espaco } from '../../tema';

export default function Produtos() {
  const { dados: produtos, erro } = useDados(produtosComPreco);

  return (
    <FlatList
      contentContainerStyle={{ padding: espaco(2), gap: espaco(1) }}
      data={produtos ?? []}
      keyExtractor={(p) => p.produtoId}
      ListEmptyComponent={
        <Text style={estilos.suave}>
          {erro ?? (produtos ? 'Leia um cupom para ver seus produtos aqui.' : 'Carregando...')}
        </Text>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/produtos/[id]', params: { id: item.produtoId } }} asChild>
          <Pressable style={estilos.cartao}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.titulo}>{item.descricao}</Text>
              <Text style={estilos.suave}>
                {item.nomeEmitente ?? ''} · {item.compras} {item.compras === 1 ? 'compra' : 'compras'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={estilos.preco}>
                {reais(item.precoAtual)}
                {porUnidade(item.unidade)}
              </Text>
              {item.ultimaVariacao !== undefined && (
                <Text style={{ color: item.ultimaVariacao > 0 ? cores.vermelho : cores.verde }}>
                  {item.ultimaVariacao > 0 ? '▲' : '▼'} {formatarPercentual(Math.abs(item.ultimaVariacao), 1)}
                </Text>
              )}
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
  },
  titulo: { color: cores.texto, fontWeight: '600', fontSize: 15 },
  preco: { color: cores.texto, fontWeight: '700', fontVariant: ['tabular-nums'] },
  suave: { color: cores.textoSuave, fontSize: 13 },
});
