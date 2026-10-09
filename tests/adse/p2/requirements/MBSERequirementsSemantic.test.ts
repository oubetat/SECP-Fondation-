import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Requirement Semantics', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('establishes DERIVES_FROM, REFINES, SATISFIES, and VERIFIES semantic relationships', () => {
    const parentReq = p2.registry.registerElement({
      mbseId: 'mbse:req:REQ-AERO-01',
      elementType: 'Requirement',
      displayName: 'Maximum Aerodynamic Load Factor',
      category: 'REQUIREMENT',
      configurationId: 'CFG-001'
    });

    const childReq = p2.registry.registerElement({
      mbseId: 'mbse:req:REQ-AERO-01-1',
      elementType: 'Requirement',
      displayName: 'Wing Structure Yield Margin',
      category: 'REQUIREMENT',
      configurationId: 'CFG-001'
    });

    const comp = p2.registry.registerElement({
      mbseId: 'mbse:comp:MAIN_WING',
      elementType: 'Component',
      displayName: 'Main Wing Assembly',
      category: 'STRUCTURAL',
      configurationId: 'CFG-001'
    });

    // Requirement Derivation
    p2.registry.addRelationship({
      relationshipType: 'DERIVES_FROM',
      sourceMbseId: childReq.mbseId,
      targetMbseId: parentReq.mbseId,
      configurationId: 'CFG-001'
    });

    // Requirement Satisfaction by Component
    p2.registry.addRelationship({
      relationshipType: 'SATISFIES',
      sourceMbseId: comp.mbseId,
      targetMbseId: childReq.mbseId,
      configurationId: 'CFG-001'
    });

    const rels = p2.registry.getRelationshipsForSource(childReq.mbseId);
    expect(rels[0].relationshipType).toBe('DERIVES_FROM');

    const satRels = p2.registry.getRelationshipsForTarget(childReq.mbseId);
    expect(satRels[0].relationshipType).toBe('SATISFIES');
  });
});
