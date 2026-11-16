import { categoria } from '@dragometro/classificacao';
import { formatarPercentual, type Granularidade } from '@dragometro/core';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nomePeriodo, porUnidade, reais } from '../../lib/formato';
import { buscarIndiceCategoria } from '../../lib/indices';
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
  const subitem = dados?.subitem ? categoria(dados.subitem) : undefined;
  const [ipca, setIpca] = useState<Map<string, number> | 'erro' | null>(null);

  useEffect(() => {
    if (!subitem) return;
    buscarIndiceCategoria('IPCA', subitem.sidra, 12)
      .then(setIpca)
      .catch(() => setIpca('erro'));
  }, [subitem?.sidra]);

  // Meses em que há variação sua (precisa de compras em 2 meses) mais os 3 últimos divulgados do IPCA.
  const mesesComparacao = (() => {
    const seus = (dados?.serieMensal ?? []).filter((p) => p.variacao !== undefined).map((p) => p.periodo);
    const oficiais = ipca && ipca !== 'erro' ? [...ipca.keys()].slice(-3) : [];
    return [...new Set([...oficiais, ...seus])].sort();
  })();
  const faltaOficial = ipca !== null && ipca !== 'erro' && mesesComparacao.some((m) => !ipca.has(m));
  const minhaVariacao = new Map((dados?.serieMensal ?? []).map((p) => [p.periodo, p.variacao]));

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

      <View style={estilos.cartao}>
        <Text style={estilos.tituloCartao}>Comparação com o IPCA</Text>
        {!subitem ? (
          <Text style={estilos.suave}>
            O app ainda não sabe em que categoria do IBGE este produto se encaixa, então não dá para comparar.
          </Text>
        ) : (
          <>
            <Text style={estilos.suave}>
              Categoria do IBGE: <Text style={{ color: cores.dragao, fontWeight: '600' }}>{subitem.nome}</Text>
            </Text>
            <View style={estilos.linha}>
              <Text style={[estilos.suave, estilos.colPeriodo]}>Mês</Text>
              <Text style={[estilos.suave, estilos.col]}>Você</Text>
              <Text style={[estilos.suave, estilos.col]}>IPCA</Text>
            </View>
            {mesesComparacao.map((mes) => {
              const minha = minhaVariacao.get(mes);
              const oficial = ipca && ipca !== 'erro' ? ipca.get(mes) : undefined;
              return (
                <View key={mes} style={estilos.linha}>
                  <Text style={[estilos.texto, estilos.colPeriodo]}>{nomePeriodo(mes)}</Text>
                  <Text style={[estilos.texto, estilos.col, cor(minha)]}>
                    {minha === undefined ? '—' : formatarPercentual(minha, 1)}
                  </Text>
                  <Text style={[estilos.texto, estilos.col, cor(oficial)]}>
                    {ipca === null ? '...' : oficial === undefined ? '—' : formatarPercentual(oficial, 1)}
                  </Text>
                </View>
              );
            })}
            {(dados?.serieMensal.length ?? 0) < 2 && (
              <Text style={estilos.suave}>
                Para ver a sua variação ao lado da oficial, compre este produto de novo em outro mês.
              </Text>
            )}
            {faltaOficial && (
              <Text style={estilos.suave}>
                O IBGE divulga o IPCA de cada mês por volta do dia 10 do mês seguinte.
              </Text>
            )}
            {ipca === 'erro' && <Text style={estilos.suave}>Não foi possível buscar o IPCA agora.</Text>}
          </>
        )}
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
  tituloCartao: { color: cores.texto, fontWeight: '700', fontSize: 16 },
});
