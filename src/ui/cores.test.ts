import { describe, expect, it } from 'vitest';
import { contraste } from '@/lib/partidos';
import { claro, escuro, type Tema } from './cores';

/** Pares texto/fundo usados nas telas: todos precisam de contraste AA (≥ 4,5:1). */
const pares = (t: Tema): [string, string, string][] => [
  ['texto/fundo', t.texto, t.fundo],
  ['texto/superficie', t.texto, t.superficie],
  ['textoSecundario/fundo', t.textoSecundario, t.fundo],
  ['textoSecundario/superficie', t.textoSecundario, t.superficie],
  ['destaque/fundo', t.destaque, t.fundo],
  ['destaqueTexto/destaque', t.destaqueTexto, t.destaque],
  ['sucessoTexto/sucesso', t.sucessoTexto, t.sucesso],
  ['eleitoTexto/eleito', t.eleitoTexto, t.eleito],
  ['andamentoTexto/andamento', t.andamentoTexto, t.andamento],
  ['avisoTexto/aviso', t.avisoTexto, t.aviso],
  ['erro/fundo', t.erro, t.fundo],
];

describe('contraste dos temas', () => {
  for (const [nome, tema] of [['claro', claro], ['escuro', escuro]] as const) {
    it.each(pares(tema))(`${nome}: %s`, (_, frente, fundo) => {
      expect(contraste(frente, fundo)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
