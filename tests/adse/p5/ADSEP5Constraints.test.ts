/**
 * SECP — ADSE-P5 Structural Constraints Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Structural Constraints Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.CONSTRAINTS: should manage physical assembly constraints and detect contradictory conflicts', () => {
    const defA = p5.registry.registerElement({
      elementId: 'comp:def:BRACKET_A',
      elementType: 'ComponentDefinition',
      displayName: 'Mounting Bracket Def A',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const instA = p5.registry.registerElement({
      elementId: 'comp:inst:BRACKET_A_1',
      elementType: 'ComponentInstance',
      displayName: 'Mounting Bracket Instance A1',
      layer: 'COMPONENT',
      definitionId: defA.elementId,
      configurationId: 'CONF-BASE'
    });

    const defB = p5.registry.registerElement({
      elementId: 'comp:def:FLANGE_B',
      elementType: 'ComponentDefinition',
      displayName: 'Mating Flange Def B',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const instB = p5.registry.registerElement({
      elementId: 'comp:inst:FLANGE_B_1',
      elementType: 'ComponentInstance',
      displayName: 'Mating Flange Instance B1',
      layer: 'COMPONENT',
      definitionId: defB.elementId,
      configurationId: 'CONF-BASE'
    });

    // Valid Constraint: Parallel
    const const1 = p5.constraints.registerConstraint({
      constraintType: 'Parallel',
      displayName: 'Parallel Flange Mating Faces',
      sourceElementId: instA.elementId,
      targetElementId: instB.elementId,
      configurationId: 'CONF-BASE'
    });

    expect(const1.status).toBe('VALID');

    // Contradictory Constraint: Perpendicular between same instances
    expect(() => {
      p5.constraints.registerConstraint({
        constraintType: 'Perpendicular',
        displayName: 'Perpendicular Flange Mating Faces',
        sourceElementId: instA.elementId,
        targetElementId: instB.elementId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/CONTRADICTORY_CONSTRAINT_ERROR/);
  });
});
