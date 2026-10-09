/**
 * SECP CAD Kernel — Persistent Topology Identity Tests
 * Phase 2 (PATCH-KERNEL-005)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { BRepSolid } from '../../topology/BRepTopology';
import { PersistentTopologyNaming } from '../../topology/PersistentTopologyNaming';
import { TopologyReference } from '../FeatureDefinition';

describe('PATCH-KERNEL-005 — Persistent Topology Identity', () => {
  it('TEST-01: Generates persistent topological references with entityType, persistentId, and lineage', () => {
    const history = new FeatureHistory('DOC_PERSISTENT_TOPO_001');

    // 1. Sketch profile
    history.addFeature('SKETCH', 'Sketch001', {
      type: 'SKETCH',
      name: 'Sketch001',
      parameters: {
        plane: 'XY',
        closedProfile: true,
        entities: [
          { type: 'LINE', id: 'L1', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
          { type: 'LINE', id: 'L2', points: [{ x: 40, y: 0 }, { x: 40, y: 20 }] },
          { type: 'LINE', id: 'L3', points: [{ x: 40, y: 20 }, { x: 0, y: 20 }] },
          { type: 'LINE', id: 'L4', points: [{ x: 0, y: 20 }, { x: 0, y: 0 }] }
        ]
      },
      inputReferences: []
    }, [], undefined, 'Sketch001');

    // 2. Extrude feature
    const extrudeNode = history.addFeature('EXTRUDE', 'Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 20
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    }, ['Sketch001'], 'Sketch001', 'Extrude001');

    const result = history.regenerate();
    expect(result.success).toBe(true);

    const solid = extrudeNode.outputGeometry as BRepSolid;
    expect(solid).toBeDefined();

    const outputRefs = extrudeNode.outputReferences as TopologyReference[];
    expect(outputRefs.length).toBeGreaterThan(0);

    // Verify face references do NOT use random generic tags
    const capStartRef = outputRefs.find(r => r.persistentId === 'Extrude001:FACE:CapStart');
    const capEndRef = outputRefs.find(r => r.persistentId === 'Extrude001:FACE:CapEnd');

    expect(capStartRef).toBeDefined();
    expect(capStartRef?.entityType).toBe('FACE');
    expect(capStartRef?.lineage).toBeDefined();
    expect(capStartRef?.lineage.createdByFeature).toBe('Extrude001');
    expect(capStartRef?.lineage.sourceEntities).toContain('CapStart');
    expect(capStartRef?.lineage.geometricSignature).toContain('FACE|NORM:0.000,0.000,-1.000');

    expect(capEndRef).toBeDefined();
    expect(capEndRef?.entityType).toBe('FACE');
    expect(capEndRef?.lineage.createdByFeature).toBe('Extrude001');
    expect(capEndRef?.lineage.sourceEntities).toContain('CapEnd');
    expect(capEndRef?.lineage.geometricSignature).toContain('FACE|NORM:0.000,0.000,1.000');
  });

  it('TEST-02: Preserves topological identity across feature modification (Extrude 20 mm -> 40 mm)', () => {
    const history = new FeatureHistory('DOC_TOPO_MODIFICATION_001');

    history.addFeature('SKETCH', 'Sketch001', {
      type: 'SKETCH',
      name: 'Sketch001',
      parameters: {
        plane: 'XY',
        closedProfile: true,
        entities: [
          { type: 'LINE', id: 'L1', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
          { type: 'LINE', id: 'L2', points: [{ x: 50, y: 0 }, { x: 50, y: 30 }] },
          { type: 'LINE', id: 'L3', points: [{ x: 50, y: 30 }, { x: 0, y: 30 }] },
          { type: 'LINE', id: 'L4', points: [{ x: 0, y: 30 }, { x: 0, y: 0 }] }
        ]
      },
      inputReferences: []
    }, [], undefined, 'Sketch001');

    const extrudeNode = history.addFeature('EXTRUDE', 'Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 20
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    }, ['Sketch001'], 'Sketch001', 'Extrude001');

    // First evaluation at depth = 20 mm
    history.regenerate();
    const initialSolid = extrudeNode.outputGeometry as BRepSolid;
    const initialCapEndRef = (extrudeNode.outputReferences as TopologyReference[]).find(r => r.persistentId === 'Extrude001:FACE:CapEnd')!;

    expect(initialCapEndRef).toBeDefined();

    // Modify depth parameter from 20 mm to 40 mm
    extrudeNode.updateDefinition({
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 40
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    });

    // Regenerate feature tree
    const regenResult = history.regenerate();
    expect(regenResult.success).toBe(true);

    const updatedSolid = extrudeNode.outputGeometry as BRepSolid;
    expect(updatedSolid).toBeDefined();

    // Resolve initial CapEnd reference against updated solid after geometry change
    const resolvedFace = PersistentTopologyNaming.resolveTopologyReference(initialCapEndRef, updatedSolid);
    expect(resolvedFace).toBeDefined();
    expect(resolvedFace?.persistentId).toBe('Extrude001:FACE:CapEnd');
    expect(resolvedFace?.lineage?.createdByFeature).toBe('Extrude001');
  });
});
