/**
 * Gera o APK de uso pessoal localmente (sem EAS, sem serviço pago).
 *
 *   npm run apk                        → dist/apuracao-2026-v<versão>.apk (arm64, modo oficial)
 *   npm run apk -- --todas-arquiteturas → APK universal (maior, roda em qualquer Android)
 *   npm run apk -- --replay            → APK em modo replay (só para testes)
 *
 * Requisitos: JDK 17 e Android SDK (Android Studio). Veja docs/PASSO-A-PASSO.md.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const windows = process.platform === 'win32';

function falhar(msg) {
  console.error(`\n✖ ${msg}\n  Veja docs/PASSO-A-PASSO.md, seção "Preparar o computador".\n`);
  process.exit(1);
}

function executar(cmd, cmdArgs, opcoes = {}) {
  console.log(`\n› ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: windows, ...opcoes });
  if (r.status !== 0) falhar(`Falhou: ${cmd} ${cmdArgs.join(' ')}`);
}

// 1. Ambiente
const env = { ...process.env };
const sdkPadrao = windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(process.env.HOME ?? '', 'Android', 'Sdk');
env.ANDROID_HOME ??= env.ANDROID_SDK_ROOT ?? (existsSync(sdkPadrao) ? sdkPadrao : undefined);
if (!env.ANDROID_HOME || !existsSync(env.ANDROID_HOME)) falhar('Android SDK não encontrado (defina ANDROID_HOME).');

const java = spawnSync('java', ['-version'], { encoding: 'utf8', shell: windows, env });
const versaoJava = `${java.stderr ?? ''}${java.stdout ?? ''}`.match(/version "(\d+)/)?.[1];
if (!versaoJava) falhar('Java não encontrado (instale o JDK 17 e defina JAVA_HOME).');
if (versaoJava !== '17') console.warn(`⚠ Java ${versaoJava} encontrado; o recomendado para o React Native é o JDK 17.`);

// 2. Modo do app embutido no APK (variáveis EXPO_PUBLIC_* entram no bundle na hora do build).
//    Variáveis já definidas no processo têm prioridade sobre o .env.local.
env.EXPO_PUBLIC_MOCK = args.has('--replay') ? 'replay' : 'off';
env.NODE_ENV = 'production';
const envLocal = join(RAIZ, '.env.local');
if (existsSync(envLocal) && /EXPO_PUBLIC_MOCK\s*=\s*replay/.test(readFileSync(envLocal, 'utf8')) && !args.has('--replay')) {
  console.log('ℹ .env.local está em modo replay; o APK será gerado em modo OFICIAL mesmo assim.');
}
console.log(`Modo do APK: ${env.EXPO_PUBLIC_MOCK === 'replay' ? 'REPLAY (teste)' : 'oficial (TSE)'}`);

// 3. Projeto nativo (pasta android/ é gerada e fica fora do git).
//    O prebuild reescreve os scripts do package.json; o original é restaurado em seguida.
const pacote = join(RAIZ, 'package.json');
const pacoteOriginal = readFileSync(pacote, 'utf8');
console.log('\n› npx expo prebuild --platform android --clean');
const prebuild = spawnSync('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], {
  cwd: RAIZ,
  env,
  stdio: 'inherit',
  shell: windows,
});
writeFileSync(pacote, pacoteOriginal);
if (prebuild.status !== 0) falhar('Falhou: expo prebuild');

// 4. Gradle
const gradle = windows ? 'gradlew.bat' : './gradlew';
const gradleArgs = ['assembleRelease'];
if (!args.has('--todas-arquiteturas')) gradleArgs.push('-PreactNativeArchitectures=arm64-v8a');
executar(gradle, gradleArgs, { cwd: join(RAIZ, 'android'), env });

// 5. Copia para dist/
const versao = JSON.parse(readFileSync(join(RAIZ, 'app.json'), 'utf8')).expo.version;
const origem = join(RAIZ, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(origem)) falhar(`APK não encontrado em ${origem}`);
mkdirSync(join(RAIZ, 'dist'), { recursive: true });
const sufixo = env.EXPO_PUBLIC_MOCK === 'replay' ? '-replay' : '';
const destino = join(RAIZ, 'dist', `apuracao-2026-v${versao}${sufixo}.apk`);
copyFileSync(origem, destino);
console.log(`\n✔ APK pronto: ${destino} (${(statSync(destino).size / 1024 / 1024).toFixed(1)} MB)`);
console.log('  Para instalar no celular, veja docs/PASSO-A-PASSO.md, seção "Passar o APK para o celular".\n');
