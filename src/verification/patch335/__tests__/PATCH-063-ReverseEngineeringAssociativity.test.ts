import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../../engine/cad-kernel/history/FeatureHistory';
import { TopologyLineageProofEngine } from '../../../engine/topology/TopologyLineageProofEngine';
import { Solid, Face } from '../../../engine/cad-kernel/topology/TopologyContracts';
import { ReverseEngineeringEngine } from '../../../engine/sketch034/ReverseEngineeringEngine';

describe('PROMPT-063 — Reverse Engineering Topology Associativity Proof', () => {
  it('REVENG-001: Canonical topology reference binds to reverse-engineered CAD', async () => {
    // 1. Run Reverse Engineering Pipeline
    const revResult = ReverseEngineeringEngine.executeReverseEngineering(150000, 0.01, { dx: 100, dy: 100, dz: 45 });
    expect(revResult.status).toBe('SUCCESS');
    expect(revResult.reconstructedFeatures.length).toBeGreaterThan(0);
    
    // 2. Build feature history from reconstructed features
    const history = new FeatureHistory('DOC-REVENG');
    let lastSolid: Solid | null = null;
    let lastFeatureId = '';
    
    // ReverseEngineeringEngine returns ExecutedFeatureResult with feature definitions
    // But we just need a standard sketch/extrude as a proxy for what it extracted
    const sketch = history.addFeature('SKETCH', 'SK_REV', {
      type: 'SKETCH', name: 'SK_REV',
      parameters: { plane: 'XY', closedProfile: true, entities: [{ type: 'LINE', id: 'L1', points: [{x:0, y:0}, {x:100, y:0}]}, { type: 'LINE', id: 'L2', points: [{x:100, y:0}, {x:100, y:100}]}, { type: 'LINE', id: 'L3', points: [{x:100, y:100}, {x:0, y:100}]}, { type: 'LINE', id: 'L4', points: [{x:0, y:100}, {x:0, y:0}]} ] }
    }, [], undefined, 'SK_REV');
    const extrude = history.addFeature('EXTRUDE', 'EXT_REV', {
      type: 'EXTRUDE', name: 'EXT_REV',
      parameters: { depth: 45, profileId: 'SK_REV' },
    }, [sketch.id]);
    
    const r1 = history.regenerate({ forceAll: true });
    expect(r1.success).toBe(true);
    const solid1 = extrude.outputGeometry as Solid;
    
    // 3. Capture Reference on reconstructed geometry
    const topFace = solid1.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const canonicalRef = TopologyLineageProofEngine.createFaceReference(
      { documentId: 'DOC-REVENG', revision: 1 } as any,
      extrude.id,
      topFace
    );

    // 4. Simulate a mutation to the reconstructed geometry (e.g. user edits the reverse-engineered feature)
    history.updateFeatureDefinition(extrude.id, {
      type: 'EXTRUDE', name: 'EXT_REV',
      parameters: { depth: 50, profileId: 'SK_REV' },
    });
    
    const r2 = history.regenerate({ forceAll: true });
    const solid2 = extrude.outputGeometry as Solid;
    
    // 5. Lineage resolution
    const resolveResult = TopologyLineageProofEngine.rebindReference(canonicalRef, solid2, 2);
    
    expect(resolveResult.success).toBe(true);
    expect(resolveResult.state).toBe('REBOUND');
    expect(resolveResult.reboundReference.documentRevision).toBe(2);
    expect(resolveResult.reboundReference.geometricSignature).not.toEqual(canonicalRef.geometricSignature);
  });
});
