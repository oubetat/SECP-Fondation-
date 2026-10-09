/**
 * SECP — ADSE-P5 Structural Impact Analysis Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Structural Impact Analysis Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.IMPACT: should calculate full blast radius of structural modification across requirements, components, constraints, and verifications', () => {
    const parentComp = p5.registry.registerElement({
      elementId: 'comp:def:WING_ATTACH_FITTING',
      elementType: 'ComponentDefinition',
      displayName: 'Main Wing Attach Fitting',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p1ReqId: 'REQ-LOAD-FACTOR-9G',
      p2MbseId: 'mbse:block:WING_ATTACH',
      p3ArchId: 'arch:comp:ATTACH_LUG'
    });

    const childPart = p5.registry.registerElement({
      elementId: 'part:def:ATTACH_PIN_TITANIUM',
      elementType: 'PartDefinition',
      displayName: 'Titanium Shear Pin',
      layer: 'PART',
      configurationId: 'CONF-BASE'
    });

    p5.decomposition.decompose({
      parentElementId: parentComp.elementId,
      childElementId: childPart.elementId,
      configurationId: 'CONF-BASE'
    });

    const const1 = p5.constraints.registerConstraint({
      constraintType: 'Concentric',
      displayName: 'Pin and Lug Concentricity',
      sourceElementId: parentComp.elementId,
      targetElementId: childPart.elementId,
      configurationId: 'CONF-BASE',
      verifiedByIntentId: 'VERIF-SHEAR-TEST-001'
    });

    p5.placements.setPlacement({
      instanceId: parentComp.elementId,
      translation: { x: 5.0, y: 0, z: 1.2 },
      rotation: { rx: 0, ry: 0, rz: 0 },
      configurationId: 'CONF-BASE'
    });

    const impact = p5.impact.analyzeImpact(parentComp.elementId);

    expect(impact.affectedRequirements).toContain('REQ-LOAD-FACTOR-9G');
    expect(impact.affectedMbseElements).toContain('mbse:block:WING_ATTACH');
    expect(impact.affectedArchitecture).toContain('arch:comp:ATTACH_LUG');
    expect(impact.affectedStructuralElements).toContain(childPart.elementId);
    expect(impact.affectedConstraints).toContain(const1.constraintId);
    expect(impact.affectedVerifications).toContain('VERIF-SHEAR-TEST-001');
    expect(impact.severity).toBe('HIGH');
  });
});
