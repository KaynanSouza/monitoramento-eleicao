import { useColorScheme } from 'react-native';
import { claro, escuro, type Tema } from './cores';

export type { Tema };

export function useTema(): Tema {
  return useColorScheme() === 'dark' ? escuro : claro;
}
