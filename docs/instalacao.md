# Como instalar e testar o Dragômetro 🐉

Este guia tem três caminhos. Escolha o seu:

| Você quer... | Vá para |
|---|---|
| **Só usar o app** para medir a sua inflação | [Para quem vai usar](#para-quem-vai-usar) |
| **Testar no computador**, pelo navegador | [Versão Web (computador)](#versão-web-computador) |
| **Testar no seu celular** enquanto desenvolve | [Versão celular (Android e iPhone)](#versão-celular-android-e-iphone) |

Quem vai contribuir com código faz a [preparação](#preparação-uma-vez-só) uma vez e depois usa a versão Web, a de celular ou as duas.

---

## Para quem vai usar

O Dragômetro **ainda não está nas lojas de aplicativos nem publicado na internet**. Enquanto isso, existem dois jeitos de experimentar:

- **Pedir para alguém do projeto** abrir o app no seu celular pelo Expo Go (veja a [versão celular](#versão-celular-android-e-iphone)). O computador dessa pessoa precisa estar ligado e na mesma rede Wi-Fi.
- **Instalar você mesmo** seguindo este guia. Não precisa saber programar: é copiar e colar alguns comandos.

Quando o app estiver na Play Store, na App Store e em dragometro.com.br, este trecho vai ser atualizado com os links.

---

## Preparação (uma vez só)

### 1. Instale os programas necessários

| Programa | Para quê | Onde baixar |
|---|---|---|
| **Git** | Baixar o código | https://git-scm.com/downloads |
| **Node.js 22 (LTS)** | Rodar o projeto | https://nodejs.org (versão LTS 22) |
| **pnpm 10** | Instalar as dependências | instalado pelo próprio Node, no passo 2 |

> **Windows:** depois de instalar, feche e abra de novo o terminal (PowerShell ou Prompt de Comando).

### 2. Ative o pnpm

Abra um terminal e rode:

```bash
corepack enable
```

Se aparecer erro de permissão:

- **Windows:** abra o terminal como Administrador e rode de novo.
- **Mac/Linux:** use `sudo corepack enable`.
- Se ainda assim não funcionar: `npm install -g pnpm@10`

Confira se deu certo (deve aparecer um número começando com 10):

```bash
pnpm --version
```

### 3. Baixe o código e instale as dependências

Escolha uma pasta (por exemplo, `Documentos`) e rode:

```bash
git clone https://github.com/pedroisoares/dragometro.git
cd dragometro
pnpm install
```

Pronto. A partir daqui, **todos os comandos são rodados dentro da pasta `dragometro`**, a pasta principal do projeto.

Como o projeto está organizado:

```
dragometro/            ← rode os comandos aqui
├─ apps/
│  ├─ app/             o aplicativo (celular e Web)
│  └─ api/             o servidor de apoio (usado pela versão Web)
├─ packages/           cálculo, leitura dos cupons, IBGE e banco local
└─ docs/               este guia e a metodologia
```

---

## Versão Web (computador)

Na versão Web, o navegador não consegue consultar a SEFAZ direto (é uma regra de segurança dos navegadores). Por isso ela precisa da **API** rodando ao lado. São **dois terminais abertos ao mesmo tempo**.

### 1. Configure o endereço da API (uma vez só)

Na pasta `dragometro`, copie o arquivo de exemplo:

- **Mac/Linux:**

  ```bash
  cp apps/app/.env.example apps/app/.env
  ```

- **Windows (PowerShell):**

  ```powershell
  Copy-Item apps\app\.env.example apps\app\.env
  ```

### 2. Terminal 1: ligue a API

```bash
pnpm api
```

Deixe esse terminal aberto. Quando aparecer `Server listening at http://...:3333`, a API está no ar.

### 3. Terminal 2: abra o app no navegador

Abra **outro** terminal, entre na pasta `dragometro` e rode:

```bash
pnpm web
```

O navegador abre sozinho em **http://localhost:8081**. Se não abrir, digite esse endereço no navegador.

### 4. Leia um cupom

1. Clique em **Ler QR Code do cupom**.
2. No campo **"ou cole aqui o link do QR Code"**, cole o link do cupom. Para conseguir o link, leia o QR Code com a câmera do celular e copie o endereço que ele abrir.
3. Clique em **Ler**.

Os cupons ficam guardados **naquele navegador**. Outro navegador ou janela anônima começa vazio.

Para desligar tudo: **Ctrl+C** em cada terminal.

---

## Versão celular (Android e iPhone)

No celular, o app consulta a SEFAZ direto do aparelho, então **não precisa da API**. Usamos o **Expo Go**, um app gratuito que abre o Dragômetro enquanto ele roda no seu computador.

### 1. Instale o Expo Go no celular

- **Android:** Play Store → procure **Expo Go**
- **iPhone:** App Store → procure **Expo Go**

### 2. Ligue o app no computador

Na pasta `dragometro`:

```bash
pnpm app
```

Vai aparecer um **QR Code no terminal**.

### 3. Abra no celular

O celular e o computador precisam estar **na mesma rede Wi-Fi**.

- **Android:** abra o Expo Go e toque em **Scan QR code**. Aponte para o QR Code do terminal.
- **iPhone:** abra o app **Câmera** e aponte para o QR Code do terminal. Toque no aviso que aparecer para abrir no Expo Go.

### 4. Leia um cupom

Toque em **Ler QR Code do cupom**, permita o uso da câmera e aponte para o QR Code no rodapé do cupom fiscal.

Os cupons ficam guardados **no celular**.

> **Android:** use o leitor **de dentro do Expo Go**. A câmera comum do Android e o Google Lens não sabem abrir esse QR Code e mostram "Não há aplicativos no seu celular que possam usar as informações desse QR Code".
>
> **Plano B:** no Expo Go, toque em **Enter URL manually** e digite o endereço que aparece no terminal logo acima do QR Code, por exemplo `exp://172.16.3.152:8081`.

> **Atenção:** este QR Code do terminal é o do **app**, e o do rodapé do cupom é o da **nota fiscal**. Não confunda os dois. 🙂

### O QR Code mostra o endereço errado?

Se o computador tem mais de uma rede (cabo e Wi-Fi, VPN, máquina virtual, Docker...), o Expo pode escolher o endereço errado para o QR Code. Descubra o endereço certo do computador:

- **Windows:** rode `ipconfig` e procure o "Endereço IPv4" da rede em que o celular também está.
- **Mac:** Ajustes do Sistema → Rede. **Linux:** `hostname -I`.

Depois informe esse endereço ao Expo antes de rodar o app (troque `172.16.3.152` pelo seu):

- **Windows (PowerShell):**

  ```powershell
  $env:REACT_NATIVE_PACKAGER_HOSTNAME="172.16.3.152"; pnpm app
  ```

- **Mac/Linux:**

  ```bash
  REACT_NATIVE_PACKAGER_HOSTNAME=172.16.3.152 pnpm app
  ```

O QR Code passa a usar o endereço informado. No Windows, se o celular ainda não conectar, libere o Node.js no Firewall do Windows para redes privadas. A primeira vez que o Expo roda, o Windows costuma perguntar. Se você negou, ajuste em "Permitir um aplicativo pelo Firewall".

### Não conectou?

Se o celular não estiver na mesma rede, ou se a rede bloquear a conexão (comum em redes de empresa), use o modo túnel:

```bash
pnpm --filter @dragometro/app start --tunnel
```

Na primeira vez, o Expo pode pedir para instalar um complemento. Responda **Y**.

---

## Computador ou celular: qual a diferença?

| | **Web (computador)** | **Celular (Expo Go)** |
|---|---|---|
| Comando | `pnpm api` + `pnpm web` (2 terminais) | `pnpm app` |
| Precisa da API? | **Sim** | Não |
| Como ler o cupom | Colando o link do QR Code (ou webcam) | Câmera do celular |
| Onde ficam os cupons | No navegador | No celular |
| Endereço | http://localhost:8081 | QR Code no terminal |

---

## Para quem vai contribuir

Antes de abrir um pull request, rode na pasta `dragometro`:

```bash
pnpm test        # roda os testes de todos os pacotes
pnpm typecheck   # confere os tipos do TypeScript
```

Os dois precisam passar. Depois leia o [CONTRIBUTING.md](../CONTRIBUTING.md). A contribuição mais valiosa agora é validar a leitura dos cupons do **seu estado**.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `pnpm: command not found` ou `'pnpm' não é reconhecido` | Refaça o [passo 2 da preparação](#2-ative-o-pnpm) e abra um terminal novo. |
| Erro dizendo que o Node é antigo | Instale o Node.js 22 LTS e confira com `node --version`. |
| Na Web: "Na versão Web é preciso configurar EXPO_PUBLIC_API_URL" | Falta o arquivo `apps/app/.env` ([passo 1 da Web](#1-configure-o-endereço-da-api-uma-vez-só)). Depois de criar, pare o `pnpm web` (Ctrl+C) e rode de novo. |
| Na Web: "A API respondeu..." ou erro ao ler o cupom | Confira se o `pnpm api` está rodando no outro terminal. |
| "Não foi possível buscar o IPCA agora" | O site do IBGE não respondeu. Tente mais tarde. Não afeta a leitura dos cupons. |
| "Não há aplicativos no seu celular que possam usar as informações desse QR Code" | O Expo Go não está instalado, ou (Android) o QR foi lido pela câmera comum. Abra o **Expo Go** e use o leitor dele, ou digite o endereço `exp://...` em **Enter URL manually**. |
| O celular não abre o app | Mesma rede Wi-Fi? Confira se o [endereço do QR Code](#o-qr-code-mostra-o-endereço-errado) é o do seu computador. Se nada resolver, tente o [modo túnel](#não-conectou). |
| No Expo Go: "Failed to download remote update" | O celular não está alcançando o computador. Com o `pnpm app` rodando, abra no **navegador do celular** `http://IP-DO-COMPUTADOR:8081`. Se abrir alguma coisa, esse IP funciona: use-o no QR Code. Se não abrir, libere o Node.js no Firewall e confira se a rede do Windows está como **Privada**. |
| No navegador do celular: "Abra pelo endereço localhost" | Normal: a versão Web só guarda dados em `localhost` ou `https`. Isso mostra que o celular **alcança** o computador; para usar no celular, abra pelo Expo Go. |
| "SEFAZ respondeu..." ou "Nenhum item encontrado" | Pode ser o portal da SEFAZ do seu estado fora do ar ou com outro formato de página. [Abra uma issue](https://github.com/pedroisoares/dragometro/issues) contando o estado. Não cole o link do cupom na issue: ele dá acesso aos seus dados. |
