import { listarNotas } from '@dragometro/armazenamento';
import { formatarPercentual } from '@dragometro/core';
import { Link, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { reais } from '../lib/formato';
import { buscarIndice } from '../lib/indices';
import { useDados } from '../lib/useDados';
import { cores, espaco } from '../tema';

export default function Inicio() {
  const [ipca, setIpca] = useState<{ mes: string; valor: number } | null>(null);
  const [erroIpca, setErroIpca] = useState(false);
  const { dados: notas } = useDados(listarNotas);

  useEffect(() => {
    buscarIndice('IPCA', 1)
      .then((serie) => {
        const [mes, valor] = [...serie.entries()].at(-1) ?? [];
        if (mes !== undefined && valor !== undefined) setIpca({ mes, valor });
      })
      .catch(() => setErroIpca(true));
  }, []);

  const totalGasto = notas?.reduce((s, n) => s + (n.valorTotal ?? 0), 0) ?? 0;
  const totalItens = notas?.reduce((s, n) => s + n.quantidadeItens, 0) ?? 0;

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
        <Text style={estilos.cartaoTitulo}>Suas compras</Text>
        {notas && notas.length > 0 ? (
          <>
            <Text style={estilos.numero}>
              {notas.length} {notas.length === 1 ? 'cupom' : 'cupons'}
            </Text>
            <Text style={estilos.suave}>
              {totalItens} itens · {reais(totalGasto)}
            </Text>
            <View style={estilos.atalhos}>
              <Atalho href="/compras" texto="Ver cupons" />
              <Atalho href="/produtos" texto="Ver produtos" />
            </View>
          </>
        ) : (
          <Text style={estilos.suave}>
            {notas ? 'Nenhum cupom ainda. Leia o primeiro para começar a medir o seu dragão.' : 'Carregando...'}
          </Text>
        )}
      </View>

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

      <Text style={estilos.rodape}>Seus cupons ficam guardados só neste aparelho.</Text>
    </ScrollView>
  );
}

function Atalho({ href, texto }: { href: Href; texto: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={estilos.atalho}>
        <Text style={{ color: cores.texto }}>{texto}</Text>
      </Pressable>
    </Link>
  );
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
  suave: { color: cores.textoSuave, fontSize: 14 },
  atalhos: { flexDirection: 'row', gap: espaco(1), marginTop: espaco(1) },
  atalho: { flex: 1, borderColor: cores.textoSuave, borderWidth: 1, borderRadius: 10, padding: espaco(1.25), alignItems: 'center' },
  rodape: { color: cores.textoSuave, fontSize: 12, textAlign: 'center' },
});
