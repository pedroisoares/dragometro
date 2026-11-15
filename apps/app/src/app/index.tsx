import { formatarPercentual, variacaoDoItem, type ObservacaoPreco } from '@dragometro/core';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buscarIndice } from '../lib/indices';
import { cores, espaco } from '../tema';

// Exemplo fixo enquanto o armazenamento local não existe: o leite de caixinha.
const EXEMPLO: ObservacaoPreco[] = [
  { produtoId: 'leite', data: '2026-11-02', preco: 5.69 },
  { produtoId: 'leite', data: '2026-11-09', preco: 3.79 },
  { produtoId: 'leite', data: '2026-11-16', preco: 4.8 },
];

export default function Inicio() {
  const [ipca, setIpca] = useState<{ mes: string; valor: number } | null>(null);
  const [erroIpca, setErroIpca] = useState(false);

  useEffect(() => {
    buscarIndice('IPCA', 1)
      .then((serie) => {
        const [mes, valor] = [...serie.entries()].at(-1) ?? [];
        if (mes !== undefined && valor !== undefined) setIpca({ mes, valor });
      })
      .catch(() => setErroIpca(true));
  }, []);

  const semanas = variacaoDoItem(EXEMPLO, 'leite', 'semana');
  const ultima = semanas.at(-1);

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Text style={estilos.titulo}>🐉 Meça o seu dragão</Text>
      <Text style={estilos.subtitulo}>
        A sua inflação pessoal, a partir dos seus cupons fiscais, comparada com a inflação oficial.
      </Text>

      <Link href="/ler-cupom" asChild>
        <Pressable style={estilos.botao}>
          <Text style={estilos.botaoTexto}>Ler QR Code do cupom</Text>
        </Pressable>
      </Link>

      <View style={estilos.cartao}>
        <Text style={estilos.cartaoTitulo}>IPCA oficial (IBGE)</Text>
        {ipca ? (
          <Text style={estilos.numero}>
            {formatarPercentual(ipca.valor)} <Text style={estilos.suave}>em {ipca.mes}</Text>
          </Text>
        ) : (
          <Text style={estilos.suave}>{erroIpca ? 'Não foi possível buscar o IPCA agora.' : 'Carregando...'}</Text>
        )}
      </View>

      <View style={estilos.cartao}>
        <Text style={estilos.cartaoTitulo}>Exemplo: leite de caixinha (1 L)</Text>
        {semanas.map((s) => (
          <View key={s.periodo} style={estilos.linha}>
            <Text style={estilos.texto}>{s.periodo}</Text>
            <Text style={estilos.texto}>R$ {s.preco.toFixed(2).replace('.', ',')}</Text>
            <Text style={[estilos.texto, corDaVariacao(s.variacao)]}>
              {s.variacao === undefined ? '—' : formatarPercentual(s.variacao)}
            </Text>
          </View>
        ))}
        {ultima && (
          <Text style={[estilos.suave, { marginTop: espaco(1) }]}>
            Acumulado desde a primeira compra: {formatarPercentual(ultima.acumulado)}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function corDaVariacao(v?: number) {
  if (v === undefined || v === 0) return null;
  return { color: v > 0 ? cores.vermelho : cores.verde };
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(3), gap: espaco(2) },
  titulo: { color: cores.dragao, fontSize: 28, fontWeight: '700' },
  subtitulo: { color: cores.textoSuave, fontSize: 16, lineHeight: 22 },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center' },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(2), gap: espaco(1) },
  cartaoTitulo: { color: cores.texto, fontWeight: '600', fontSize: 16 },
  numero: { color: cores.texto, fontSize: 24, fontWeight: '700' },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  texto: { color: cores.texto, fontVariant: ['tabular-nums'] },
  suave: { color: cores.textoSuave, fontSize: 14 },
});
