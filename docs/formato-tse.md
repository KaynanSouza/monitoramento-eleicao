# Formato dos arquivos do TSE (levantado de arquivos reais, 1º turno 2026)

Fonte: arquivos baixados em 06/10/2026 de `https://resultados.tse.jus.br/oficial`
(veja `fixtures/` e `scripts/fetch-fixtures.ts`). Os schemas zod estão em
`src/tse/schemas.ts`. Os PDFs oficiais (EA10–EA20) ficam em `docs/specs/`, mas o
site `www.tse.jus.br` responde 403 para downloads automatizados (Akamai), então
eles precisam ser baixados à mão pelo navegador.

## URLs

| Arquivo | Caminho |
|---|---|
| Eleições (config) | `/{amb}/comum/config/ele-c.json` |
| Municípios (config) | `/{amb}/{ciclo}/{ele}/config/mun-e{ele6}-cm.json` |
| EA14 acompanhamento Brasil | `/{amb}/{ciclo}/{ele}/dados/br/br-e{ele6}-ab.json` |
| EA15 acompanhamento UF | `/{amb}/{ciclo}/{ele}/dados/{uf}/{uf}-e{ele6}-ab.json` |
| EA20 resultado BR/UF | `/{amb}/{ciclo}/{ele}/dados/{uf}/{uf}-c{cargo4}-e{ele6}-u.json` |
| EA20 resultado município | `/{amb}/{ciclo}/{ele}/dados/{uf}/{uf}{mun5}-c{cargo4}-e{ele6}-u.json` |
| Foto do candidato | `/{amb}/{ciclo}/{ele}/fotos/{uf}/{sqcand}.jpeg` |

`ele-c.json` também declara esses diretórios no campo `arq` (`tp`: ft, cm, e, cs, ab, u, aux).
A CDN devolve `ETag`, `Last-Modified` e `Cache-Control: max-age` entre 20 e 60 s.

## Eleições 2026 (`ele-c.json`)

| Código | 2º turno (`cdt2`) | Cargos (`cp[].cd`) |
|---|---|---|
| 6257 Federal | **6258** | 1 Presidente |
| 6259 Estadual | **6260** | 3 Governador, 5 Senador, 6 Dep. Federal, 7 Dep. Estadual, 8 Dep. Distrital |
| 6261 Municipal (DF) | — | 25 Conselheiro Distrital |

Até 06/10 o pleito do 2º turno ainda não aparece em `pl`. O app usa `cdt2` como
código provisório e prefere a eleição de turno 2 assim que ela for publicada
(`src/tse/eleicoes.ts`).

## EA20 (`-u.json`)

- Raiz: `ele`, `t` (turno), `tpabr` (`br`|`uf`|`mu`), `cdabr`, `dg`/`hg` (geração do
  arquivo), `dt`/`ht` (última totalização, horário de Brasília), `tf` (`s`|`n`,
  totalização final), `and` (`f` finalizada | `p` em processamento), `mntf`
  (mensagem opcional, ex.: "Aguarde reprocessamento da eleição").
- `s`: seções. `ts` total, `st` totalizadas, `pst` % ("100,00"), `pstn` com mais casas.
- `e`: eleitorado. `te`, `c` comparecimento, `a` abstenção.
- `v`: votos. `tv`, `vv` válidos, `vb` brancos, `tvn` nulos, `vansj` anulados sub judice, `vl` legenda.
- `carg[]`: `cd`, `nmn`, `nv` (vagas), `qe` (quociente), `fed[]`, `agr[]`, que se desdobra em `par[]` e depois em `cand[]`.
- Candidato: `n` número, `sqcand`, `nm`, `nmu` (nome de urna), `seq` (ordem oficial),
  `dvt` ("Válido", "Anulado sub judice"), `e` (`s` = eleito ou 2º turno),
  `st` (situação), `vap` votos, `pvap` % dos válidos ("47,03"), `pvapn`, `vs[]` (vice e suplentes).
- Valores de `st` observados: `2º turno`, `Eleito`, `Eleito por QP`,
  `Eleito por média`, `Suplente`, `Não eleito` e `""`. O valor fica vazio enquanto `tf = n`.
  O app só mostra selo quando `st` traz uma situação reconhecida.

## EA14/EA15 (`-ab.json`)

`abr[]`: `tpabr` (`br`|`uf`|`mun`), `cdabr`, `and`, `dt`/`ht` (vazios se ainda não
totalizado) e `s` (seções). O EA14 lista as 27 UFs, `zz` (exterior) e o próprio `br`;
o EA15 lista os municípios da UF. Comparar `dt`+`ht` com o que está em cache
indica quais arquivos rebaixar.

## Municípios (`mun-...-cm.json`)

`abr[]`: `cd` (uf, inclui `zz`), `ds`, `mu[]`: `cd` (código TSE, 5 dígitos), `cdi`
(**código IBGE, 7 dígitos**), `nm`, `c` (capital). São 5.571 municípios: inclui
Boa Esperança do Norte/MT (IBGE 5101837), criado em 2024. A malha do IBGE usada no
mapa precisa ser de 2024 ou posterior.

## Ainda não verificado

- **EA10 (eleitos)**: o nome do arquivo não foi confirmado. Por enquanto ele não é
  necessário, porque o `st` do EA20 já traz a situação de cada candidato.
- **EA11, EA12, EA16**: aguardam os PDFs.
