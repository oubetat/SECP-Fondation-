/**
 * SECP Industrial OS v2 — Material Model Adversarial Tests
 * PATCH-044: Material Model
 */

import { describe, it, expect } from 'vitest';
import { MaterialModel } from '../MaterialModel';
import { MaterialRepresentation, MaterialIdentity } from '../MaterialTypes';
import { Quantity, UnitRegistry, Dimension } from '../../units/index';
import { MaterialValidator } from '../MaterialValidator';

describe('PATCH-044: Material Model Adversarial', () => {

  const validIdentity: MaterialIdentity = {
    materialId: 'TEST-MAT-ADV',
    canonicalName: 'Test Material ADV',
    materialFamily: 'STEEL',
    grade: 'A36',
    revision: '1.0'
  };

  it('rejects physically invalid Poisson ratio', () => {
    const dimensionlessUnit = { id: 'scalar', symbol: '', name: 'Scalar', dimension: Dimension.SCALAR, scale: 1, offset: 0, system: 'OTHER' as const, aliases: [] };
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'POISSONS_RATIO': {
          propertyId: 'POISSONS_RATIO',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: { type: 'CONSTANT', value: new Quantity(0.6, dimensionlessUnit) } // Dimensionless
        }
      }
    };
    const model = new MaterialModel(rep);
    const errors = MaterialValidator.validate(model);
    expect(errors.some(e => e.includes('POISSONS_RATIO out of theoretical valid range'))).toBe(true);
  });

  it('rejects negative or zero Youngs Modulus', () => {
    const pressureUnit = { id: 'Pa', symbol: 'Pa', name: 'Pascal', dimension: Dimension.PRESSURE, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'YOUNGS_MODULUS': {
          propertyId: 'YOUNGS_MODULUS',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: { type: 'CONSTANT', value: new Quantity(-200e9, pressureUnit) } // INVALID NEGATIVE
        }
      }
    };
    const model = new MaterialModel(rep);
    const errors = MaterialValidator.validate(model);
    expect(errors.some(e => e.includes('Zero or negative YOUNGS_MODULUS'))).toBe(true);
  });

  it('rejects evaluating a property outside its temperature validity range', () => {
     const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
     const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'DENSITY': {
          propertyId: 'DENSITY',
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          validityRange: {
            minState: { temperature: new Quantity(273.15, UnitRegistry.get('K')) },
            maxState: { temperature: new Quantity(373.15, UnitRegistry.get('K')) }
          },
          model: { type: 'CONSTANT', value: new Quantity(7850, densityUnit) }
        }
      }
    };
    const model = new MaterialModel(rep);
    
    // Valid state
    expect(model.evaluateProperty('DENSITY', { temperature: new Quantity(300, UnitRegistry.get('K')) }).value).toBe(7850);
    
    // Invalid state (too hot)
    expect(() => model.evaluateProperty('DENSITY', { temperature: new Quantity(500, UnitRegistry.get('K')) })).toThrow('above validity range');
  });

  it('detects mismatched propertyID and key', () => {
    const densityUnit = { id: 'kg/m3', symbol: 'kg/m³', name: 'Density', dimension: Dimension.DENSITY, scale: 1, offset: 0, system: 'SI' as const, aliases: [] };
    const rep: MaterialRepresentation = {
      identity: validIdentity,
      properties: {
        'DENSITY': {
          propertyId: 'YOUNGS_MODULUS', // MISMATCH
          propertyType: 'SCALAR',
          status: 'VALIDATED',
          model: { type: 'CONSTANT', value: new Quantity(7850, densityUnit) }
        }
      }
    };
    const model = new MaterialModel(rep);
    const errors = MaterialValidator.validate(model);
    expect(errors.some(e => e.includes('Property ID mismatch for DENSITY'))).toBe(true);
  });

});
