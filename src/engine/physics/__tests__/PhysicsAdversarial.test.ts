/**
 * SECP Industrial OS v2 — Physics Adversarial Tests
 * PATCH-042: Physics Foundation
 */

import { describe, it, expect } from 'vitest';
import { PhysicsModelFactory } from '../PhysicsModel';
import { PhysicsDomain } from '../PhysicsTypes';
import { PhysicsModelValidator } from '../PhysicsModelValidator';
import { Dimension } from '../units/Dimension';

describe('PATCH-042: Physics Adversarial Tests', () => {

  it('rejects BoundaryCondition referring to non-existent region', () => {
    const model = PhysicsModelFactory.createEmptyModel('ADV_BC_REF', PhysicsDomain.STRUCTURAL);
    model.boundaryConditions.push({
      id: 'BC1',
      type: 'DIRICHLET',
      targetRegion: 'NON_EXISTENT_REGION',
      field: 'DISPLACEMENT',
      quantity: { value: 0, unit: 'm', dimension: Dimension.LENGTH.vector }
    });

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('non-existent Region: NON_EXISTENT_REGION'))).toBe(true);
  });

  it('rejects InitialCondition referring to non-existent region', () => {
    const model = PhysicsModelFactory.createEmptyModel('ADV_IC_REF', PhysicsDomain.STRUCTURAL);
    model.initialConditions.push({
      id: 'IC1',
      targetRegion: 'MISSING_REGION',
      field: 'TEMPERATURE',
      quantity: { value: 293.15, unit: 'K', dimension: Dimension.TEMPERATURE.vector }
    });

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('non-existent Region: MISSING_REGION'))).toBe(true);
  });

  it('handles NaN and Infinity in boundary conditions', () => {
    const model = PhysicsModelFactory.createEmptyModel('ADV_NUMERICAL', PhysicsDomain.STRUCTURAL);
    model.regions.push({
      regionId: 'R1',
      geometryReference: { artifactId: 'C1', artifactHash: 'H1', revision: '1', source: 'T' },
      fieldAssignments: [],
      boundaryAssignments: ['BC1']
    });
    model.boundaryConditions.push({
      id: 'BC1',
      type: 'NEUMANN',
      targetRegion: 'R1',
      field: 'PRESSURE',
      quantity: { value: NaN, unit: 'Pa', dimension: Dimension.PRESSURE.vector }
    });

    const hash1 = PhysicsModelValidator.calculateCanonicalHash(model);
    
    model.boundaryConditions[0].quantity.value = Infinity;
    const hash2 = PhysicsModelValidator.calculateCanonicalHash(model);
    
    expect(hash1).not.toBe(hash2);
  });

  it('rejects dimension spoofing in Boundary Conditions', () => {
    const model = PhysicsModelFactory.createEmptyModel('ADV_SPOOF', PhysicsDomain.STRUCTURAL);
    model.regions.push({ regionId: 'R1', geometryReference: { artifactId: '1', artifactHash: 'H1', revision: '1', source: 'T' }, fieldAssignments: [], boundaryAssignments: ['BC1'] });
    model.boundaryConditions.push({
      id: 'BC1',
      type: 'DIRICHLET',
      targetRegion: 'R1',
      field: 'PRESSURE',
      quantity: { value: 10, unit: 'Pa', dimension: Dimension.MASS.vector } // WRONG DIMENSION
    });

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Dimension spoofing detected'))).toBe(true);
  });

  it('ensures determinism with shuffled regions and fields', () => {
    const createModel = (order: 'normal' | 'shuffled') => {
      const model = PhysicsModelFactory.createEmptyModel('DETERMINISM', PhysicsDomain.STRUCTURAL);
      const regions = [
        { regionId: 'R1', geometryReference: { artifactId: '1', artifactHash: 'H1', revision: '1', source: 'T' }, fieldAssignments: [], boundaryAssignments: [] },
        { regionId: 'R2', geometryReference: { artifactId: '2', artifactHash: 'H2', revision: '1', source: 'T' }, fieldAssignments: [], boundaryAssignments: [] }
      ];
      const fields = [
        { fieldId: 'F1', name: 'F1', quantityDimension: 'L', locationType: 'NODAL' as const, domain: PhysicsDomain.STRUCTURAL, status: 'D' },
        { fieldId: 'F2', name: 'F2', quantityDimension: 'L', locationType: 'NODAL' as const, domain: PhysicsDomain.STRUCTURAL, status: 'D' }
      ];

      if (order === 'shuffled') {
        model.regions.push(regions[1], regions[0]);
        model.fields.push(fields[1], fields[0]);
      } else {
        model.regions.push(regions[0], regions[1]);
        model.fields.push(fields[0], fields[1]);
      }
      return model;
    };

    const hash1 = PhysicsModelValidator.calculateCanonicalHash(createModel('normal'));
    const hash2 = PhysicsModelValidator.calculateCanonicalHash(createModel('shuffled'));

    expect(hash1).toBe(hash2);
  });

  it('rejects circular dependencies if they were implemented (Placeholder)', () => {
    // Dependency graph is currently just a list in PhysicsModel, but we can verify it exists
    const model = PhysicsModelFactory.createEmptyModel('DEP_TEST', PhysicsDomain.STRUCTURAL);
    model.dependencies.push({ id: 'D1', type: 'CAD', artifactHash: 'H1', required: true });
    
    expect(model.dependencies.length).toBe(1);
    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(true);
  });

});
