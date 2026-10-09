/**
 * SECP Industrial OS v2 — Units & Dimensions Tests
 * PATCH-043: Units & Dimensions Engine
 */

import { describe, it, expect } from 'vitest';
import { UnitRegistry, Dimension, Quantity, UnitParser, UnitsDimensionsGate043 } from '../index';

describe('PATCH-043: Units & Dimensions Engine', () => {

  describe('Dimension Model', () => {
    it('verifies base dimensions', () => {
      expect(Dimension.LENGTH.vector.length).toBe(1);
      expect(Dimension.MASS.vector.mass).toBe(1);
    });

    it('verifies derived dimensions', () => {
      expect(Dimension.AREA.vector.length).toBe(2);
      expect(Dimension.VELOCITY.vector.length).toBe(1);
      expect(Dimension.VELOCITY.vector.time).toBe(-1);
      expect(Dimension.FORCE.vector.mass).toBe(1);
      expect(Dimension.FORCE.vector.length).toBe(1);
      expect(Dimension.FORCE.vector.time).toBe(-2);
    });
  });

  describe('Unit Conversion', () => {
    it('converts m to mm', () => {
      const q = new Quantity(1, UnitRegistry.get('m'));
      const q2 = q.convertTo('mm');
      expect(q2.value).toBe(1000);
    });

    it('converts bar to Pa', () => {
      const q = new Quantity(1, UnitRegistry.get('bar'));
      const q2 = q.convertTo('Pa');
      expect(q2.value).toBe(100000);
    });

    it('converts Celsius to Kelvin', () => {
      const q = new Quantity(0, UnitRegistry.get('°C'));
      const q2 = q.convertTo('K');
      expect(q2.value).toBe(273.15);
    });

    it('rejects incompatible dimensions', () => {
      const q = new Quantity(1, UnitRegistry.get('m'));
      expect(() => q.convertTo('s')).toThrow('Incompatible dimensions');
    });
  });

  describe('Quantity Arithmetic', () => {
    it('adds compatible quantities', () => {
      const q1 = new Quantity(1, UnitRegistry.get('m'));
      const q2 = new Quantity(500, UnitRegistry.get('mm'));
      const sum = q1.add(q2);
      expect(sum.value).toBe(1.5);
      expect(sum.unit.symbol).toBe('m');
    });

    it('multiplies quantities correctly (Dimensional Analysis)', () => {
      const mass = new Quantity(10, UnitRegistry.get('kg'));
      const acc = new Quantity(9.8, UnitRegistry.get('m')).divide(new Quantity(1, UnitRegistry.get('s'))).divide(new Quantity(1, UnitRegistry.get('s')));
      
      const force = mass.multiply(acc);
      expect(force.dimension.equals(Dimension.FORCE)).toBe(true);
      expect(force.value).toBe(98);
    });
  });

  describe('Unit Parser', () => {
    it('parses m/s', () => {
      const unit = UnitParser.parse('m/s');
      expect(unit.dimension.equals(Dimension.VELOCITY)).toBe(true);
      expect(unit.scale).toBe(1);
    });

    it('parses MPa', () => {
      const unit = UnitParser.parse('MPa');
      expect(unit.dimension.equals(Dimension.PRESSURE)).toBe(true);
      expect(unit.scale).toBe(1e6);
    });
  });

  describe('Acceptance Gate', () => {
    it('passes UnitsDimensionsGate043', () => {
      const gate = UnitsDimensionsGate043.evaluate();
      expect(gate.verdict).toBe('PASS');
    });
  });

});
