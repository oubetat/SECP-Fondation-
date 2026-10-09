import { describe, it, expect } from 'vitest';
import { AssemblyConstraintValidator } from '../AssemblyConstraintValidator';
import { AssemblyConstraint } from '../AssemblyConstraintModel';

describe('AssemblyConstraintValidator', () => {
  const dummyRef = (compId: string, idx = 0) => ({
    componentId: compId,
    topologyType: 'FACE' as const,
    topologyIndex: idx,
    geometricSignature: 'sig',
  });

  it('TEST 12: should detect invalid geometry reference with out of bounds or negative indices', () => {
    const invalidConstraint: AssemblyConstraint = {
      constraintId: 'C_ERR',
      assemblyId: 'ASSY-1',
      parentRevisionId: 'REV-0',
      componentA: 'comp1',
      componentB: 'comp2',
      geometryReferenceA: dummyRef('comp1', -5), // Negative index (invalid reference)
      geometryReferenceB: dummyRef('comp2'),
      constraintType: 'COINCIDENT',
      parameters: {},
      tolerance: 1e-4,
      suppressed: false,
      enabled: true,
      priority: 1,
      createdBy: 'test',
      createdAt: new Date().toISOString(),
    };

    const validComponents = new Set(['comp1', 'comp2']);
    const validation = AssemblyConstraintValidator.validateGeometryReferences([invalidConstraint], validComponents);

    expect(validation.valid).toBe(false);
    expect(validation.invalidConstraintId).toBe('C_ERR');
    expect(validation.reason).toContain('invalid topology index');
  });

  it('should detect missing components in geometry references', () => {
    const invalidConstraint: AssemblyConstraint = {
      constraintId: 'C_ERR2',
      assemblyId: 'ASSY-1',
      parentRevisionId: 'REV-0',
      componentA: 'comp1',
      componentB: 'comp_missing', // Missing component
      geometryReferenceA: dummyRef('comp1'),
      geometryReferenceB: dummyRef('comp_missing'),
      constraintType: 'COINCIDENT',
      parameters: {},
      tolerance: 1e-4,
      suppressed: false,
      enabled: true,
      priority: 1,
      createdBy: 'test',
      createdAt: new Date().toISOString(),
    };

    const validComponents = new Set(['comp1']);
    const validation = AssemblyConstraintValidator.validateGeometryReferences([invalidConstraint], validComponents);

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('missing component');
  });
});
