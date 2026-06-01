# Leva+ — Guia de Build como App Nativo (Capacitor)

## O que foi feito

O projeto já é React + Vite + Supabase. Adicionamos o **Capacitor** que empacota esse web app em um app nativo real para **Android** e **iOS**, mantendo 100% das regras, banco e lógica existentes.

---

## Pré-requisitos

### Para Android
- **Java JDK 17+** → https://adoptium.net
- **Android Studio** → https://developer.android.com/studio
  - Instale SDK Android 34+
  - Instale Android Virtual Device (AVD) ou use dispositivo físico via USB

### Para iOS (apenas no Mac)
- **Xcode 15+** → App Store
- **CocoaPods** → `sudo gem install cocoapods`

---

## Passo a Passo — Primeira vez

### 1. Instalar dependências

```bash
npm install
```

### 2. Fazer o build do projeto web

```bash
npm run build
```

Isso gera a pasta `dist/`.

### 3. Inicializar o Capacitor (apenas na primeira vez)

```bash
npx cap init "Leva+" "br.com.levaplus.app" --web-dir dist
```

### 4. Adicionar as plataformas

```bash
# Android
npx cap add android

# iOS (somente no Mac)
npx cap add ios
```

### 5. Sincronizar o código web com as plataformas nativas

```bash
npx cap sync
```

### 6. Abrir no Android Studio / Xcode

```bash
# Android
npm run cap:android

# iOS
npm run cap:ios
```

---

## Fluxo diário de desenvolvimento

Toda vez que fizer alterações no código:

```bash
# Opção 1: Build + sync tudo de uma vez
npm run cap:build

# Opção 2: Passo a passo
npm run build
npx cap sync
```

Para rodar direto no dispositivo/emulador sem abrir IDE:

```bash
npm run cap:run:android
npm run cap:run:ios
```

---

## Testando em modo desenvolvimento (live reload)

Para ver as alterações em tempo real no dispositivo, edite o `capacitor.config.ts` e descomente:

```ts
server: {
  url: 'http://SEU_IP_LOCAL:8080',  // IP da sua máquina
  cleartext: true,
},
```

Depois rode:
```bash
npm run dev
npx cap run android --livereload
```

> **Lembre de comentar de volta antes do build de produção!**

---

## Gerando APK para Android (distribuição)

### APK de debug (para testar)
1. Abra no Android Studio: `npm run cap:android`
2. Menu: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
3. O APK fica em: `android/app/build/outputs/apk/debug/app-debug.apk`

### APK/AAB de produção (para Google Play)
1. No Android Studio: **Build → Generate Signed Bundle/APK**
2. Crie ou use um keystore existente
3. Gere um `.aab` para publicar na Play Store

---

## Publicando na Google Play Store

1. Acesse: https://play.google.com/console
2. Crie o app com **Package name**: `br.com.levaplus.app`
3. Faça upload do `.aab` gerado
4. Preencha descrição, screenshots, ícones
5. Submeta para revisão (1-3 dias úteis)

---

## Publicando na Apple App Store (somente Mac)

1. No Xcode: configure o **Team** (Apple Developer Account)
2. **Product → Archive**
3. Use o **Organizer** para submeter via **App Store Connect**
4. Preencha metadados em https://appstoreconnect.apple.com

---

## Ícones e Splash Screen

Coloque seu ícone em `resources/icon.png` (1024×1024px) e rode:

```bash
npm install @capacitor/assets --save-dev
npx capacitor-assets generate
```

---

## Scripts disponíveis

| Script | O que faz |
|--------|-----------|
| `npm run cap:build` | Build web + sync Capacitor |
| `npm run cap:android` | Build + abre Android Studio |
| `npm run cap:ios` | Build + abre Xcode |
| `npm run cap:run:android` | Roda direto no emulador/device Android |
| `npm run cap:run:ios` | Roda direto no simulador/device iOS |

---

## Estrutura de pastas após setup

```
Leva+/
├── android/          ← Projeto Android Studio (gerado pelo Capacitor)
├── ios/              ← Projeto Xcode (gerado pelo Capacitor)
├── dist/             ← Build web (gerado pelo Vite)
├── src/              ← Código fonte React (não muda)
├── capacitor.config.ts  ← ✅ Configuração do Capacitor
└── package.json      ← ✅ Scripts de build adicionados
```

---

## Dúvidas frequentes

**O app vai funcionar offline?**
Parcialmente — as partes que dependem do Supabase precisam de internet. As telas já em cache podem funcionar offline.

**Preciso reescrever o código React?**
Não. O Capacitor usa seu React exatamente como está.

**Posso usar as mesmas credenciais do Supabase?**
Sim, o `capacitor.config.ts` está configurado com `androidScheme: 'https'`, então o Supabase reconhece as requisições normalmente.

**E as notificações push?**
Adicione `@capacitor/push-notifications` quando quiser. Funciona junto com o sistema atual.
