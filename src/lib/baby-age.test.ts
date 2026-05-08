import { describe, expect, it } from 'vitest';
import { babyAgeFromBirth, durationLabel } from './baby-age';

describe('babyAgeFromBirth', () => {
  const now = new Date('2026-05-07T12:00:00Z');

  it('devuelve null si no hay birthDate', () => {
    expect(babyAgeFromBirth(null, now)).toBeNull();
  });

  it('cuenta días para recién nacido', () => {
    const r = babyAgeFromBirth('2026-05-04', now);
    expect(r?.days).toBe(3);
    expect(r?.label).toBe('3 días');
    expect(r?.unborn).toBe(false);
  });

  it('singular para 1 día', () => {
    const r = babyAgeFromBirth('2026-05-06', now);
    expect(r?.label).toBe('1 día');
  });

  it('pasa a semanas a partir del día 7', () => {
    const r = babyAgeFromBirth('2026-04-23', now);
    expect(r?.weeks).toBe(2);
    expect(r?.label).toBe('2 semanas');
  });

  it('pasa a meses a partir de 8 semanas', () => {
    const r = babyAgeFromBirth('2026-02-15', now);
    expect(r?.months).toBe(2);
    expect(r?.label).toMatch(/^\d+ mes/);
  });

  it('pasa a años a partir de 24 meses', () => {
    const r = babyAgeFromBirth('2024-01-01', now);
    expect(r?.label).toMatch(/años$/);
  });

  it('marca unborn si la fecha es futura', () => {
    const r = babyAgeFromBirth('2026-05-12', now);
    expect(r?.unborn).toBe(true);
    expect(r?.days).toBeLessThan(0);
    expect(r?.label).toMatch(/^Faltan? \d+ d[íi]a/);
  });

  it('singular faltando 1 día', () => {
    const r = babyAgeFromBirth('2026-05-08', now);
    expect(r?.label).toBe('Falta 1 día');
  });
});

describe('durationLabel', () => {
  it('recién para diff sub-minuto', () => {
    const a = '2026-05-07T12:00:00Z';
    const b = new Date('2026-05-07T12:00:10Z');
    expect(durationLabel(a, b)).toBe('recién');
  });

  it('minutos sueltos', () => {
    const a = '2026-05-07T12:00:00Z';
    const b = new Date('2026-05-07T12:25:00Z');
    expect(durationLabel(a, b)).toBe('25 min');
  });

  it('horas exactas', () => {
    const a = '2026-05-07T12:00:00Z';
    const b = new Date('2026-05-07T15:00:00Z');
    expect(durationLabel(a, b)).toBe('3 h');
  });

  it('horas + minutos', () => {
    const a = '2026-05-07T12:00:00Z';
    const b = new Date('2026-05-07T13:20:00Z');
    expect(durationLabel(a, b)).toBe('1 h 20 min');
  });

  it('clamp a 0 si fromISO es futuro', () => {
    const a = '2026-05-07T15:00:00Z';
    const b = new Date('2026-05-07T12:00:00Z');
    expect(durationLabel(a, b)).toBe('recién');
  });
});
