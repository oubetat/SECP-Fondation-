/**
 * SECP — ADSE-P5 Structural Persistence & Reconstruction Proof Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP5StructuralEngine } from '../../../src/engine/adse/p5/ADSEP5StructuralEngine';

describe('ADSE-P5 Persistence & Reconstruction Proof Suite', () => {
  let p5: ADSEP5StructuralEngine;

  beforeEach(() => {
    p5 = ADSEP5StructuralEngine.getInstance();
    p5.clear();
  });

  it('P5.PERSISTENCE: should create snapshot, destroy in-memory state, and reconstruct deterministically', () => {
    // 1. Construct model
    const sys = p5.registry.registerElement({
      elementId: 'sys:LANDING_GEAR',
      elementType: 'System',
      displayName: 'Main Landing Gear System',
      layer: 'SYSTEM',
      configurationId: 'CONF-PERSIST-P5'
    });

    const sub = p5.registry.registerElement({
      elementId: 'sub:STRUT_ASSY',
      elementType: 'Subsystem',
      displayName: 'Oleo Strut Subsystem',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-PERSIST-P5'
    });

    p5.decomposition.decompose({
      parentElementId: sys.elementId,
      childElementId: sub.elementId,
      configurationId: 'CONF-PERSIST-P5'
    });

    const def = p5.registry.registerElement({
      elementId: 'comp:def:CYLINDER_BARREL',
      elementType: 'ComponentDefinition',
      displayName: 'Main Cylinder Barrel Def',
      layer: 'COMPONENT',
      configurationId: 'CONF-PERSIST-P5'
    });

    const inst = p5.registry.registerElement({
      elementId: 'comp:inst:CYLINDER_LEFT',
      elementType: 'ComponentInstance',
      displayName: 'Main Cylinder Barrel Instance Left',
      layer: 'COMPONENT',
      definitionId: def.elementId,
      configurationId: 'CONF-PERSIST-P5'
    });

    p5.placements.setPlacement({
      instanceId: inst.elementId,
      translation: { x: 2.1, y: -1.5, z: -2.0 },
      rotation: { rx: 0, ry: 90, rz: 0 },
      configurationId: 'CONF-PERSIST-P5'
    });

    // 2. Snapshot
    const snap = p5.persistence.createSnapshot({
      configurationId: 'CONF-PERSIST-P5',
      revisionId: 'REV-PERSIST-01',
      persistedByAuthority: 'SECP_STORAGE_LEDGER'
    });

    expect(snap.snapshotId).toBeDefined();
    expect(snap.merkleHash).toHaveLength(64);
    expect(snap.elements.length).toBe(4);

    // 3. Destroy memory
    p5.registry.clear();
    p5.constraints.clear();
    p5.placements.clear();
    p5.interfaces.clear();

    expect(p5.registry.getAllElements().length).toBe(0);

    // 4. Restore
    const restoreResult = p5.persistence.restoreFromSnapshot(snap.snapshotId);
    expect(restoreResult.isValid).toBe(true);
    expect(restoreResult.restoredElementsCount).toBe(4);

    // 5. Verify restored state equivalence
    const restoredSys = p5.registry.getElement(sys.elementId);
    const restoredInst = p5.registry.getElement(inst.elementId);
    const restoredPlacement = p5.placements.getPlacement(inst.elementId);

    expect(restoredSys).toBeDefined();
    expect(restoredSys?.displayName).toBe('Main Landing Gear System');
    expect(restoredInst).toBeDefined();
    expect(restoredInst?.definitionId).toBe('comp:def:CYLINDER_BARREL');
    expect(restoredPlacement).toBeDefined();
    expect(restoredPlacement?.transform.translation.x).toBe(2.1);
  });
});
