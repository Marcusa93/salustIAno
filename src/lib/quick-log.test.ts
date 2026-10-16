import { describe, expect, it } from 'vitest';
import { getRetryTarget } from './pwa/offline';
import { getBottlePresets, parseQuickLogKind } from './quick-log';

describe('parseQuickLogKind', () => {
  it('acepta los tres atajos del manifest', () => {
    expect(parseQuickLogKind('toma')).toBe('toma');
    expect(parseQuickLogKind('sueno')).toBe('sueno');
    expect(parseQuickLogKind('panal')).toBe('panal');
  });

  it('rechaza cualquier otra cosa', () => {
    expect(parseQuickLogKind('pañal')).toBeNull();
    expect(parseQuickLogKind('')).toBeNull();
    expect(parseQuickLogKind('constructor')).toBeNull();
  });
});

describe('getBottlePresets', () => {
  it('sin historial usa los defaults', () => {
    expect(getBottlePresets([])).toEqual([60, 90, 120]);
  });

  it('elige las tres cantidades más frecuentes, ordenadas', () => {
    expect(getBottlePresets([150, 120, 150, 90, 120, 150, 90, 60])).toEqual([90, 120, 150]);
  });

  it('completa con defaults sin repetir', () => {
    expect(getBottlePresets([90, 90, 100])).toEqual([60, 90, 100]);
  });

  it('desempata por la cantidad más chica', () => {
    expect(getBottlePresets([130, 110, 100, 140])).toEqual([100, 110, 130]);
  });

  it('ignora nulls y valores inválidos', () => {
    expect(getBottlePresets([null, 0, -5, Number.NaN, 100])).toEqual([60, 90, 100]);
  });
});

describe('getRetryTarget', () => {
  it('recarga la página pedida, salvo que sea /offline misma', () => {
    expect(getRetryTarget('/cuidar')).toBeNull();
    expect(getRetryTarget('/offline')).toBe('/home');
  });
});
