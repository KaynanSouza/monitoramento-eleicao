import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

export interface FotoProps {
  uri: string;
  tamanho: number;
  estilo: StyleProp<ImageStyle>;
  onError: () => void;
}

/** Foto do candidato no celular (cache em disco do expo-image). Na web, ver Foto.web.tsx. */
export function Foto({ uri, estilo, onError }: FotoProps) {
  return (
    <Image
      source={uri}
      style={estilo}
      cachePolicy="disk"
      contentFit="cover"
      recyclingKey={uri}
      onError={onError}
      accessible={false}
    />
  );
}
