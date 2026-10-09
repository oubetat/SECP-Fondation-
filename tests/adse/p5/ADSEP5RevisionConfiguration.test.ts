/**
 * SECP — ADSE-P5 Revision & Configuration Integrity Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Revision & Configuration Integrity Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.REV_CONFIG: should isolate structural configurations and detect cross-configuration contamination', () => {
    const compConfigA = p5.registry.registerElement({
      elementId: 'comp:def:POD_ALPHA',
      elementType: 'ComponentDefinition',
      displayName: 'EW Pod Config Alpha',
      layer: 'COMPONENT',
      configurationId: 'CONF-ALPHA'
    });

    const compConfigB = p5.registry.registerElement({
      elementId: 'comp:def:POD_BETA',
      elementType: 'ComponentDefinition',
      displayName: 'EW Pod Config Beta',
      layer: 'COMPONENT',
      configurationId: 'CONF-BETA'
    });

    // Cross-configuration relationship attempt must flag finding in consistency auditor
    p5.registry.addRelationship({
      relationshipType: 'CONNECTED_TO',
      sourceElementId: compConfigA.elementId,
      targetElementId: compConfigB.elementId,
      configurationId: 'CONF-ALPHA'
    });

    const reportAlpha = p5.consistency.auditConsistency('CONF-ALPHA');
    expect(reportAlpha.isConsistent).toBe(false);
    expect(reportAlpha.findings.some(f => f.category === 'CROSS_CONFIGURATION_CONTAMINATION')).toBe(true);
  });

  it('P5.REV_CONFIG: should detect cross-revision contamination with unauthorized revisions', () => {
    const el1 = p5.registry.registerElement({
      elementId: 'part:def:PIN_A',
      elementType: 'PartDefinition',
      displayName: 'Hinge Pin A',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-01'
    });

    const el2 = p5.registry.registerElement({
      elementId: 'part:def:PIN_B',
      elementType: 'PartDefinition',
      displayName: 'Hinge Pin B',
      layer: 'PART',
      configurationId: 'CONF-BASE',
      revisionId: 'REV-UNAUTHORIZED-STALE-02'
    });

    p5.registry.addRelationship({
      relationshipType: 'MATED_TO',
      sourceElementId: el1.elementId,
      targetElementId: el2.elementId,
      configurationId: 'CONF-BASE'
    });

    const report = p5.consistency.auditConsistency('CONF-BASE');
    expect(report.isConsistent).toBe(false);
    expect(report.findings.some(f => f.category === 'CROSS_REVISION_CONTAMINATION')).toBe(true);
  });
});
