# Apuração 2026

App pessoal (Expo + React Native + TypeScript) que acompanha a apuração das Eleições
2026 direto dos arquivos públicos da divulgação do TSE. Não usa backend: o celular
busca os JSON, guarda cache e histórico em SQLite local.

Fonte: TSE (divulgação oficial), `https://resultados.tse.jus.br`.

## Estrutura

```
app/        rotas (Expo Router)
src/tse/    schemas zod, normalização, URLs, resolução de eleições
src/lib/    formatação pt-BR, cores de partido, cálculos
src/api/    cliente HTTP (ETag, limites) e serviço de apuração
src/db/     SQLite: cache HTTP, histórico, ajustes
src/historico/ série do gráfico de evolução (com lacunas)
src/replay/ simulador de apuração (MOCK=replay)
src/segundoPlano/ tarefa em segundo plano
src/ui/     componentes da tela (tema claro/escuro, lista, cabeçalho)
scripts/    fetch-fixtures, build-geo
fixtures/   arquivos REAIS do TSE (1º turno 2026)
docs/       formato dos arquivos do TSE, PDFs de especificação
```

## Rodando

```bash
npm install
cp .env.example .env.local     # ajuste se precisar
npx expo start                 # abra no Expo Go (QR code)
```

Testes e checagens:

```bash
npm test            # vitest: parsers, formatação, URLs, cálculos (fixtures reais)
npm run typecheck
npm run fixtures    # rebaixa as fixtures do TSE (~220 requisições, ~5 req/s)
```

## Coleta (no próprio celular)

- `src/api/http.ts`: cliente com no máximo 1 busca por arquivo a cada 45 s,
  `If-None-Match`/`If-Modified-Since`, cache negativo de 404 (2 min), pausa global
  com backoff em 429/5xx (403 = 10 min) e fallback offline para o último dado salvo.
  Todas as buscas passam por uma fila de no máximo 4 simultâneas e ~8 req/s.
- `src/api/apuracao.ts`: decide o que rebaixar pelo EA14 (Brasil) e pelo EA15 (UF).
  Cada arquivo guarda o marcador da sua abrangência e só é rebaixado quando o
  marcador muda, ou numa checagem condicional a cada 5 min.
- `src/db/sql.ts`: SQLite com o cache HTTP, o histórico de snapshots (só cargos
  majoritários) e os ajustes (códigos manuais, escopos observados).
- `src/historico/serie.ts`: monta a série do gráfico, quebrada em segmentos onde o
  app não observou o TSE.
- `src/segundoPlano/tarefa.ts`: expo-background-task (Android, a cada 15 min ou
  mais, em melhor esforço).

Teste contra o TSE real (cerca de 4 requisições):

```bash
npm run smoke -- 1 1 br      # turno, cargo, uf
```

## Modo replay

Com `EXPO_PUBLIC_MOCK=replay` no `.env.local`, o app reproduz a apuração do 1º turno
sem rede. Usa os arquivos finais reais (`src/replay/dados.json`, gerado por
`npm run build-replay`). Cada UF avança no seu próprio ritmo e o Brasil é a soma
delas, então a curva nacional se mexe como na noite real. Os selos só aparecem
em 100%. A velocidade padrão é `EXPO_PUBLIC_REPLAY_SPEED=20`: 5 h de apuração em
15 min. O replay usa um banco separado (`apuracao-replay.db`).
`EXPO_PUBLIC_REPLAY_INICIO_MIN` faz o replay começar mais tarde: `120` = 19h,
`300` = apuração concluída, com os selos.

Prévia de layout no navegador, sem celular: `npx expo start --web`, de preferência
em modo replay. O `metro.config.js` adiciona os cabeçalhos que o expo-sqlite exige na web.

## Códigos do 2º turno

Nada fica fixo no código. Na inicialização o app lê
`/oficial/comum/config/ele-c.json`:

1. se o pleito do 2º turno já estiver publicado, usa a eleição de turno 2 que tem o cargo;
2. senão, usa o `cdt2` da eleição do 1º turno (hoje: 6257 → **6258**, 6259 → **6260**);
3. a tela de configurações permite sobrescrever o código à mão.

## Limites do TSE

- No máximo 100 req/s por IP, com bloqueio de 10 min. Muitos 404 também bloqueiam.
- URLs de município só são geradas para códigos presentes no `mun-cm.json`.
- Cada arquivo é buscado no máximo uma vez a cada 45–60 s, com `If-None-Match`/`If-Modified-Since`.

Detalhes do formato: [docs/formato-tse.md](docs/formato-tse.md).
