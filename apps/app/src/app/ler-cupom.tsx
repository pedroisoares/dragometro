import type { NotaFiscal } from '@dragometro/sefaz';
import { chaveDoQrCode } from '@dragometro/sefaz';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buscarNota } from '../lib/consulta';
import { cores, espaco } from '../tema';

type Estado =
  | { tipo: 'lendo' }
  | { tipo: 'consultando'; chave: string }
  | { tipo: 'pronto'; nota: NotaFiscal }
  | { tipo: 'erro'; mensagem: string };

export default function LerCupom() {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ tipo: 'lendo' });
  const processando = useRef(false);

  async function aoLerCodigo({ data }: BarcodeScanningResult) {
    if (processando.current) return;
    processando.current = true;
    try {
      const chave = chaveDoQrCode(data);
      setEstado({ tipo: 'consultando', chave: chave.chave });
      setEstado({ tipo: 'pronto', nota: await buscarNota(data) });
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  function lerOutro() {
    processando.current = false;
    setEstado({ tipo: 'lendo' });
  }

  if (!permissao) return <View style={estilos.centro} />;

  if (!permissao.granted) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>Precisamos da câmera para ler o QR Code do cupom.</Text>
        <Pressable style={estilos.botao} onPress={pedirPermissao}>
          <Text style={estilos.botaoTexto}>Permitir câmera</Text>
        </Pressable>
      </View>
    );
  }

  if (estado.tipo === 'lendo') {
    return (
      <View style={estilos.tela}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={aoLerCodigo}
        />
        <Text style={estilos.dica}>Aponte para o QR Code no rodapé do cupom</Text>
      </View>
    );
  }

  if (estado.tipo === 'consultando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.dragao} size="large" />
        <Text style={estilos.texto}>Consultando a SEFAZ...</Text>
        <Text style={estilos.suave}>{estado.chave}</Text>
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

  const { nota } = estado;
  return (
    <FlatList
      contentContainerStyle={{ padding: espaco(2), gap: espaco(1) }}
      data={nota.itens}
      keyExtractor={(_, i) => String(i)}
      ListHeaderComponent={
        <View style={{ marginBottom: espaco(1) }}>
          <Text style={estilos.titulo}>{nota.emitente.nome ?? nota.emitente.cnpj}</Text>
          <Text style={estilos.suave}>
            {nota.dataEmissao ?? ''} · {nota.itens.length} itens · R${' '}
            {nota.valorTotal?.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={estilos.item}>
          <Text style={estilos.texto}>{item.descricao}</Text>
          <Text style={estilos.suave}>
            {item.quantidade} {item.unidade} × R$ {item.valorUnitario.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      )}
      ListFooterComponent={
        <Pressable style={[estilos.botao, { marginTop: espaco(2) }]} onPress={lerOutro}>
          <Text style={estilos.botaoTexto}>Ler outro cupom</Text>
        </Pressable>
      }
    />
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco(3), gap: espaco(2) },
  dica: {
    position: 'absolute',
    bottom: espaco(6),
    alignSelf: 'center',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: espaco(1),
    borderRadius: 8,
  },
  titulo: { color: cores.texto, fontSize: 18, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15, textAlign: 'left' },
  suave: { color: cores.textoSuave, fontSize: 13 },
  item: { backgroundColor: cores.cartao, borderRadius: 8, padding: espaco(1.5) },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center', alignSelf: 'stretch' },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
});
