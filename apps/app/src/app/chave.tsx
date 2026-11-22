import { salvarCupomFoto, salvarNota, type ResultadoSalvar } from '@dragometro/armazenamento';
import { lerCupomDoTexto, type CupomFoto } from '@dragometro/foto';
import {
  chaveValida,
  chavesNoTexto,
  digitosProvaveisDaChave,
  lerChave,
  lerNotaDaPagina,
  urlConsultaPorChave,
} from '@dragometro/sefaz';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dataCurta, reais } from '../lib/formato';
import { motorOcr } from '../lib/ocr';
import { PaginaSefazVisivel } from '../lib/PaginaSefazVisivel';
import { RevisarCupom } from '../lib/RevisarCupom';
import { cores, espaco } from '../tema';

type Estado =
  | { tipo: 'escolher' }
  | { tipo: 'lendo-foto' }
  | { tipo: 'confirmar'; digitos: string; textoOcr: string; aviso?: string }
  | { tipo: 'sefaz'; chave: string; url: string }
  | { tipo: 'revisar'; cupom: CupomFoto; textoOcr: string; fotoUri?: string }
  | { tipo: 'pronto'; loja: string; data?: string; itens: number; total?: number; resultado: ResultadoSalvar }
  | { tipo: 'erro'; mensagem: string };

/**
 * Cupom sem QR Code legível. Pela foto (OCR):
 * - se achar a chave de acesso, consulta a nota na SEFAZ (a pessoa resolve o captcha);
 * - se o cupom não tiver chave, lê os itens da foto e mostra para a pessoa conferir antes de salvar.
 */
export default function LerPelaChave() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<Estado>({ tipo: 'escolher' });

  async function usarFoto(origem: 'camera' | 'galeria') {
    const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, base64: true };
    if (origem === 'camera') {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        setEstado({ tipo: 'erro', mensagem: 'Sem permissão para usar a câmera.' });
        return;
      }
    }
    const resultado =
      origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
    const foto = resultado.canceled ? undefined : resultado.assets[0];
    const base64 = foto?.base64;
    if (!base64) return;

    setEstado({ tipo: 'lendo-foto' });
    try {
      const texto = await motorOcr.reconhecer({ base64 });
      const [chave] = chavesNoTexto(texto);
      const cupom = lerCupomDoTexto(texto);
      if (chave) {
        setEstado({ tipo: 'confirmar', digitos: chave.chave, textoOcr: texto });
      } else if (cupom.itens.length > 0) {
        // Sem chave: lê os itens da foto, para conferir.
        setEstado({ tipo: 'revisar', cupom, textoOcr: texto, fotoUri: foto.uri });
      } else {
        setEstado({
          tipo: 'confirmar',
          digitos: digitosProvaveisDaChave(texto) ?? '',
          textoOcr: texto,
          aviso:
            'Não consegui ler a chave inteira. Confira os números com o cupom e corrija o que faltar ' +
            '(ou tire outra foto, mais de perto e com boa luz).',
        });
      }
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  async function aoReceberHtml(html: string, chave: string) {
    try {
      const nota = lerNotaDaPagina(html, chave);
      const resultado = await salvarNota(db, nota);
      setEstado({
        tipo: 'pronto',
        loja: nota.emitente.nome ?? nota.emitente.cnpj,
        ...(nota.dataEmissao ? { data: nota.dataEmissao } : {}),
        itens: nota.itens.length,
        ...(nota.valorTotal !== undefined ? { total: nota.valorTotal } : {}),
        resultado,
      });
    } catch (e) {
      setEstado({ tipo: 'erro', mensagem: e instanceof Error ? e.message : String(e) });
    }
  }

  if (estado.tipo === 'lendo-foto') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.dragao} size="large" />
        <Text style={estilos.texto}>Lendo a foto...</Text>
        <Text style={estilos.suave}>Na primeira foto pode levar alguns segundos a mais.</Text>
      </View>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <View style={estilos.centro}>
        <Text style={[estilos.texto, { color: cores.vermelho }]}>{estado.mensagem}</Text>
        <Botao texto="Tentar de novo" onPress={() => setEstado({ tipo: 'escolher' })} />
      </View>
    );
  }

  if (estado.tipo === 'sefaz') {
    return (
      <View style={{ flex: 1 }}>
        <View style={estilos.faixa}>
          <Text style={estilos.texto}>
            A chave já está preenchida. Digite os caracteres da imagem e toque em Consultar.
          </Text>
          <Pressable onPress={() => setEstado({ tipo: 'escolher' })} hitSlop={8}>
            <Text style={{ color: cores.textoSuave }}>Cancelar</Text>
          </Pressable>
        </View>
        <PaginaSefazVisivel
          url={estado.url}
          chave={estado.chave}
          aoReceberHtml={(html) => aoReceberHtml(html, estado.chave)}
          aoFalhar={(e) => setEstado({ tipo: 'erro', mensagem: e.message })}
        />
      </View>
    );
  }

  if (estado.tipo === 'revisar') {
    const { textoOcr } = estado;
    return (
      <RevisarCupom
        cupom={estado.cupom}
        {...(estado.fotoUri ? { fotoUri: estado.fotoUri } : {})}
        aoDigitarChave={() => setEstado({ tipo: 'confirmar', digitos: digitosProvaveisDaChave(textoOcr) ?? '', textoOcr })}
        aoSalvar={async (cupom) => {
          const resultado = await salvarCupomFoto(db, cupom);
          setEstado({
            tipo: 'pronto',
            loja: cupom.loja.nome,
            data: cupom.dataEmissao,
            itens: cupom.itens.length,
            ...(cupom.valorTotal !== undefined ? { total: cupom.valorTotal } : {}),
            resultado,
          });
        }}
      />
    );
  }

  if (estado.tipo === 'pronto') {
    const { resultado } = estado;
    return (
      <View style={estilos.centro}>
        <Text style={[estilos.titulo, { color: resultado === 'nova' ? cores.verde : cores.textoSuave }]}>
          {resultado === 'nova' ? '✓ Cupom salvo nas suas compras' : 'Este cupom já estava salvo'}
        </Text>
        <Text style={estilos.texto}>{estado.loja}</Text>
        <Text style={estilos.suave}>
          {estado.data ? `${dataCurta(estado.data)} · ` : ''}
          {estado.itens} itens
          {estado.total !== undefined ? ` · ${reais(estado.total)}` : ''}
        </Text>
        <Botao texto="Ler outro cupom" onPress={() => setEstado({ tipo: 'escolher' })} />
        <Link href="/produtos" asChild>
          <Pressable style={estilos.botaoSecundario}>
            <Text style={estilos.texto}>Ver meus produtos</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (estado.tipo === 'confirmar') {
    return <ConfirmarChave estado={estado} aoMudar={setEstado} />;
  }

  // Escolher: foto ou digitação
  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Text style={estilos.titulo}>Cupom sem QR Code?</Text>
      <Text style={estilos.texto}>
        Tire uma foto do cupom inteiro. Se ele tiver a <Text style={{ fontWeight: '700' }}>chave de acesso</Text> (44
        números, em grupos de 4, perto do rodapé), o app consulta a nota na SEFAZ. Se não tiver, o app lê os itens da
        foto e você confere antes de salvar.
      </Text>
      {Platform.OS !== 'web' && <Botao texto="Tirar foto do cupom" onPress={() => usarFoto('camera')} />}
      <Botao
        texto={Platform.OS === 'web' ? 'Escolher foto do cupom' : 'Escolher foto da galeria'}
        onPress={() => usarFoto('galeria')}
        secundario={Platform.OS !== 'web'}
      />
      <Botao
        texto="Digitar a chave"
        secundario
        onPress={() => setEstado({ tipo: 'confirmar', digitos: '', textoOcr: '' })}
      />
      <Text style={estilos.suave}>
        Dica: cupom esticado, foto de cima, com boa luz e sem cortar as bordas. Vale foto recebida pelo WhatsApp.
      </Text>
    </ScrollView>
  );
}

function ConfirmarChave({
  estado,
  aoMudar,
}: {
  estado: Extract<Estado, { tipo: 'confirmar' }>;
  aoMudar: (e: Estado) => void;
}) {
  const [digitos, setDigitos] = useState(estado.digitos);
  const somenteDigitos = digitos.replace(/\D/g, '');
  const valida = chaveValida(somenteDigitos);
  const chave = valida ? lerChave(somenteDigitos) : undefined;
  const url = chave ? urlConsultaPorChave(chave, estado.textoOcr) : undefined;

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Text style={estilos.titulo}>Confira a chave de acesso</Text>
      {estado.aviso && <Text style={[estilos.texto, { color: cores.dragao }]}>{estado.aviso}</Text>}
      <TextInput
        style={estilos.campo}
        value={agrupar(somenteDigitos)}
        onChangeText={(t) => setDigitos(t.replace(/\D/g, '').slice(0, 44))}
        keyboardType="number-pad"
        placeholder="0000 0000 0000 ..."
        placeholderTextColor={cores.textoSuave}
        multiline
      />
      <Text style={[estilos.suave, valida && { color: cores.verde }]}>
        {valida
          ? `✓ Chave válida · ${chave!.uf} · ${chave!.anoMes.split('-').reverse().join('/')} · nota ${Number(chave!.numero)}`
          : `${somenteDigitos.length} de 44 números${somenteDigitos.length === 44 ? ' — algum número não confere; compare com o cupom' : ''}`}
      </Text>

      {valida && url && Platform.OS !== 'web' && (
        <Botao texto="Consultar na SEFAZ" onPress={() => aoMudar({ tipo: 'sefaz', chave: chave!.chave, url })} />
      )}

      {valida && url && Platform.OS === 'web' && (
        <View style={{ gap: espaco(1) }}>
          <Text style={estilos.texto}>
            A consulta pela chave pede um captcha numa página que a versão Web não consegue ler. Pelo celular, o app faz
            isso sozinho. No computador, você pode consultar no site da SEFAZ:
          </Text>
          <Botao texto="Copiar a chave" secundario onPress={() => Clipboard.setStringAsync(chave!.chave)} />
          <Botao texto="Abrir o site da SEFAZ" onPress={() => Linking.openURL(url)} />
        </View>
      )}

      {valida && !url && (
        <Text style={estilos.texto}>
          Ainda não sabemos o endereço de consulta da SEFAZ de {chave!.uf}. Ele costuma estar impresso no cupom, logo
          acima da chave. Ajude o projeto a incluir o seu estado (veja CONTRIBUTING.md).
        </Text>
      )}

      <Botao texto="Voltar" secundario onPress={() => aoMudar({ tipo: 'escolher' })} />
    </ScrollView>
  );
}

function agrupar(digitos: string): string {
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function Botao({ texto, onPress, secundario }: { texto: string; onPress: () => void; secundario?: boolean }) {
  return (
    <Pressable style={secundario ? estilos.botaoSecundario : estilos.botao} onPress={onPress}>
      <Text style={secundario ? estilos.texto : estilos.botaoTexto}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espaco(3), gap: espaco(2) },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco(3), gap: espaco(2) },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), padding: espaco(1.5), backgroundColor: cores.cartao },
  titulo: { color: cores.texto, fontSize: 20, fontWeight: '700' },
  texto: { color: cores.texto, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  suave: { color: cores.textoSuave, fontSize: 13 },
  campo: {
    color: cores.texto,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: espaco(1.5),
    minHeight: 96,
    textAlignVertical: 'top',
    fontSize: 18,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  botao: { backgroundColor: cores.dragao, borderRadius: 12, padding: espaco(2), alignItems: 'center', alignSelf: 'stretch' },
  botaoSecundario: {
    borderColor: cores.textoSuave,
    borderWidth: 1,
    borderRadius: 12,
    padding: espaco(2),
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  botaoTexto: { color: cores.fundo, fontWeight: '700', fontSize: 16 },
});
