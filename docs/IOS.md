# Passo a passo: app de iOS sem App Store (distribuição interna / Ad Hoc)

O iPhone não instala arquivos soltos como o APK. Para outras pessoas usarem o app sem
App Store, ele é assinado com uma lista dos iPhones autorizados (UDIDs). Quem estiver
na lista instala por um link. O build é feito na nuvem pelo **EAS**, então não precisa de Mac.

**Limites:** até 100 iPhones por ano na conta Apple. iPhone cadastrado depois do build
só instala depois de um **build novo** (ou de `eas build:resign`).

---

## 1. Preparar (uma vez só)

1. Assine o **Apple Developer Program** (US$ 99/ano): <https://developer.apple.com/programs/enroll/>.
   Em conta nova ou renovada, a liberação pode levar de 24 a 72 h.
2. Faça login na Expo (a mesma conta do `projectId` do `app.json`):

```powershell
npx eas-cli@latest login
```

## 2. Cadastrar os iPhones

```powershell
npx eas-cli@latest device:create
```

Escolha **Website** e mande o link ou o QR code para cada pessoa. Ela abre **no Safari
do iPhone** e instala o perfil que aparece em **Ajustes → Perfil Transferido**. O UDID vai
direto para a sua conta.

Para conferir quem já está cadastrado: `npx eas-cli@latest device:list`.

## 3. Gerar o build de iOS

```powershell
npx eas-cli@latest build --platform ios --profile preview
```

- Na primeira vez, o EAS pede o login da Apple e cria sozinho o certificado e o perfil de
  provisionamento. Responda **Yes** para tudo e marque todos os aparelhos da lista.
- O perfil `preview` (em `eas.json`) gera o app em **modo oficial** (dados do TSE).
- Leva de 15 a 30 min. No fim aparece um link da página do build.

## 4. Instalar nos iPhones

1. Mande o link do build. A pessoa abre **no Safari do iPhone** e toca em **Install**.
2. No iOS 16 ou mais novo, é preciso ligar o **Modo de Desenvolvedor** uma vez:
   **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor → ativar** e reiniciar o iPhone.
   (A opção só aparece depois da primeira tentativa de instalar o app.)

## 5. Nova versão e novos iPhones

- **Nova versão:** aumente `version` no `app.json` e rode o passo 3 de novo. O número do build
  é controlado pelo EAS (`appVersionSource: remote`). A versão nova instala por cima da antiga.
- **iPhone novo:** cadastre (passo 2) e gere outro build (passo 3), ou reassine o último:
  `npx eas-cli@latest build:resign`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Não foi possível instalar" | O iPhone não estava cadastrado quando o build foi feito. Faça um build novo. |
| O app abre e fecha na hora | O Modo de Desenvolvedor está desligado (passo 4.2). |
| O build falha logo depois de cadastrar o aparelho | A conta Apple é nova. Espere até 72 h e tente de novo. |
