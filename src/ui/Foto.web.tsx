import { StyleSheet } from 'react-native';
import type { FotoProps } from './Foto';

/**
 * Foto do candidato na web. Com "Cross-Origin-Embedder-Policy: require-corp" (exigido pelo
 * expo-sqlite), imagem de outro domínio só carrega se pedida com CORS. Nem o expo-image nem o
 * Image do react-native-web enviam crossOrigin, por isso aqui é um <img> comum.
 */
export function Foto({ uri, tamanho, estilo, onError }: FotoProps) {
  const s = StyleSheet.flatten(estilo);
  return (
    <img
      src={uri}
      crossOrigin="anonymous"
      alt=""
      onError={onError}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: '50%',
        border: `${s.borderWidth ?? 0}px solid ${String(s.borderColor ?? 'transparent')}`,
        boxSizing: 'border-box',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
}
