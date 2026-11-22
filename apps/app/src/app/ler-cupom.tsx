import { salvarNota, type ResultadoSalvar } from '@dragometro/armazenamento';
import { chaveDoQrCode, lerNotaDaPagina, type NotaFiscal } from '@dragometro/sefaz';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { buscarNota } from '../lib/consulta';
import { PaginaSefazOculta } from '../lib/PaginaSefazOculta';
import { dataCurta, numero, reais } from '../lib/formato';
import { cores, espaco } from '../tema';

type Estado =
  | { tipo: 'lendo' }
  | { tipo: 'consultando'; chave: string; viaNavegador?: string }
  | { tipo: 'pronto'; nota: NotaFiscal; resultado: ResultadoSalvar }
  | { tipo: 'erro'; mensagem: string };

export default function LerCupom() {
  const db = useSQLiteContext();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ tipo: 'lendo' });
  const [link, setLink] = useState('');
  const processando = useRef(false);
  // Cada leitura ganha um número; respostas de leituras canceladas são ignoradas.
  const consultaAtual = useRef(0);

  async function processar(conteudoQr: string) {
    if (processando.current) return;
    processando.current = true;
    const id = ++consultaAtual.current;
    try {
      const chave = chaveDoQrCode(conteudoQr);
      setEstado({ tipo: 'consultando', chave: chave.chave });
      const busca = await buscarNota(conteudoQr);
      if (busca.tipo === 'usar-navegador') {
        // Portal com verificação anti-robô: abre a página no WebView invisível.
        setEstado({ tipo: 'consultando', chave: chave.chave, viaNavegador: conteudoQr });
        return;
      }
      await concluir(busca.nota, id);
    } catch (e) {
      falhar(e, id);
    }
  }

  async function concluir(nota: NotaFiscal, id: number) {
    if (id !== consultaAtual.current) return; // consulta cancelada
    const resultado = await salvarNota(db, nota);
    setEstado({ tipo: 'pronto', nota, resultado });
  }

  function falhar(e: unknown, id: number) {
    if (id !== consultaAtual.current) return; // consulta cancelada
    setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
  }

  async function aoReceberHtml(html: string, conteudoQr: string, id: number) {
    try {
      await concluir(lerNotaDaPagina(html, conteudoQr), id);
    } catch (e) {
      falhar(e, id);
    }
  }

  function lerOutro() {
    consultaAtual.current++;
    processando.current = false;
    setLink('');
    setEstado({ tipo: 'lendo' });
  }

  if (estado.tipo === 'consultando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.dragao} size="large" />
        <Text style={estilos.texto}>
          {estado.viaNavegador ? 'Passando pela verificação da SEFAZ...' : 'Consultando a SEFAZ...'}
        </Text>
        <Text style={estilos.suave}>{estado.chave}</Text>
        {estado.viaNavegador && (
          <PaginaSefazOculta
            url={estado.viaNavegador}
            aoReceberHtml={(html) => aoReceberHtml(html, estado.viaNavegador!, consultaAtual.current)}
            aoFalhar={(e) => falhar(e, consultaAtual.current)}
          />
        )}
        <Pressable style={estilos.botaoSecundario} onPress={lerOutro}>
          <Text style={estilos.texto}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <View style={estilos.centro}>
        <Text style={[estilos.texto, { color: cores.vermelho }]}>{estado.mensagem}</Text>
        <Pressable style={estilos.botao} onPress={lerOutro}>
          <Text style={estilos.botaoTexto}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (estado.tipo === 'pronto') {
    const { nota, resultado } = estado;
    return (
      <FlatList
        contentContainerStyle={{ padding: espaco(2), gap: espaco(1) }}
        data={nota.itens}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <View style={{ marginBottom: espaco(1), gap: espaco(0.5) }}>
            <Text style={[estilos.aviso, resultado === 'repetida' && { color: cores.textoSuave }]}>
              {resultado === 'nova' ? '✓ Cupom salvo nas suas compras' : 'Este cupom já estava salvo'}
            </Text>
            <Text style={estilos.titulo}>{nota.emitente.nome ?? nota.emitente.cnpj}</Text>
            <Text style={estilos.suave}>
              {nota.dataEmissao ? dataCurta(nota.dataEmissao) : ''} · {nota.itens.length} itens
              {produtosDistintos(nota) < nota.itens.length ? ` (${produtosDistintos(nota)} produtos)` : ''}
              {nota.valorTotal !== undefined ? ` · ${reais(nota.valorTotal)}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={estilos.item}>
            <Text style={[estilos.texto, { textAlign: 'left' }]}>{item.descricao}</Text>
            <Text style={estilos.suave}>
              {numero(item.quantidade)} {item.unidade} × {reais(item.valorUnitario)} = {reais(item.valorTotal)}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: espaco(1), marginTop: espaco(2) }}>
            <Pressable style={estilos.botao} onPress={lerOutro}>
              <Text style={estilos.botaoTexto}>Ler outro cupom</Text>
            </Pressable>
            <Link href="/produtos" asChild>
              <Pressable style={estilos.botaoSecundario}>
                <Text style={estilos.texto}>Ver meus produtos</Text>
              </Pressable>
            </Link>
          </View>
        }
      />
    );
  }

  // Lendo: câmera (se permitida) + campo para colar o link do QR Code.
  return (
    <View style={estilos.tela}>
      <View style={estilos.colar}>
        <TextInput
          style={estilos.campo}
          value={link}
          onChangeText={setLink}
          placeholder="ou cole aqui o link do QR Code"
          placeholderTextColor={cores.textoSuave}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => link && processar(link.trim())}
        />
        <Pressable style={[estilos.botao, { paddingHorizontal: espaco(2) }]} onPress={() => link && processar(link.trim())}>
          <Text style={estilos.botaoTexto}>Ler</Text>
        </Pressable>
      </View>

      <Link href="/chave" asChild>
        <Pressable style={estilos.semQr}>
          <Text style={{ color: cores.dragao, fontWeight: '600' }}>Cupom sem QR Code? Use a foto da chave de acesso</Text>
        </Pressable>
      </Link>

      {permissao?.granted ? (
        <View style={estilos.tela}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }: BarcodeScanningResult) => processar(data)}
          />
          <Text style={estilos.dica}>Aponte para o QR Code no rodapé do cupom</Text>
        </View>
      ) : (
        <View style={estilos.centro}>
          <Text style={estilos.texto}>Para ler o QR Code, o Dragômetro precisa usar a câmera.</Text>
          {permissao && (
            <Pressable style={estilos.botao} onPress={pedirPermissao}>
              <Text style={estilos.botaoTexto}>Permitir câmera</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco(3), gap: espaco(2) },
  colar: { flexDirection: 'row', gap: espaco(1), padding: espaco(2), paddingBottom: espaco(1) },
  semQr: { paddingHorizontal: espaco(2), paddingBottom: espaco(1.5) },
  campo: {
    flex: 1,
    color: cores.texto,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(1),
  },
  dica: {
    position: 'absolute',
    bottom: espaco(6),
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: espaco(1),
    borderRadius: 8,
  },
  aviso: { color: cores.verde, fontWeight: '600' },
  titulo: { color: cores.texto, fontSize: 18, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15, textAlign: 'center' },
  suave: { color: cores.textoSuave, fontSize: 13 },
  item: { backgroundColor: cores.cartao, borderRadius: 8, padding: espaco(1.5) },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center' },
  botaoSecundario: { borderColor: cores.textoSuave, borderWidth: 1, borderRadius: 12, padding: espaco(2), alignItems: 'center' },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
});

/** Produtos diferentes no cupom: a mesma carne pesada várias vezes conta uma vez. */
function produtosDistintos(nota: NotaFiscal): number {
  return new Set(nota.itens.map((i) => i.codigo ?? i.descricao)).size;
}
