import { formatarPercentual, type Granularidade } from '@dragometro/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nomePeriodo, porUnidade, reais } from '../../lib/formato';
import { detalheProduto } from '../../lib/produtos';
import { useDados } from '../../lib/useDados';
import { cores, espaco } from '../../tema';

const OPCOES: { valor: Granularidade; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'ano', rotulo: 'Ano' },
];

export default function Produto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [granularidade, setGranularidade] = useState<Granularidade>('semana');
  const { dados } = useDados((db) => detalheProduto(db, id, granularidade), `${id}|${granularidade}`);

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: dados?.descricao ?? 'Produto' }} />

      <View style={estilos.abas}>
        {OPCOES.map((o) => (
          <Pressable
            key={o.valor}
            onPress={() => setGranularidade(o.valor)}
            style={[estilos.aba, granularidade === o.valor && estilos.abaAtiva]}
          >
            <Text style={[estilos.texto, granularidade === o.valor && { color: cores.fundo, fontWeight: '700' }]}>
              {o.rotulo}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={estilos.cartao}>
        <View style={estilos.linha}>
          <Text style={[estilos.suave, estilos.colPeriodo]}>Período</Text>
          <Text style={[estilos.suave, estilos.colPreco]}>Preço</Text>
          <Text style={[estilos.suave, estilos.col]}>Variação</Text>
          <Text style={[estilos.suave, estilos.col]}>Acumulado</Text>
        </View>
        {dados?.serie.map((p) => (
          <View key={p.periodo} style={estilos.linha}>
            <Text style={[estilos.texto, estilos.colPeriodo]}>{nomePeriodo(p.periodo)}</Text>
            <Text style={[estilos.texto, estilos.colPreco]}>
              {reais(p.preco)}
              {porUnidade(dados.unidade)}
            </Text>
            <Text style={[estilos.texto, estilos.col, cor(p.variacao)]}>
              {p.variacao === undefined ? '—' : formatarPercentual(p.variacao, 1)}
            </Text>
            <Text style={[estilos.texto, estilos.col, cor(p.acumulado)]}>{formatarPercentual(p.acumulado, 1)}</Text>
          </View>
        ))}
      </View>

      <Text style={estilos.suave}>
        Quando o produto é comprado mais de uma vez no mesmo período, o preço do período é a média
        geométrica das compras, como faz o IBGE.
      </Text>
    </ScrollView>
  );
}

function cor(v?: number) {
  if (v === undefined || Math.abs(v) < 1e-9) return null;
  return { color: v > 0 ? cores.vermelho : cores.verde };
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(2), gap: espaco(2) },
  abas: { flexDirection: 'row', gap: espaco(1) },
  aba: { flex: 1, borderRadius: 12, padding: espaco(1), alignItems: 'center', backgroundColor: cores.cartao },
  abaAtiva: { backgroundColor: cores.dragao },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(2), gap: espaco(1) },
  linha: { flexDirection: 'row', gap: espaco(0.5) },
  col: { flex: 1, textAlign: 'right' },
  colPeriodo: { flex: 1.15 },
  colPreco: { flex: 1.5, textAlign: 'right' },
  texto: { color: cores.texto, fontVariant: ['tabular-nums'] },
  suave: { color: cores.textoSuave, fontSize: 13 },
});
