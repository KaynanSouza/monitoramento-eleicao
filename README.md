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
src/api/    cliente HTTP (ETag, limites, cache)          [fase 3]
src/db/     SQLite: cache e histórico de snapshots       [fase 3]
src/ui/     componentes                                  [fase 4+]
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

`EXPO_PUBLIC_MOCK=replay` reproduz uma apuração a partir de `fixtures/` sem acessar o TSE.

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
