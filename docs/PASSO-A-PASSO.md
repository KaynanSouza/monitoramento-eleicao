# Passo a passo: commit, merge na main, APK e instalação no celular

Tudo aqui é gratuito e local: nada de EAS, loja ou servidor. Os comandos são para
o **PowerShell** do Windows, dentro da pasta do projeto.

---

## 1. Commit e merge na `main`

O trabalho está na branch `fase-1-2-fixtures-parsers` (fases 1 a 7 já commitadas
e enviadas ao GitHub). Falta commitar a fase 8 e juntar tudo na `main`.

### 1.1 Commitar a fase 8

```powershell
git status                       # deve mostrar app.json, package.json, package-lock.json,
                                 # scripts/build-apk.mjs, docs/PASSO-A-PASSO.md e README.md
npm test                         # tudo verde antes de commitar
git add app.json package.json package-lock.json scripts/build-apk.mjs docs/PASSO-A-PASSO.md README.md
git commit -m "Fase 8: build local do APK e passo a passo"
git push
```

### 1.2 Merge na `main`

**Opção A, pelo GitHub (recomendada: fica registrado o que entrou):**

1. Abra https://github.com/KaynanSouza/monitoramento-eleicao
2. Clique em **Compare & pull request** da branch `fase-1-2-fixtures-parsers`
   (ou **Pull requests → New pull request**, base `main` ← compare `fase-1-2-fixtures-parsers`).
3. Confira os arquivos e clique em **Create pull request**.
4. Clique em **Merge pull request** e depois em **Confirm merge**.
5. No computador, atualize a `main` local:

```powershell
git switch main
git pull origin main
```

Com o GitHub CLI (`gh`) instalado, os passos 2 a 4 viram:

```powershell
gh pr create --base main --head fase-1-2-fixtures-parsers --title "App de apuração 2026 (fases 1–8)" --fill
gh pr merge --merge
git switch main
git pull origin main
```

**Opção B, só pelo terminal:**

```powershell
git switch main
git pull origin main
git merge --no-ff fase-1-2-fixtures-parsers -m "Merge: app de apuração 2026 (fases 1–8)"
npm install
npm test                         # conferir na main antes de enviar
git push origin main
```

**Depois do merge (opcional):** apagar a branch.

```powershell
git branch -d fase-1-2-fixtures-parsers
git push origin --delete fase-1-2-fixtures-parsers
```

---

## 2. Preparar o computador (uma vez só)

O APK é compilado localmente pelo Gradle. Para isso o Windows precisa de:

### 2.1 JDK 17

Baixe e instale um destes (instalador `.msi`):

- Microsoft Build of OpenJDK 17: https://learn.microsoft.com/java/openjdk/download
- Eclipse Temurin 17: https://adoptium.net/temurin/releases/?version=17

No instalador, marque a opção **Set JAVA_HOME variable** (ou "Definir JAVA_HOME").

### 2.2 Android Studio (traz o Android SDK)

1. Baixe em https://developer.android.com/studio e instale.
2. Abra o Android Studio uma vez e siga o assistente com **Standard**. Ele baixa o
   Android SDK, o Platform-Tools (`adb`) e o Build-Tools, e pede para aceitar as licenças.
3. Pode fechar o Android Studio depois disso. O build é feito pelo terminal.

### 2.3 Variáveis de ambiente

No PowerShell (não precisa ser administrador):

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
$pt = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ";$pt", 'User')
```

**Feche e abra o terminal** (e o VS Code) para valer, e confira:

```powershell
java -version        # deve mostrar 17
echo $env:ANDROID_HOME
adb --version
```

---

## 3. Gerar o APK

```powershell
npm install
npm test
npm run apk
```

- A primeira vez demora entre 15 e 30 min: o Gradle baixa dependências (NDK, CMake etc.).
  As próximas são bem mais rápidas.
- No fim aparece: `✔ APK pronto: ...\dist\apuracao-2026-v1.0.0.apk`.
- O APK sai sempre em **modo oficial** (dados do TSE), mesmo que o `.env.local`
  esteja em replay.
- Por padrão o APK é só para **arm64**, o processador de praticamente todo celular
  Android atual. Se a instalação disser que o app não é compatível, gere o universal:
  `npm run apk -- --todas-arquiteturas`.
- Para um APK de teste em modo replay: `npm run apk -- --replay` (gera `...-replay.apk`).

**Nova versão do app:** antes de gerar, aumente `version` e `android.versionCode` no
`app.json` (ex.: `1.0.1` e `2`). O APK é sempre assinado com a mesma chave, então a
versão nova instala por cima da antiga **sem perder o histórico** gravado.

---

## 4. Passar o APK para o celular

Escolha um dos caminhos. Em todos, na primeira vez o Android vai pedir para
**permitir a instalação de apps desconhecidos** pelo app usado para abrir o arquivo
(Arquivos, Chrome, Drive…). Permita só para esse app.

### Opção 1: cabo USB, copiando o arquivo (mais simples)

1. Ligue o celular no PC pelo cabo e, no aviso do celular, escolha
   **Transferência de arquivos**.
2. No Explorador de Arquivos do Windows, abra o celular e copie
   `dist\apuracao-2026-v1.0.0.apk` para a pasta **Download**.
3. No celular, abra o app **Arquivos** (ou "Meus arquivos") → **Downloads** →
   toque no APK → **Instalar**.

### Opção 2: cabo USB com `adb` (instala direto, bom para reinstalar várias vezes)

1. No celular, ative o modo desenvolvedor: **Configurações → Sobre o telefone** →
   toque 7 vezes em **Número da versão**.
2. Em **Configurações → Sistema → Opções do desenvolvedor**, ative **Depuração USB**.
3. Ligue o cabo e aceite o aviso "Permitir depuração USB?" no celular.
4. No PC:

```powershell
adb devices                                        # o celular deve aparecer como "device"
adb install -r dist\apuracao-2026-v1.0.0.apk       # -r: atualiza mantendo os dados
```

### Opção 3: sem cabo, pela nuvem ou por mensagem para você mesmo

Envie o APK para o Google Drive, por e-mail para você ou para as "Mensagens
salvas" do Telegram. No celular, baixe e toque no arquivo para instalar.
(O WhatsApp às vezes bloqueia `.apk`.)

### Opção 4: sem cabo, pela rede Wi-Fi de casa

Com o PC e o celular na mesma rede:

```powershell
ipconfig                         # anote o "Endereço IPv4", ex.: 192.168.0.15
npx serve dist                   # serve a pasta dist na porta 3000
```

No navegador do celular, abra `http://192.168.0.15:3000` (com o seu IP), toque no
APK para baixar e depois abra o arquivo baixado. Feche o `serve` com Ctrl+C no fim.

### Aviso do Play Protect

Como o app não vem da Play Store, o Google Play Protect pode avisar
"App bloqueado" ou "app desconhecido". Toque em **Mais detalhes → Instalar mesmo
assim**. É esperado para um APK que você mesmo gerou.

---

## 5. Checklist para 25/10 (2º turno, divulgação a partir das 17h)

- [ ] Até a véspera: abra o app, toque em ⚙ e confira os códigos do 2º turno
      (Presidente **6258**, Governador **6260**). O ideal é aparecer "publicado no
      ele-c.json"; "provisório (cdt2)" também funciona.
- [ ] No celular: **Configurações → Apps → Apuração 2026 → Bateria → Sem restrições**.
      Assim a atualização em segundo plano (de 15 em 15 min, no mínimo) tem mais chance de rodar.
- [ ] Às **16h50**: abra o app no 2º turno, ligado no carregador. O gráfico de evolução
      só é gravado com o app aberto, e a tela fica ligada sozinha enquanto a apuração
      está em andamento.
- [ ] Wi-Fi ou 4G estável. Se cair, o app mostra o último dado e o horário em que foi
      conferido no TSE.
- [ ] O mapa completo (todos os municípios) leva uns 12 minutos para carregar por
      inteiro. Pode deixar carregando.

---

## 6. Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `Android SDK não encontrado` / `SDK location not found` | Refaça a seção 2.3 e **abra um terminal novo**. |
| `Java não encontrado` ou erro de versão do Java | Instale o JDK 17 e confira `java -version`. Se houver outra versão no PATH, ajuste o `JAVA_HOME`. |
| `Filename longer than 260 characters` / erro do CMake com caminho longo | Copie o projeto para um caminho curto (ex.: `C:\dev\apuracao`) ou ative caminhos longos no Windows (PowerShell **como administrador**): `New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force` e reinicie. |
| `spawn UNKNOWN` ao gerar o bytecode Hermes | O antivírus bloqueou o `hermesc.exe` em `node_modules\hermes-compiler`. Libere a pasta do projeto no Windows Defender. |
| Gradle sem memória (`OutOfMemoryError`) | Feche outros programas e rode de novo. Se persistir, em `android\gradle.properties` aumente `org.gradle.jvmargs=-Xmx4096m`. |
| `App não instalado` ao atualizar | O APK antigo foi assinado com outra chave (por exemplo, gerado em outro PC). Desinstale o app e instale de novo; o histórico gravado se perde. |
| `[Worklets] Mismatch ...` no Expo Go | `npx expo start -c` (limpa o cache do Metro). |

Para desenvolver continua valendo o Expo Go: `npx expo start` e ler o QR code.
O APK é só para o uso no dia.
