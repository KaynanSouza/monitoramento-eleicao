// Configuração padrão do Expo + suporte ao expo-sqlite na web.
// Mesmos cabeçalhos da hospedagem (public/_headers e vercel.json): "require-corp" porque o
// Safari do iPhone não aceita "credentialless".
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
