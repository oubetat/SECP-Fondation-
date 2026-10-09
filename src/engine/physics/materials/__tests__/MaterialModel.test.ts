/**
 * SECP Industrial OS v2 — Material Model Tests
 * PATCH-044: Material Model
 */

import { describe, it, expect } from 'vitest';
import { MaterialModel } from '../MaterialModel';
import { MaterialRepresentation, MaterialIdentity } from '../MaterialTypes';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { MaterialValidator } from '../MaterialValidator';
import { MaterialModelGate044 } from '../MaterialModelGate044';

describe('PATCH-044: Material Model', () => {

  const validIdentity: MaterialIdentity = {
    materialId: 'TEST-MAT-001',
    canonicalName: 'Test Steel A36',
    materialFamily: 'STEEL',
    grade: 'A36',
    revision: '1.0'
  };

  it('creates a material and verifies identity separation', () => {
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {}
    };
    const model = new MaterialModel(rep);
    expect(model.identity.materialId).toBe('TEST-MAT-001');
    expect(model.properties).toBeDefined();
  });

  it('integrates with Units & Dimensions Engine', () => {
    const massUnit = UnitRegistry.get('kg');
    const lengthUnit = UnitRegistry.get('m');
    const volumeUnit = {
      id: 'm3', symbol: 'm³', name: 'Cubic Meter', dimension: Dimension.VOLUME, scale: 1, offset: 0, system: 'SI' as const, aliases: []
    };
    const densityUnit = {
      id: 'kg/m3', symbol: 'kg/m³', name: 'Kilogram per cubic meter', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: []
    };

    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'DENSITY': {
          propertyId: 'DENSITY',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: {
            type: 'CONSTANT',
            value: new Quantity(7850, densityUnit)
          }
        }
      }
    };
    const model = new MaterialModel(rep);
    const density = model.getProperty('DENSITY');
    expect(density.model.type).toBe('CONSTANT');
    if (density.model.type === 'CONSTANT') {
      expect(density.model.value.dimension.equals(Dimension.DENSITY)).toBe(true);
    }
  });

  it('validates property types and ranges', () => {
    const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Kilogram per cubic meter', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'DENSITY': {
          propertyId: 'DENSITY',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: { type: 'CONSTANT', value: new Quantity(-100, densityUnit) } // INVALID NEGATIVE
        }
      }
    };
    const model = new MaterialModel(rep);
    const errors = MaterialValidator.validate(model);
    expect(errors.some(e => e.includes('Negative DENSITY'))).toBe(true);
  });

  it('generates deterministic fingerprint independent of property order', () => {
     const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
     const pressureUnit = { id: 'Pa', symbol: 'Pa', name: 'Pascal', dimension: Dimension.PRESSURE, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
     
     const rep1: MaterialRepresentation = {
       identity: validIdentity,
       properties: {
         'A_DENSITY': { propertyId: 'A_DENSITY', propertyType: 'SCALAR', status: 'VALIDATED', model: { type: 'CONSTANT', value: new Quantity(7000, densityUnit) } },
         'B_MODULUS': { propertyId: 'B_MODULUS', propertyType: 'SCALAR', status: 'VALIDATED', model: { type: 'CONSTANT', value: new Quantity(200e9, pressureUnit) } }
       }
     };

     const rep2: MaterialRepresentation = {
       identity: validIdentity,
       properties: {
         'B_MODULUS': { propertyId: 'B_MODULUS', propertyType: 'SCALAR', status: 'VALIDATED', model: { type: 'CONSTANT', value: new Quantity(200e9, pressureUnit) } },
         'A_DENSITY': { propertyId: 'A_DENSITY', propertyType: 'SCALAR', status: 'VALIDATED', model: { type: 'CONSTANT', value: new Quantity(7000, densityUnit) } }
       }
     };

     const model1 = new MaterialModel(rep1);
     const model2 = new MaterialModel(rep2);

     expect(model1.generateFingerprint()).toBe(model2.generateFingerprint());
  });

  it('rejects evaluating UNPROVEN missing properties', () => {
    const rep: MaterialRepresentation = { identity: validIdentity, properties: {} };
    const model = new MaterialModel(rep);
    expect(() => model.evaluateProperty('YIELD_STRENGTH')).toThrow('UNPROVEN');
  });

  it('passes MaterialModelGate044', () => {
    const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'DENSITY': {
          propertyId: 'DENSITY',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: { type: 'CONSTANT', value: new Quantity(7850, densityUnit) }
        }
      }
    };
    const model = new MaterialModel(rep);
    const result = MaterialModelGate044.evaluate(model);
    expect(result.status).toBe('PASS');
    expect(result.capabilities.MATERIAL_IDENTITY_SEPARATION).toBe(true);
    expect(result.capabilities.INDUSTRIAL_DATABASE).toBe('UNPROVEN');
  });
});
