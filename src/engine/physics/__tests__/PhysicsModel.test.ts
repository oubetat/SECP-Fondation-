/**
 * SECP Industrial OS v2 — Physics Model Tests
 * PATCH-042: Physics Foundation
 */

import { describe, it, expect } from 'vitest';
import { PhysicsModelFactory } from '../PhysicsModel';
import { PhysicsDomain } from '../PhysicsTypes';
import { PhysicsModelValidator } from '../PhysicsModelValidator';
import { PhysicsUnifiedModelGate042 } from '../PhysicsUnifiedModelGate042';
import { Dimension } from '../units/Dimension';

describe('PATCH-042: Unified Physics Model', () => {

  it('creates a valid PhysicsModel with correct domain', () => {
    const model = PhysicsModelFactory.createEmptyModel('TEST_001', PhysicsDomain.STRUCTURAL);
    expect(model.id).toBe('TEST_001');
    expect(model.domain).toBe(PhysicsDomain.STRUCTURAL);
    expect(model.status).toBe('DRAFT');

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(true);
  });

  it('rejects model with duplicate Region IDs', () => {
    const model = PhysicsModelFactory.createEmptyModel('TEST_DUP', PhysicsDomain.FLUID);
    model.regions.push({
      regionId: 'REGION_1',
      geometryReference: { artifactId: 'CAD_1', artifactHash: 'H1', revision: '1', source: 'TEST' },
      fieldAssignments: [],
      boundaryAssignments: []
    });
    model.regions.push({
      regionId: 'REGION_1', // DUPLICATE
      geometryReference: { artifactId: 'CAD_2', artifactHash: 'H2', revision: '1', source: 'TEST' },
      fieldAssignments: [],
      boundaryAssignments: []
    });

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Duplicate Region ID detected: REGION_1');
  });

  it('rejects region referring to non-existent field', () => {
    const model = PhysicsModelFactory.createEmptyModel('TEST_FIELD_REF', PhysicsDomain.THERMAL);
    model.regions.push({
      regionId: 'REGION_1',
      geometryReference: { artifactId: 'CAD_1', artifactHash: 'H1', revision: '1', source: 'TEST' },
      fieldAssignments: ['NON_EXISTENT_FIELD'],
      boundaryAssignments: []
    });

    const validation = PhysicsModelValidator.validate(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('non-existent Field: NON_EXISTENT_FIELD'))).toBe(true);
  });

  it('ensures canonical hash is stable and independent of property order', () => {
    const model1 = PhysicsModelFactory.createEmptyModel('HASH_TEST', PhysicsDomain.STRUCTURAL);
    model1.regions.push({
      regionId: 'A',
      geometryReference: { artifactId: '1', artifactHash: 'H1', revision: '1', source: 'T' },
      fieldAssignments: [],
      boundaryAssignments: []
    });
    model1.regions.push({
      regionId: 'B',
      geometryReference: { artifactId: '2', artifactHash: 'H2', revision: '1', source: 'T' },
      fieldAssignments: [],
      boundaryAssignments: []
    });

    const hash1 = PhysicsModelValidator.calculateCanonicalHash(model1);

    const model2 = PhysicsModelFactory.createEmptyModel('HASH_TEST', PhysicsDomain.STRUCTURAL);
    // Reverse order of regions
    model2.regions.push({
      regionId: 'B',
      geometryReference: { artifactId: '2', artifactHash: 'H2', revision: '1', source: 'T' },
      fieldAssignments: [],
      boundaryAssignments: []
    });
    model2.regions.push({
      regionId: 'A',
      geometryReference: { artifactId: '1', artifactHash: 'H1', revision: '1', source: 'T' },
      fieldAssignments: [],
      boundaryAssignments: []
    });

    const hash2 = PhysicsModelValidator.calculateCanonicalHash(model2);
    expect(hash1).toBe(hash2);
  });

  it('detects change in physics input via canonical hash', () => {
    const model = PhysicsModelFactory.createEmptyModel('MUTATION_TEST', PhysicsDomain.STRUCTURAL);
    model.boundaryConditions.push({
      id: 'BC1',
      type: 'DIRICHLET',
      targetRegion: 'R1',
      field: 'DISPLACEMENT',
      quantity: { value: 10.0, unit: 'mm', dimension: Dimension.LENGTH.vector }
    });
    model.regions.push({ regionId: 'R1', geometryReference: { artifactId: '1', artifactHash: 'H1', revision: '1', source: 'T' }, fieldAssignments: [], boundaryAssignments: ['BC1'] });

    const hash1 = PhysicsModelValidator.calculateCanonicalHash(model);

    // Mutate value
    model.boundaryConditions[0].quantity.value = 10.1;
    const hash2 = PhysicsModelValidator.calculateCanonicalHash(model);

    expect(hash1).not.toBe(hash2);
  });

  it('PhysicsUnifiedModelGate042 passes for valid model', () => {
    const model = PhysicsModelFactory.createEmptyModel('GATE_TEST', PhysicsDomain.STRUCTURAL);
    const gateResult = PhysicsUnifiedModelGate042.evaluate(model);
    expect(gateResult.verdict).toBe('PASS');
    expect(gateResult.capabilityResults.UNIFIED_PHYSICS_MODEL).toBe('IMPLEMENTED');
  });

  it('PhysicsUnifiedModelGate042 fails for invalid model', () => {
    const model = PhysicsModelFactory.createEmptyModel('GATE_FAIL', PhysicsDomain.STRUCTURAL);
    // Introduce error: BC pointing to missing region
    model.boundaryConditions.push({
      id: 'BC1',
      type: 'DIRICHLET',
      targetRegion: 'MISSING',
      field: 'D',
      quantity: { value: 0, unit: 'm', dimension: Dimension.LENGTH.vector }
    });
    
    const gateResult = PhysicsUnifiedModelGate042.evaluate(model);
    expect(gateResult.verdict).toBe('FAIL');
    expect(gateResult.failedCapabilities).toContain('STRUCTURAL_VALIDATION_FAILURE');
  });

});
