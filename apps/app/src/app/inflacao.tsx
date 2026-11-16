import { categoria, CODIGOS } from '@dragometro/classificacao';
import { formatarPercentual } from '@dragometro/core';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { nomePeriodo, reais } from '../lib/formato';
import { buscarIndice, buscarIndiceCategoria } from '../lib/indices';
import { resumoInflacao } from '../lib/inflacao';
import { useDados } from '../lib/useDados';
import { cores, espaco } from '../tema';

type Oficial = { geral: Map<string, number>; alimentacao: Map<string, number> } | 'erro' | null;

export default function MinhaInflacao() {
  const { dados } = useDados(resumoInflacao);
  const [oficial, setOficial] = useState<Oficial>(null);

  useEffect(() => {
    const alimentacao = categoria(CODIGOS.alimentacaoNoDomicilio)!.sidra;
    Promise.all([buscarIndice('IPCA', 12), buscarIndiceCategoria('IPCA', alimentacao, 12)])
      .then(([geral, alim]) => setOficial({ geral, alimentacao: alim }))
      .catch(() => setOficial('erro'));
  }, []);

  if (!dados) return <Text style={[estilos.suave, { padding: espaco(2) }]}>Carregando...</Text>;

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <View style={estilos.cartao}>
        <Text style={estilos.titulo}>Sua inflação x IPCA</Text>
        {dados.serie.length === 0 ? (
          <Text style={estilos.texto}>
            Para medir a sua inflação, o Dragômetro precisa de cupons de pelo menos dois meses diferentes.
            {dados.meses.length > 0 ? ` Até agora: ${dados.meses.map(nomePeriodo).join(', ')}.` : ''}
          </Text>
        ) : (
          <>
            <View style={estilos.linha}>
              <Text style={[estilos.suave, estilos.colMes]}>Mês</Text>
              <Text style={[estilos.suave, estilos.col]}>Você</Text>
              <Text style={[estilos.suave, estilos.col]}>Alim. domic.</Text>
              <Text style={[estilos.suave, estilos.col]}>IPCA geral</Text>
            </View>
            {dados.serie.map((p) => (
              <View key={p.periodo} style={estilos.linha}>
                <Text style={[estilos.texto, estilos.colMes]}>{nomePeriodo(p.periodo)}</Text>
                <Text style={[estilos.texto, estilos.col, { fontWeight: '700' }]}>{formatarPercentual(p.variacao)}</Text>
                <Text style={[estilos.texto, estilos.col]}>{oficialDoMes(oficial, 'alimentacao', p.periodo)}</Text>
                <Text style={[estilos.texto, estilos.col]}>{oficialDoMes(oficial, 'geral', p.periodo)}</Text>
              </View>
            ))}
            <Text style={estilos.suave}>
              Acumulado no período: {formatarPercentual(dados.serie.at(-1)!.acumulado)}
            </Text>
            {oficial !== null && oficial !== 'erro' && dados.serie.some((p) => !oficial.geral.has(p.periodo)) && (
              <Text style={estilos.nota}>
                "—": o IBGE ainda não divulgou o IPCA desse mês (sai por volta do dia 10 do mês seguinte).
              </Text>
            )}
          </>
        )}
        <Text style={estilos.nota}>
          Seus cupons de supermercado cobrem principalmente comida, limpeza e higiene. Por isso a comparação
          mais justa é com o grupo "Alimentação no domicílio" do IPCA.
          {oficial === 'erro' ? ' (Não foi possível buscar o IPCA agora.)' : ''}
        </Text>
      </View>

      <View style={estilos.cartao}>
        <Text style={estilos.titulo}>Onde vai o seu dinheiro</Text>
        {dados.gastos.length === 0 && <Text style={estilos.suave}>Nenhum cupom ainda.</Text>}
        {dados.gastos.map((g) => (
          <View key={g.codigo ?? 'sem'} style={{ gap: 4 }}>
            <View style={estilos.linhaGasto}>
              <Text style={[estilos.texto, { flex: 1 }, g.codigo === null && { color: cores.textoSuave }]}>{g.nome}</Text>
              <Text style={estilos.texto}>
                {formatarPercentual(g.fracao, 0)} · {reais(g.gasto)}
              </Text>
            </View>
            <View style={estilos.trilho}>
              <View
                style={[
                  estilos.barra,
                  { width: `${Math.max(g.fracao * 100, 1)}%` },
                  g.codigo === null && { backgroundColor: cores.textoSuave },
                ]}
              />
            </View>
          </View>
        ))}
        <Text style={estilos.nota}>
          As categorias são as do IBGE. Itens que o app ainda não reconhece aparecem em "Sem categoria".
        </Text>
      </View>
    </ScrollView>
  );
}

function oficialDoMes(oficial: Oficial, serie: 'geral' | 'alimentacao', mes: string): string {
  if (oficial === null) return '...';
  if (oficial === 'erro') return '—';
  const v = oficial[serie].get(mes);
  return v === undefined ? '—' : formatarPercentual(v);
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(2), gap: espaco(2) },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(2), gap: espaco(1.25) },
  titulo: { color: cores.texto, fontWeight: '700', fontSize: 17 },
  texto: { color: cores.texto, fontSize: 14, fontVariant: ['tabular-nums'] },
  suave: { color: cores.textoSuave, fontSize: 13 },
  nota: { color: cores.textoSuave, fontSize: 12, lineHeight: 17 },
  linha: { flexDirection: 'row', gap: espaco(0.5) },
  colMes: { flex: 1 },
  col: { flex: 1.1, textAlign: 'right' },
  linhaGasto: { flexDirection: 'row', gap: espaco(1) },
  trilho: { height: 6, borderRadius: 3, backgroundColor: cores.fundo },
  barra: { height: 6, borderRadius: 3, backgroundColor: cores.dragao },
});
