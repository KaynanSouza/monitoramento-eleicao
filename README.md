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

### Problemas comuns

- `[Worklets] Mismatch between JavaScript code version and Worklets Babel plugin version`
  (às vezes junto com `Route "./mapa.tsx" is missing the required default export`):
  o Metro ainda tem em cache arquivos transformados por outra versão do plugin.
  Rode `npx expo start -c`. As versões do Reanimated e do Worklets têm de ser as do
  SDK: use sempre `npx expo install`.

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

## Mapa

- Malha: `npm run build-geo` gera `src/mapa/geo-brasil.json` (1,6 MB, pré-projetado).
  Usa a API de malhas do IBGE (qualidade mínima, 2022) e troca MT pela malha 2024
  do geoftp, que inclui Boa Esperança do Norte. O script valida que 100% dos
  municípios do `mun-cm.json` do TSE casam pelo código IBGE (`cdi`).
- Brasil (Presidente): cada estado na cor do líder, com os 27 arquivos estaduais.
  Os municípios de uma UF são carregados sob demanda quando você toca nela.
  "Carregar mapa completo" baixa todos, devagar (~8 req/s), com barra de progresso.
- Um município só é buscado se o EA15 da UF já o lista como totalizado, para
  evitar uma rajada de 404 antes das 17h.
- Cor: a do partido do líder, mais clara quanto menor a margem (< 5, 5–10,
  10–20, 20–35 e ≥ 35 p.p.). A legenda traz os nomes, não só as cores.
- Mapa completo: pinça para zoom, arraste para mover e toque num município para
  ver o resultado. Os municípios são desenhados em poucas camadas agrupadas por
  cor, para manter o desempenho.

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
3. a tela de configurações (⚙ no topo) permite sobrescrever o código à mão.
   Ela mostra o código automático e a origem dele: publicado no ele-c, provisório
   (cdt2) ou manual.

O app abre no 2º turno assim que o TSE publicar essa eleição no ele-c. No 2º turno,
a tela mostra a disputa com os dois candidatos lado a lado e uma barra dividida.
Para Governador, a lista de estados mostra só as UFs com 2º turno.

No modo replay há um 2º turno **simulado**, para testar essa tela antes de 25/10:
os 2 candidatos que o arquivo real do 1º turno marca como "2º turno", com números
fictícios, sempre com o aviso na tela e nunca com selo "Eleito".

## Limites do TSE

- No máximo 100 req/s por IP, com bloqueio de 10 min. Muitos 404 também bloqueiam.
- URLs de município só são geradas para códigos presentes no `mun-cm.json`.
- Cada arquivo é buscado no máximo uma vez a cada 45–60 s, com `If-None-Match`/`If-Modified-Since`.

Detalhes do formato: [docs/formato-tse.md](docs/formato-tse.md).
