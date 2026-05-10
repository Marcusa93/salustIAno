import { lmsTableFor, percentileForMeasurement, valueAtPercentile } from '@/lib/who-growth';
import { describe, expect, it } from 'vitest';

describe('percentileForMeasurement', () => {
  describe('weight, boys', () => {
    it('mediana al nacer (3.346 kg) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 3.3464,
        ageDays: 0,
      });
      expect(p).not.toBeNull();
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });

    it('mediana al mes (4.47 kg) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 4.4709,
        ageDays: 30,
      });
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });

    it('peso muy bajo (2 kg al mes) → percentil bajo (<10)', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 2.0,
        ageDays: 30,
      });
      expect(p).not.toBeNull();
      expect(p).toBeLessThan(10);
    });

    it('peso muy alto (7 kg al mes) → percentil alto (>90)', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 7.0,
        ageDays: 30,
      });
      expect(p).toBeGreaterThan(90);
    });

    it('interpola entre puntos LMS conocidos', () => {
      // 15 días: entre día 0 (3.346) y día 30 (4.47) → mediana ~3.91 kg
      const interpolatedMedian = (3.3464 + 4.4709) / 2;
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: interpolatedMedian,
        ageDays: 15,
      });
      // Debería estar cerca de p50 — ±10 puntos por la interpolación
      // lineal vs la verdadera curva.
      expect(p).toBeGreaterThanOrEqual(40);
      expect(p).toBeLessThanOrEqual(60);
    });
  });

  describe('weight, girls', () => {
    it('mediana al nacer (3.232 kg) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'female',
        kind: 'weight',
        value: 3.2322,
        ageDays: 0,
      });
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });

    it('boys vs girls — mismo peso, edad y kind dan percentil distinto', () => {
      // 4 kg al mes: para varón es bajo del promedio, para nena es promedio.
      const pBoy = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 4.0,
        ageDays: 30,
      });
      const pGirl = percentileForMeasurement({
        sex: 'female',
        kind: 'weight',
        value: 4.0,
        ageDays: 30,
      });
      expect(pBoy).not.toBeNull();
      expect(pGirl).not.toBeNull();
      // Para mismo peso, la nena debería tener percentil más alto
      // (porque las nenas tienen mediana más baja).
      expect(pGirl as number).toBeGreaterThan(pBoy as number);
    });
  });

  describe('length, boys', () => {
    it('mediana al nacer (49.88 cm) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'length',
        value: 49.8842,
        ageDays: 0,
      });
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });

    it('mediana al año (75.75 cm) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'length',
        value: 75.7488,
        ageDays: 365,
      });
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });
  });

  describe('head circumference, boys', () => {
    it('mediana al nacer (34.46 cm) → ~p50', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'head_circumference',
        value: 34.4618,
        ageDays: 0,
      });
      expect(p).toBeGreaterThanOrEqual(48);
      expect(p).toBeLessThanOrEqual(52);
    });
  });

  describe('edge cases', () => {
    it('sex other → null (no inventamos curva)', () => {
      const p = percentileForMeasurement({
        sex: 'other',
        kind: 'weight',
        value: 4.0,
        ageDays: 30,
      });
      expect(p).toBeNull();
    });

    it('sex null → null', () => {
      const p = percentileForMeasurement({
        sex: null,
        kind: 'weight',
        value: 4.0,
        ageDays: 30,
      });
      expect(p).toBeNull();
    });

    it('edad fuera de rango (>730d) → null', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 12.0,
        ageDays: 1000,
      });
      expect(p).toBeNull();
    });

    it('edad negativa → null', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 4.0,
        ageDays: -5,
      });
      expect(p).toBeNull();
    });

    it('valor cero → null', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: 0,
        ageDays: 30,
      });
      expect(p).toBeNull();
    });

    it('NaN → null', () => {
      const p = percentileForMeasurement({
        sex: 'male',
        kind: 'weight',
        value: Number.NaN,
        ageDays: 30,
      });
      expect(p).toBeNull();
    });
  });
});

describe('valueAtPercentile', () => {
  it('p50 al mes en boys → ~mediana (4.47 kg)', () => {
    const v = valueAtPercentile({
      sex: 'male',
      kind: 'weight',
      ageDays: 30,
      percentile: 50,
    });
    expect(v).not.toBeNull();
    expect(v as number).toBeGreaterThan(4.4);
    expect(v as number).toBeLessThan(4.55);
  });

  it('p3 < p50 < p97 (orden estricto)', () => {
    const ageDays = 90;
    const p3 = valueAtPercentile({ sex: 'male', kind: 'weight', ageDays, percentile: 3 });
    const p50 = valueAtPercentile({ sex: 'male', kind: 'weight', ageDays, percentile: 50 });
    const p97 = valueAtPercentile({ sex: 'male', kind: 'weight', ageDays, percentile: 97 });
    expect(p3).not.toBeNull();
    expect(p50).not.toBeNull();
    expect(p97).not.toBeNull();
    expect(p3 as number).toBeLessThan(p50 as number);
    expect(p50 as number).toBeLessThan(p97 as number);
  });

  it('roundtrip: percentile → value → percentile devuelve aproximadamente el mismo', () => {
    const ageDays = 60;
    const v = valueAtPercentile({ sex: 'male', kind: 'weight', ageDays, percentile: 75 });
    const p = percentileForMeasurement({
      sex: 'male',
      kind: 'weight',
      value: v as number,
      ageDays,
    });
    expect(p).not.toBeNull();
    // Tolerancia de ±2 por aproximación de la inversión.
    expect(p as number).toBeGreaterThan(73);
    expect(p as number).toBeLessThan(77);
  });
});

describe('lmsTableFor', () => {
  it('devuelve la tabla completa con puntos en orden creciente de edad', () => {
    const table = lmsTableFor('male', 'weight');
    expect(table.length).toBeGreaterThan(15);
    for (let i = 1; i < table.length; i++) {
      const prev = table[i - 1];
      const curr = table[i];
      expect(curr).toBeDefined();
      expect(prev).toBeDefined();
      if (prev && curr) {
        expect(curr.ageDays).toBeGreaterThan(prev.ageDays);
      }
    }
  });

  it('boys y girls weight tienen tablas distintas', () => {
    const boys = lmsTableFor('male', 'weight');
    const girls = lmsTableFor('female', 'weight');
    // Al menos un punto debe diferir en M (mediana).
    let foundDifference = false;
    for (let i = 0; i < boys.length && i < girls.length; i++) {
      const b = boys[i];
      const g = girls[i];
      if (b && g && b.ageDays === g.ageDays && b.M !== g.M) {
        foundDifference = true;
        break;
      }
    }
    expect(foundDifference).toBe(true);
  });
});
