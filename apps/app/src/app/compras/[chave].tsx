import { detalheNota, excluirNota, renomearLoja } from '@dragometro/armazenamento';
import { categoria } from '@dragometro/classificacao';
import { lerUnidadeCupom } from '@dragometro/core';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dataCurta, numero, porUnidade, reais } from '../../lib/formato';
import { useDados } from '../../lib/useDados';
import { cores, espaco } from '../../tema';

/** Um cupom guardado: loja, data, total e os itens, com opção de corrigir o nome da loja. */
export default function Cupom() {
  const { chave } = useLocalSearchParams<{ chave: string }>();
  const db = useSQLiteContext();
  const [versao, setVersao] = useState(0);
  const { dados: nota, erro } = useDados((d) => detalheNota(d, chave), `${chave}|${versao}`);
  const [nome, setNome] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [falha, setFalha] = useState<string>();

  if (erro) return <Text style={[estilos.texto, estilos.tela]}>{erro}</Text>;
  if (nota === null) return <Text style={[estilos.suave, estilos.tela]}>Carregando...</Text>;
  if (!nota) return <Text style={[estilos.texto, estilos.tela]}>Cupom não encontrado.</Text>;

  const hora = nota.dataEmissao.length > 10 ? ` às ${nota.dataEmissao.slice(11, 16)}` : '';
  const soma = Math.round(nota.itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100;

  async function salvarNome() {
    if (nome === null || !nota) return;
    try {
      await renomearLoja(db, nota.lojaId, nome);
      setNome(null);
      setFalha(undefined);
      setVersao((v) => v + 1);
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
    }
  }

  async function excluir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    await excluirNota(db, chave);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: nota.nomeEmitente ?? 'Cupom' }} />

      <View style={estilos.cartao}>
        {nome === null ? (
          <View style={estilos.linha}>
            <Text style={[estilos.titulo, { flex: 1 }]}>{nota.nomeEmitente ?? 'Loja sem nome'}</Text>
            <Pressable onPress={() => setNome(nota.nomeEmitente ?? '')} hitSlop={8}>
              <Text style={estilos.link}>Corrigir nome</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: espaco(1) }}>
            <TextInput
              style={estilos.campo}
              value={nome}
              onChangeText={setNome}
              autoFocus
              placeholder="Nome da loja"
              placeholderTextColor={cores.textoSuave}
              onSubmitEditing={salvarNome}
            />
            <Text style={estilos.suave}>O nome muda em todas as compras desta loja.</Text>
            {falha && <Text style={[estilos.suave, { color: cores.vermelho }]}>{falha}</Text>}
            <View style={estilos.linha}>
              <Pressable style={[estilos.botao, { flex: 1 }]} onPress={salvarNome}>
                <Text style={estilos.botaoTexto}>Salvar nome</Text>
              </Pressable>
              <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => setNome(null)}>
                <Text style={estilos.texto}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        )}
        <Text style={estilos.suave}>
          {dataCurta(nota.dataEmissao)}
          {hora} · {nota.itens.length} itens · {nota.origem === 'foto' ? 'lido da foto' : 'consultado na SEFAZ'}
        </Text>
        {nota.valorTotal !== null && <Text style={estilos.total}>{reais(nota.valorTotal)}</Text>}
        {nota.valorTotal !== null && Math.round(soma * 100) !== Math.round(nota.valorTotal * 100) && (
          <Text style={[estilos.suave, { color: cores.dragao }]}>Soma dos itens: {reais(soma)}</Text>
        )}
      </View>

      {nota.itens.map((item) => {
        const unidade = lerUnidadeCupom(item.unidade);
        const sub = item.subitem ? categoria(item.subitem) : undefined;
        const pesado = unidade !== 'un' || item.quantidade !== 1;
        return (
          <Link key={item.ordem} href={{ pathname: '/produtos/[id]', params: { id: item.produtoId } }} asChild>
            <Pressable style={estilos.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={estilos.descricao}>{item.descricao}</Text>
                <Text style={[estilos.suave, sub && { color: cores.dragao }]}>{sub?.nome ?? 'Sem categoria'}</Text>
                {pesado && (
                  <Text style={estilos.suave}>
                    {numero(item.quantidade)} {unidade} × {reais(item.valorUnitario)}
                    {unidade === 'kg' || unidade === 'l' || unidade === 'un' ? porUnidade(unidade) : ''}
                  </Text>
                )}
              </View>
              <Text style={estilos.valor}>{reais(item.valorTotal)}</Text>
            </Pressable>
          </Link>
        );
      })}

      <Pressable style={estilos.botaoSecundario} onPress={excluir}>
        <Text style={{ color: confirmando ? cores.vermelho : cores.textoSuave }}>
          {confirmando ? 'Toque de novo para excluir este cupom' : 'Excluir este cupom'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(2), gap: espaco(1) },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(2), gap: espaco(0.75), marginBottom: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  titulo: { color: cores.texto, fontSize: 18, fontWeight: '700' },
  total: { color: cores.texto, fontSize: 22, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15 },
  suave: { color: cores.textoSuave, fontSize: 13 },
  link: { color: cores.dragao, fontWeight: '600' },
  campo: {
    color: cores.texto,
    backgroundColor: cores.fundo,
    borderWidth: 1,
    borderColor: cores.textoSuave,
    borderRadius: 8,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
    fontSize: 16,
  },
  item: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
  },
  descricao: { color: cores.texto, fontSize: 15, fontWeight: '600' },
  valor: { color: cores.texto, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  botao: { backgroundColor: cores.dragao, borderRadius: 10, padding: espaco(1.25), alignItems: 'center' },
  botaoSecundario: {
    borderColor: cores.textoSuave,
    borderWidth: 1,
    borderRadius: 10,
    padding: espaco(1.5),
    alignItems: 'center',
    marginTop: espaco(1),
  },
  botaoTexto: { color: cores.fundo, fontWeight: '700' },
});
