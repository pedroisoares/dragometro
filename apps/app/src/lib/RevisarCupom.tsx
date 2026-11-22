import { acharLoja, type CupomParaSalvar } from '@dragometro/armazenamento';
import { contaFecha, somaDosItens, type CupomFoto, type SituacaoItem, type UnidadeFoto } from '@dragometro/foto';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { reais } from './formato';
import { cores, espaco } from '../tema';

interface ItemEditavel {
  id: number;
  descricao: string;
  quantidade: string;
  unidade: UnidadeFoto;
  valorUnitario: string;
  valorTotal: string;
  /** Situação dada pelo leitor; deixa de valer quando a pessoa edita o item. */
  situacaoLida?: SituacaoItem;
}

/**
 * Revisão de um cupom lido pela foto, antes de salvar. Tudo é editável; os itens em que
 * a conta não fecha ficam destacados, e a soma dos itens é comparada com o total do cupom.
 */
export function RevisarCupom({
  cupom,
  fotoUri,
  aoSalvar,
  aoDigitarChave,
}: {
  cupom: CupomFoto;
  fotoUri?: string;
  aoSalvar: (cupom: CupomParaSalvar) => Promise<void>;
  aoDigitarChave: () => void;
}) {
  const db = useSQLiteContext();
  const [loja, setLoja] = useState(cupom.loja.nome ?? '');
  const [lojaConhecida, setLojaConhecida] = useState(false);
  const [data, setData] = useState(cupom.dataEmissao ? isoParaTexto(cupom.dataEmissao) : '');
  const [total, setTotal] = useState(cupom.valorTotal !== undefined ? dinheiro(cupom.valorTotal) : '');
  const [itens, setItens] = useState<ItemEditavel[]>(() =>
    cupom.itens.map((i, id) => ({
      id,
      descricao: i.descricao,
      quantidade: Number.isFinite(i.quantidade) ? quantidadeTexto(i.quantidade, i.unidade) : '',
      unidade: i.unidade,
      valorUnitario: Number.isFinite(i.valorUnitario) ? dinheiro(i.valorUnitario) : '',
      valorTotal: Number.isFinite(i.valorTotal) ? dinheiro(i.valorTotal) : '',
      situacaoLida: i.situacao,
    })),
  );
  const [verFoto, setVerFoto] = useState(false);
  const [confirmarDiferenca, setConfirmarDiferenca] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  // Loja já usada com nome parecido (o OCR pode ler o nome um pouco diferente a cada foto).
  useEffect(() => {
    if (!cupom.loja.nome) return;
    acharLoja(db, cupom.loja.nome, cupom.loja.cnpj).then((l) => {
      if (!l.id.startsWith('loja:') || l.nome !== cupom.loja.nome) {
        setLoja(l.nome);
        setLojaConhecida(true);
      }
    });
  }, [db, cupom.loja.nome, cupom.loja.cnpj]);

  const valores = itens.map((i) => ({
    quantidade: numeroTexto(i.quantidade),
    valorUnitario: numeroTexto(i.valorUnitario),
    valorTotal: numeroTexto(i.valorTotal),
  }));
  const situacoes = itens.map((i, k) => situacaoAtual(i, valores[k]!));
  const paraConferir = situacoes.filter((s) => s === 'conferir').length;
  const soma = somaDosItens(valores);
  const totalCupom = numeroTexto(total);
  const somaBate = Number.isFinite(totalCupom) && Math.round(soma * 100) === Math.round(totalCupom * 100);
  const dataIso = textoParaIso(data);
  const pronto = loja.trim() && dataIso && itens.length > 0 && itens.every((i, k) => i.descricao.trim() && completo(valores[k]!));

  const mudarItem = (id: number, campo: Partial<ItemEditavel>) => {
    setConfirmarDiferenca(false);
    setItens((atual) => atual.map((i) => (i.id === id ? { ...i, ...campo, situacaoLida: undefined } : i)));
  };

  async function salvar() {
    if (!pronto || !dataIso) return;
    if (!somaBate && !confirmarDiferenca) {
      setConfirmarDiferenca(true);
      return;
    }
    setSalvando(true);
    setErro(undefined);
    try {
      await aoSalvar({
        loja: { nome: loja.trim(), ...(cupom.loja.cnpj ? { cnpj: cupom.loja.cnpj } : {}) },
        ...(cupom.numero ? { numero: cupom.numero } : {}),
        dataEmissao: dataIso,
        ...(Number.isFinite(totalCupom) ? { valorTotal: totalCupom } : {}),
        itens: itens.map((i, k) => ({ descricao: i.descricao.trim(), unidade: i.unidade, ...valores[k]! })),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.tela} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Confira o cupom</Text>
      <Text style={estilos.suave}>
        {itens.length} itens lidos da foto
        {paraConferir ? ` · ${paraConferir} para conferir (destacados)` : ' · todas as contas fecham'}
      </Text>

      {fotoUri && (
        <Pressable onPress={() => setVerFoto(!verFoto)}>
          <Text style={estilos.link}>{verFoto ? 'Esconder a foto' : 'Ver a foto para comparar'}</Text>
        </Pressable>
      )}
      {fotoUri && verFoto && <Image source={{ uri: fotoUri }} style={estilos.foto} resizeMode="contain" />}

      <Campo rotulo="Loja" valor={loja} aoMudar={setLoja} />
      {lojaConhecida && <Text style={estilos.suave}>Mesma loja de compras anteriores.</Text>}
      <View style={estilos.linha}>
        <Campo rotulo="Data e hora" valor={data} aoMudar={setData} placeholder="dd/mm/aaaa hh:mm" flex={3} erro={!dataIso} />
        <Campo rotulo="Total do cupom" valor={total} aoMudar={(t) => { setTotal(t); setConfirmarDiferenca(false); }} teclado="decimal-pad" flex={2} />
      </View>

      <View style={[estilos.soma, { borderColor: somaBate ? cores.verde : cores.dragao }]}>
        <Text style={[estilos.texto, { color: somaBate ? cores.verde : cores.dragao }]}>
          {somaBate
            ? `✓ A soma dos itens bate com o total (${reais(soma)})`
            : `A soma dos itens (${reais(soma)}) não bate com o total${
                Number.isFinite(totalCupom) ? ` (${reais(totalCupom)}): diferença de ${reais(Math.abs(soma - totalCupom))}` : ''
              }`}
        </Text>
      </View>

      {itens.map((item, k) => (
        <CartaoItem
          key={item.id}
          item={item}
          situacao={situacoes[k]!}
          aoMudar={(c) => mudarItem(item.id, c)}
          aoRemover={() => setItens((atual) => atual.filter((i) => i.id !== item.id))}
        />
      ))}

      <Pressable
        style={estilos.botaoSecundario}
        onPress={() =>
          setItens((atual) => [
            ...atual,
            { id: Math.max(-1, ...atual.map((i) => i.id)) + 1, descricao: '', quantidade: '1', unidade: 'UN', valorUnitario: '', valorTotal: '' },
          ])
        }
      >
        <Text style={estilos.texto}>+ Adicionar item</Text>
      </Pressable>

      {erro && <Text style={[estilos.texto, { color: cores.vermelho }]}>{erro}</Text>}
      {confirmarDiferenca && (
        <Text style={[estilos.texto, { color: cores.dragao }]}>
          A soma ainda não bate com o total. Toque de novo para salvar assim mesmo.
        </Text>
      )}
      <Pressable style={[estilos.botao, (!pronto || salvando) && { opacity: 0.5 }]} onPress={salvar} disabled={!pronto || salvando}>
        <Text style={estilos.botaoTexto}>
          {salvando ? 'Salvando...' : confirmarDiferenca ? 'Salvar mesmo assim' : 'Salvar cupom'}
        </Text>
      </Pressable>
      {!pronto && <Text style={estilos.suave}>Para salvar: loja, data e todos os itens com descrição e valores.</Text>}

      <Pressable onPress={aoDigitarChave}>
        <Text style={estilos.link}>Este cupom tem chave de acesso (44 números)? Digitar a chave</Text>
      </Pressable>
    </ScrollView>
  );
}

function CartaoItem({
  item,
  situacao,
  aoMudar,
  aoRemover,
}: {
  item: ItemEditavel;
  situacao: 'ok' | 'ajustado' | 'conferir';
  aoMudar: (c: Partial<ItemEditavel>) => void;
  aoRemover: () => void;
}) {
  const cor = situacao === 'conferir' ? cores.dragao : situacao === 'ajustado' ? cores.textoSuave : cores.verde;
  return (
    <View style={[estilos.cartao, situacao === 'conferir' && { borderColor: cores.dragao }]}>
      <View style={estilos.linha}>
        <TextInput
          style={[estilos.campo, { flex: 1, fontWeight: '600' }]}
          value={item.descricao}
          onChangeText={(descricao) => aoMudar({ descricao })}
          placeholder="Descrição"
          placeholderTextColor={cores.textoSuave}
          autoCapitalize="characters"
        />
        <Pressable onPress={aoRemover} hitSlop={8}>
          <Text style={{ color: cores.textoSuave, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      <View style={[estilos.linha, { alignItems: 'center' }]}>
        <TextInput style={[estilos.campo, estilos.numero]} value={item.quantidade} onChangeText={(quantidade) => aoMudar({ quantidade })} keyboardType="decimal-pad" />
        <Pressable onPress={() => aoMudar({ unidade: item.unidade === 'KG' ? 'UN' : 'KG' })} hitSlop={6}>
          <Text style={estilos.unidade}>{item.unidade}</Text>
        </Pressable>
        <Text style={estilos.suave}>×</Text>
        <TextInput style={[estilos.campo, estilos.numero]} value={item.valorUnitario} onChangeText={(valorUnitario) => aoMudar({ valorUnitario })} keyboardType="decimal-pad" />
        <Text style={estilos.suave}>=</Text>
        <TextInput style={[estilos.campo, estilos.numero, { fontWeight: '700' }]} value={item.valorTotal} onChangeText={(valorTotal) => aoMudar({ valorTotal })} keyboardType="decimal-pad" />
      </View>
      <Text style={[estilos.situacao, { color: cor }]}>
        {situacao === 'ok' ? '✓ confere' : situacao === 'ajustado' ? '✓ corrigido pela conta, vale uma olhada' : '⚠ confira com o cupom'}
      </Text>
    </View>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  teclado,
  flex,
  erro,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (t: string) => void;
  placeholder?: string;
  teclado?: 'decimal-pad';
  flex?: number;
  erro?: boolean;
}) {
  return (
    <View style={{ flex, gap: espaco(0.5) }}>
      <Text style={estilos.suave}>{rotulo}</Text>
      <TextInput
        style={[estilos.campo, erro && { borderColor: cores.dragao, borderWidth: 1 }]}
        value={valor}
        onChangeText={aoMudar}
        placeholder={placeholder}
        placeholderTextColor={cores.textoSuave}
        keyboardType={teclado}
      />
    </View>
  );
}

function situacaoAtual(item: ItemEditavel, v: { quantidade: number; valorUnitario: number; valorTotal: number }): 'ok' | 'ajustado' | 'conferir' {
  if (!completo(v) || !contaFecha(v.quantidade, v.valorUnitario, v.valorTotal)) return 'conferir';
  if (item.situacaoLida === 'conferir') return 'conferir';
  return item.situacaoLida === 'ajustado' ? 'ajustado' : 'ok';
}

function completo(v: { quantidade: number; valorUnitario: number; valorTotal: number }): boolean {
  return v.quantidade > 0 && v.valorUnitario > 0 && v.valorTotal > 0;
}

/** "16,98" ou "16.98" → 16.98 */
function numeroTexto(t: string): number {
  const limpo = t.trim().replace(/\s/g, '').replace(',', '.');
  return limpo && /^\d*\.?\d+$/.test(limpo) ? Number(limpo) : Number.NaN;
}

function dinheiro(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

function quantidadeTexto(v: number, unidade: UnidadeFoto): string {
  return (unidade === 'UN' && Number.isInteger(v) ? String(v) : v.toFixed(3)).replace('.', ',');
}

/** "2026-11-07T10:09:58" → "07/11/2026 10:09" */
function isoParaTexto(iso: string): string {
  const [d, h] = iso.split('T');
  const [a, m, dia] = d!.split('-');
  return `${dia}/${m}/${a}${h ? ` ${h.slice(0, 5)}` : ''}`;
}

/** "07/11/2026 10:09" → "2026-11-07T10:09:00"; inválida → undefined */
function textoParaIso(texto: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto.trim());
  if (!m) return undefined;
  const [, d, mes, a, h, min, s] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  const data = `${a}-${mes!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  if (!h) return data;
  if (Number(h) > 23) return undefined;
  return `${data}T${h.padStart(2, '0')}:${min}:${s ?? '00'}`;
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(2), gap: espaco(1.5), paddingBottom: espaco(6) },
  titulo: { color: cores.texto, fontSize: 20, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  suave: { color: cores.textoSuave, fontSize: 13 },
  link: { color: cores.dragao, fontWeight: '600', paddingVertical: espaco(0.5) },
  foto: { width: '100%', height: 520, borderRadius: 12, backgroundColor: cores.cartao },
  linha: { flexDirection: 'row', gap: espaco(1) },
  soma: { borderWidth: 1, borderRadius: 12, padding: espaco(1.5) },
  cartao: { backgroundColor: cores.cartao, borderRadius: 12, padding: espaco(1.5), gap: espaco(1), borderWidth: 1, borderColor: 'transparent' },
  campo: { color: cores.texto, backgroundColor: cores.fundo, borderRadius: 8, paddingHorizontal: espaco(1), paddingVertical: espaco(0.75), fontSize: 15 },
  numero: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'], minWidth: 0 },
  unidade: { color: cores.dragao, fontWeight: '700', fontSize: 13, minWidth: 22 },
  situacao: { fontSize: 12 },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center' },
  botaoSecundario: { borderColor: cores.textoSuave, borderWidth: 1, borderRadius: 12, padding: espaco(1.5), alignItems: 'center' },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
});
