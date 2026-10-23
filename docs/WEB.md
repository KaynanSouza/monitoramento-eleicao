# Passo a passo: versão web (iPhone sem App Store, de graça)

O mesmo app roda no navegador. No iPhone, a pessoa abre o link no **Safari** e, se quiser,
instala na tela inicial: **Compartilhar → Adicionar à Tela de Início**. O app abre em tela
cheia, com ícone próprio. Não precisa de conta Apple, UDID nem build de iOS.

A hospedagem é gratuita em qualquer uma das duas opções abaixo. **Recomendado: Cloudflare Pages.**
O plano grátis não limita tráfego e permite uso comercial. O plano Hobby da Vercel é só para
uso pessoal e não comercial, e limita o tráfego.

---

## Como funciona (o que já está pronto no projeto)

- `npm run web` gera o site estático em `dist/` (`npx expo export -p web`).
- O app busca os dados **direto do TSE pelo navegador**. O servidor do TSE libera CORS, então
  não precisa de servidor intermediário.
- O banco local (expo-sqlite) usa `SharedArrayBuffer`, que exige dois cabeçalhos HTTP.
  Eles já estão configurados em `public/_headers` (Cloudflare) e `vercel.json` (Vercel):
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`. **Não troque por `credentialless`**: o
    Safari do iPhone não aceita esse valor, e o app ficaria sem banco.
- Com `require-corp`, as fotos dos candidatos são carregadas com CORS (`src/ui/Foto.web.tsx`).
- `public/index.html` e `public/manifest.json` definem o nome e o ícone na tela inicial.

## Opção A: Cloudflare Pages (recomendada)

### Pelo GitHub (publica sozinho a cada `git push`)

1. Envie o código para o GitHub (o repositório já está lá).
2. Crie uma conta grátis em <https://dash.cloudflare.com/sign-up>.
3. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
4. Configure o build:
   - **Framework preset:** None
   - **Build command:** `npx expo export -p web`
   - **Build output directory:** `dist`
   - **Environment variables:** `NODE_VERSION` = `22`
5. **Save and Deploy.** Em poucos minutos o site fica em `https://<nome>.pages.dev`.

### Pelo computador (sem GitHub)

```powershell
npm run web
npx wrangler@latest login
npx wrangler@latest pages deploy dist --project-name apuracao-2026
```

Para publicar uma nova versão, rode de novo `npm run web` e o `pages deploy`.

## Opção B: Vercel

### Pelo GitHub

1. Crie uma conta grátis em <https://vercel.com/signup> (plano **Hobby**) entrando com o GitHub.
2. **Add New → Project** e importe o repositório. O `vercel.json` já define o build
   (`npx expo export -p web`), a pasta `dist` e os cabeçalhos. É só clicar em **Deploy**.
3. O site fica em `https://<nome>.vercel.app`.

### Pelo computador

```powershell
npx vercel@latest          # primeira vez: login e criação do projeto
npx vercel@latest --prod   # publica em produção
```

## Testar no computador antes de publicar

```powershell
npx expo start --web
```

O servidor de desenvolvimento já envia os mesmos cabeçalhos (`metro.config.js`).

## Diferenças em relação ao app Android

| Recurso | Android | Web / iPhone |
|---|---|---|
| Resultados, gráfico, mapa, fotos | Sim | Sim |
| Histórico salvo no aparelho | Sim | Sim (fica no navegador; some se a pessoa apagar os dados do site) |
| Atualizar com o app fechado | Sim (a cada ~15 min) | Não. Só atualiza com a página aberta |
| Tela sempre acesa | Sim | Sim, se o navegador permitir |

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tela em branco ou erro de banco no iPhone | Faltam os cabeçalhos COOP/COEP ou foi usado `credentialless`. Confira `public/_headers` ou `vercel.json`. |
| Fotos viram iniciais | Alguma imagem de outro domínio foi carregada sem `crossOrigin`. Use o componente `Foto`. |
| Site antigo depois de publicar | Cache do navegador. Recarregue a página (ou feche e abra o app da tela inicial). |
