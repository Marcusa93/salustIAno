import { describe, expect, it } from 'vitest';

import { extractJsonObject, truncateForLog } from '@/lib/ai/json';

describe('extractJsonObject', () => {
  it('parsea JSON puro', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('tolera whitespace al rededor', () => {
    expect(extractJsonObject('   \n {"a":1}  \n')).toEqual({ a: 1 });
  });

  it('extrae JSON desde fences ```json … ```', () => {
    const raw = '```json\n{"color":"verde","alarm":false}\n```';
    expect(extractJsonObject(raw)).toEqual({ color: 'verde', alarm: false });
  });

  it('extrae JSON desde fences ``` … ``` (sin lenguaje)', () => {
    const raw = '```\n{"a":1}\n```';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });

  it('extrae JSON cuando hay preludio en prosa', () => {
    const raw = 'Acá te dejo el análisis:\n{"a":1}\nEspero que sirva.';
    expect(extractJsonObject(raw)).toEqual({ a: 1 });
  });

  it('devuelve null si el contenido no tiene JSON', () => {
    expect(extractJsonObject('no hay json acá')).toBeNull();
  });

  it('devuelve null para string vacío', () => {
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject('   ')).toBeNull();
  });

  it('devuelve null si el JSON está roto', () => {
    expect(extractJsonObject('{"a":1,')).toBeNull();
  });

  it('preserva tipos anidados (arrays, booleans, números)', () => {
    const raw = '{"alarm":true,"tags":["a","b"],"count":3}';
    expect(extractJsonObject(raw)).toEqual({ alarm: true, tags: ['a', 'b'], count: 3 });
  });
});

describe('truncateForLog', () => {
  it('colapsa whitespace y deja contenido corto intacto', () => {
    expect(truncateForLog('hola  \n  mundo')).toBe('hola mundo');
  });

  it('trunca con elipsis si excede maxLen', () => {
    const long = 'a'.repeat(300);
    const out = truncateForLog(long, 100);
    expect(out.length).toBe(101); // 100 chars + …
    expect(out.endsWith('…')).toBe(true);
  });

  it('devuelve string vacío si input no es string', () => {
    expect(truncateForLog(undefined as never)).toBe('');
  });
});
