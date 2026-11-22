import {
  detalheNota,
  editarItem,
  UNIDADES_ITEM,
  excluirNota,
  juntarLojas,
  lojasParecidas,
  renomearLoja,
  type ItemDaNota,
  type LojaParecida,
} from '@dragometro/armazenamento';
import { categoria } from '@dragometro/classificacao';
import { lerUnidadeCupom } from '@dragometro/core';
import { contaFecha } from '@dragometro/foto';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dinheiroTexto, numeroTexto, quantidadeTexto } from '../../lib/campos';
import { dataCurta, numero, porUnidade, reais } from '../../lib/formato';
import { useDados } from '../../lib/useDados';
import { cores, espaco } from '../../tema';

/**
 * Um cupom guardado: loja, data, total e os itens. Dá para corrigir o nome da loja
 * (e juntar lojas repetidas) e a descrição dos itens; as correções refazem o
 * agrupamento em produtos e a categoria do IPCA, que é o que entra nos cálculos.
 */
export default function Cupom() {
  const { chave } = useLocalSearchParams<{ chave: string }>();
  const db = useSQLiteContext();
  const [versao, setVersao] = useState(0);
  // Embrulhado em { nota } para separar "carregando" (null) de "não encontrado" (nota null).
  const { dados, erro } = useDados(async (d) => ({ nota: await detalheNota(d, chave) }), `${chave}|${versao}`);
  const [nome, setNome] = useState<string | null>(null);
  const [parecidas, setParecidas] = useState<LojaParecida[]>([]);
  const [editando, setEditando] = useState<Edicao | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [confirmando, setConfirmando] = useState(false);
  const [falha, setFalha] = useState<string>();

  if (erro) return <Text style={[estilos.texto, estilos.tela]}>{erro}</Text>;
  if (dados === null) return <Text style={[estilos.suave, estilos.tela]}>Carregando...</Text>;
  const { nota } = dados;
  if (!nota) return <Text style={[estilos.texto, estilos.tela]}>Cupom não encontrado.</Text>;

  const hora = nota.dataEmissao.length > 10 ? ` às ${nota.dataEmissao.slice(11, 16)}` : '';
  const soma = Math.round(nota.itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100;
  const recarregar = () => setVersao((v) => v + 1);

  async function tentar(acao: () => Promise<void>) {
    try {
      setFalha(undefined);
      await acao();
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
    }
  }

  const salvarNome = () =>
    tentar(async () => {
      if (nome === null || !nota) return;
      await renomearLoja(db, nota.lojaId, nome);
      setParecidas(await lojasParecidas(db, nota.lojaId, nome));
      setNome(null);
      setAviso('Nome da loja corrigido em todas as compras dela.');
      recarregar();
    });

  const juntar = (outra: LojaParecida) =>
    tentar(async () => {
      if (!nota) return;
      const fica = await juntarLojas(db, nota.lojaId, outra.id, nota.nomeEmitente ?? outra.nome);
      setParecidas([]);
      setAviso(`Lojas juntadas: as compras de "${outra.nome}" e desta loja agora são comparadas juntas nos cálculos.`);
      // Cupom lido pela foto tem a loja na chave: se a loja mudou, a chave também.
      const antes = `foto:${nota.lojaId}|`;
      if (fica !== nota.lojaId && chave.startsWith(antes)) {
        router.setParams({ chave: `foto:${fica}|${chave.slice(antes.length)}` });
      } else {
        recarregar();
      }
    });

  const salvarItem = () =>
    tentar(async () => {
      if (!editando) return;
      const r = await editarItem(
        db,
        chave,
        editando.ordem,
        {
          descricao: editando.texto,
          quantidade: numeroTexto(editando.quantidade),
          unidade: editando.unidade,
          valorUnitario: numeroTexto(editando.valorUnitario),
          valorTotal: numeroTexto(editando.valorTotal),
        },
        { todasDoProduto: editando.todas },
      );
      const sub = r.subitem ? categoria(r.subitem)?.nome : undefined;
      setEditando(null);
      setAviso(
        `Item corrigido${r.itensAlterados > 1 ? ` (descrição em ${r.itensAlterados} compras)` : ''}. ` +
          (r.contaFecha ? '' : 'Atenção: quantidade × valor unitário não bate com o total (desconto?). ') +
          (r.comprasDoProduto > 1
            ? `O item é comparado com ${r.comprasDoProduto - 1} ${r.comprasDoProduto === 2 ? 'outra compra' : 'outras compras'} do mesmo produto. `
            : 'Por enquanto é a única compra deste produto. ') +
          `Categoria: ${sub ?? 'sem categoria'}.`,
      );
      recarregar();
    });

  async function excluir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    await excluirNota(db, chave);
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
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
            <Botoes salvar="Salvar nome" aoSalvar={salvarNome} aoCancelar={() => setNome(null)} />
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

      {parecidas.map((outra) => (
        <View key={outra.id} style={[estilos.cartao, estilos.destaque]}>
          <Text style={estilos.texto}>
            Já existe a loja <Text style={{ fontWeight: '700' }}>{outra.nome}</Text> ({outra.compras}{' '}
            {outra.compras === 1 ? 'compra' : 'compras'}). Se for a mesma loja, junte as duas: assim os mesmos produtos
            são comparados juntos na variação de preço e na sua inflação.
          </Text>
          <Botoes salvar="Juntar as lojas" aoSalvar={() => juntar(outra)} cancelar="São diferentes" aoCancelar={() => setParecidas([])} />
        </View>
      ))}

      {aviso && (
        <Pressable style={[estilos.cartao, { borderColor: cores.verde, borderWidth: 1 }]} onPress={() => setAviso(undefined)}>
          <Text style={[estilos.texto, { color: cores.verde }]}>✓ {aviso}</Text>
        </Pressable>
      )}
      {falha && <Text style={[estilos.texto, { color: cores.vermelho }]}>{falha}</Text>}

      {nota.itens.map((item) =>
        editando?.ordem === item.ordem ? (
          <EditarItem
            key={item.ordem}
            item={item}
            edicao={editando}
            aoMudar={(c) => setEditando({ ...editando, ...c })}
            aoSalvar={salvarItem}
            aoCancelar={() => setEditando(null)}
          />
        ) : (
          <LinhaItem
            key={item.ordem}
            item={item}
            aoEditar={() => {
              setAviso(undefined);
              setEditando({
                ordem: item.ordem,
                texto: item.descricao,
                todas: false,
                quantidade: quantidadeTexto(item.quantidade, item.unidade),
                unidade: item.unidade.toUpperCase(),
                valorUnitario: dinheiroTexto(item.valorUnitario),
                valorTotal: dinheiroTexto(item.valorTotal),
              });
            }}
          />
        ),
      )}

      <Pressable style={estilos.botaoSecundario} onPress={excluir}>
        <Text style={{ color: confirmando ? cores.vermelho : cores.textoSuave }}>
          {confirmando ? 'Toque de novo para excluir este cupom' : 'Excluir este cupom'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function LinhaItem({ item, aoEditar }: { item: ItemDaNota; aoEditar: () => void }) {
  const unidade = lerUnidadeCupom(item.unidade);
  const sub = item.subitem ? categoria(item.subitem) : undefined;
  const pesado = unidade !== 'un' || item.quantidade !== 1;
  return (
    <View style={estilos.item}>
      <Link href={{ pathname: '/produtos/[id]', params: { id: item.produtoId } }} asChild>
        <Pressable style={estilos.itemTexto}>
          <Text style={estilos.descricao}>{item.descricao}</Text>
          <Text style={[estilos.suave, sub && { color: cores.dragao }]}>
            {sub?.nome ?? 'Sem categoria'}
            {item.comprasDoProduto > 1 ? ` · ${item.comprasDoProduto} compras` : ''}
          </Text>
          {pesado && (
            <Text style={estilos.suave}>
              {numero(item.quantidade)} {unidade} × {reais(item.valorUnitario)}
              {unidade === 'kg' || unidade === 'l' || unidade === 'un' ? porUnidade(unidade) : ''}
            </Text>
          )}
        </Pressable>
      </Link>
      <View style={{ alignItems: 'flex-end', gap: espaco(1) }}>
        <Text style={estilos.valor}>{reais(item.valorTotal)}</Text>
        <Pressable onPress={aoEditar} hitSlop={10}>
          <Text style={estilos.link}>Editar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Item em edição: campos como texto, do jeito que a pessoa digita. */
interface Edicao {
  ordem: number;
  texto: string;
  todas: boolean;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
}

function EditarItem({
  item,
  edicao,
  aoMudar,
  aoSalvar,
  aoCancelar,
}: {
  item: ItemDaNota;
  edicao: Edicao;
  aoMudar: (c: Partial<Edicao>) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const outras = item.comprasDoProduto - 1;
  const mudouDescricao = edicao.texto.trim().toUpperCase().replace(/\s+/g, ' ') !== item.descricao;
  const q = numeroTexto(edicao.quantidade);
  const u = numeroTexto(edicao.valorUnitario);
  const t = numeroTexto(edicao.valorTotal);
  const validos = q > 0 && u > 0 && t > 0 && edicao.texto.trim().length > 0;
  const calculado = q > 0 && u > 0 ? Math.round(q * u * 100 + 1e-6) / 100 : Number.NaN;
  const fecha = validos && contaFecha(q, u, t);
  const unidades: string[] = [...UNIDADES_ITEM];
  if (!unidades.includes(item.unidade.toUpperCase())) unidades.push(item.unidade.toUpperCase());
  const base = lerUnidadeCupom(edicao.unidade);

  return (
    <View style={[estilos.cartao, estilos.destaque]}>
      <Text style={estilos.suave}>Descrição</Text>
      <TextInput
        style={estilos.campo}
        value={edicao.texto}
        onChangeText={(texto) => aoMudar({ texto })}
        autoCapitalize="characters"
      />
      {mudouDescricao &&
        (item.temCodigo ? (
          <Text style={estilos.suave}>
            Item de cupom da SEFAZ: o código identifica o produto, então a descrição muda em
            {outras > 0 ? ` todas as ${item.comprasDoProduto} compras dele.` : ' todas as compras dele.'}
          </Text>
        ) : (
          outras > 0 && (
            <Pressable style={estilos.linha} onPress={() => aoMudar({ todas: !edicao.todas })} hitSlop={6}>
              <View style={[estilos.caixa, edicao.todas && { backgroundColor: cores.dragao, borderColor: cores.dragao }]}>
                {edicao.todas && <Text style={estilos.marca}>✓</Text>}
              </View>
              <Text style={[estilos.texto, { flex: 1 }]}>
                Corrigir a descrição também {outras === 1 ? 'na outra compra' : `nas outras ${outras} compras`} deste produto
              </Text>
            </Pressable>
          )
        ))}

      <Text style={estilos.suave}>Unidade</Text>
      <View style={[estilos.linha, { flexWrap: 'wrap' }]}>
        {unidades.map((un) => (
          <Pressable
            key={un}
            onPress={() => aoMudar({ unidade: un })}
            style={[estilos.chip, edicao.unidade === un && { backgroundColor: cores.dragao, borderColor: cores.dragao }]}
          >
            <Text style={[estilos.chipTexto, edicao.unidade === un && { color: cores.fundo }]}>{un}</Text>
          </Pressable>
        ))}
      </View>

      {base === 'un' && q > 0 && !Number.isInteger(q) && (
        <Text style={[estilos.suave, { color: cores.dragao }]}>
          ⚠ Quantidade fracionada com unidade {edicao.unidade}: se for peso, escolha KG, senão o preço sai por unidade e
          não por quilo.
        </Text>
      )}
      <View style={estilos.linha}>
        <CampoNumero rotulo={`Quantidade (${edicao.unidade.toLowerCase()})`} valor={edicao.quantidade} aoMudar={(quantidade) => aoMudar({ quantidade })} />
        <CampoNumero
          rotulo={`Valor unitário${base === 'un' ? '' : ` (R$${porUnidade(base === 'g' || base === 'ml' ? (base === 'g' ? 'kg' : 'l') : base)})`}`}
          valor={edicao.valorUnitario}
          aoMudar={(valorUnitario) => aoMudar({ valorUnitario })}
        />
      </View>
      <CampoNumero rotulo="Valor total do item (R$)" valor={edicao.valorTotal} aoMudar={(valorTotal) => aoMudar({ valorTotal })} />

      {validos ? (
        fecha ? (
          <Text style={[estilos.suave, { color: cores.verde }]}>
            ✓ {edicao.quantidade} × {edicao.valorUnitario} = {reais(t)}
          </Text>
        ) : (
          <View style={{ gap: espaco(0.75) }}>
            <Text style={[estilos.suave, { color: cores.dragao }]}>
              ⚠ {edicao.quantidade} × {edicao.valorUnitario} = {reais(calculado)}, diferente do total {reais(t)}. Pode ser
              desconto; se não for, corrija:
            </Text>
            <View style={[estilos.linha, { flexWrap: 'wrap' }]}>
              <Pressable style={estilos.chip} onPress={() => aoMudar({ valorTotal: dinheiroTexto(calculado) })}>
                <Text style={estilos.chipTexto}>Usar {reais(calculado)} no total</Text>
              </Pressable>
              <Pressable style={estilos.chip} onPress={() => aoMudar({ valorUnitario: dinheiroTexto(Math.round((t / q) * 100) / 100) })}>
                <Text style={estilos.chipTexto}>Calcular o valor unitário pelo total</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : (
        <Text style={[estilos.suave, { color: cores.dragao }]}>Preencha descrição, quantidade e valores (maiores que zero).</Text>
      )}

      <Text style={estilos.suave}>
        Quantidade, unidade e valor unitário formam o preço comparável (por kg, litro ou unidade) usado na variação de
        preço; o total é o seu gasto, que pesa cada categoria na sua inflação. Mudar a descrição reclassifica o item no
        IPCA e confere se ele é o mesmo produto de outras compras desta loja.
      </Text>
      <Botoes salvar="Salvar item" aoSalvar={validos ? aoSalvar : () => {}} aoCancelar={aoCancelar} />
    </View>
  );
}

function CampoNumero({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (t: string) => void }) {
  return (
    <View style={{ flex: 1, gap: espaco(0.5) }}>
      <Text style={estilos.suave}>{rotulo}</Text>
      <TextInput
        style={[estilos.campo, { textAlign: 'right', fontVariant: ['tabular-nums'] }]}
        value={valor}
        onChangeText={aoMudar}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function Botoes({
  salvar,
  aoSalvar,
  cancelar = 'Cancelar',
  aoCancelar,
}: {
  salvar: string;
  aoSalvar: () => void;
  cancelar?: string;
  aoCancelar: () => void;
}) {
  return (
    <View style={estilos.linha}>
      <Pressable style={[estilos.botao, { flex: 1 }]} onPress={aoSalvar}>
        <Text style={estilos.botaoTexto}>{salvar}</Text>
      </Pressable>
      <Pressable style={[estilos.botaoSecundario, { flex: 1, marginTop: 0 }]} onPress={aoCancelar}>
        <Text style={estilos.texto}>{cancelar}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(2), gap: espaco(1) },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(2), gap: espaco(0.75) },
  destaque: { borderWidth: 1, borderColor: cores.dragao, gap: espaco(1) },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  titulo: { color: cores.texto, fontSize: 18, fontWeight: '700' },
  total: { color: cores.texto, fontSize: 22, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15, lineHeight: 21 },
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
  itemTexto: { flex: 1, gap: 2 },
  descricao: { color: cores.texto, fontSize: 15, fontWeight: '600' },
  valor: { color: cores.texto, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  caixa: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: cores.textoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: cores.textoSuave,
    borderRadius: 16,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
  },
  chipTexto: { color: cores.texto, fontSize: 13, fontWeight: '600' },
  marca: { color: cores.fundo, fontWeight: '800', fontSize: 14 },
  botao: { backgroundColor: cores.dragao, borderRadius: 10, padding: espaco(1.25), alignItems: 'center' },
  botaoSecundario: {
    borderColor: cores.textoSuave,
    borderWidth: 1,
    borderRadius: 10,
    padding: espaco(1.25),
    alignItems: 'center',
    marginTop: espaco(1),
  },
  botaoTexto: { color: cores.fundo, fontWeight: '700' },
});
