import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../../engine/cad-kernel/history/FeatureHistory';
import { TopologyLineageProofEngine } from '../../../engine/topology/TopologyLineageProofEngine';
import { Solid, Face } from '../../../engine/cad-kernel/topology/TopologyContracts';

describe('PROMPT-062 — CAM Topology Associativity Proof', () => {
  it('CAM-001: CAM Toolpath reference is stale when target face mutates', async () => {
    const history = new FeatureHistory('DOC-CAM');
    const sketch = history.addFeature('SKETCH', 'SK_01', {
      type: 'SKETCH', name: 'SK_01',
      parameters: { plane: 'XY', closedProfile: true, entities: [{ type: 'LINE', id: 'L1', points: [{x:0, y:0}, {x:100, y:0}]}, { type: 'LINE', id: 'L2', points: [{x:100, y:0}, {x:100, y:100}]}, { type: 'LINE', id: 'L3', points: [{x:100, y:100}, {x:0, y:100}]}, { type: 'LINE', id: 'L4', points: [{x:0, y:100}, {x:0, y:0}]} ] }
    }, [], undefined, 'SK_01');
    const extrude = history.addFeature('EXTRUDE', 'EXT_01', {
      type: 'EXTRUDE', name: 'EXT_01',
      parameters: { depth: 50, profileId: 'SK_01' },
    }, [sketch.id]);
    
    const r1 = history.regenerate({ forceAll: true });
    expect(r1.success).toBe(true);
    const solid1 = extrude.outputGeometry as Solid;
    
    // Top face chosen for facing operation
    const topFace = solid1.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))?.face;
    const canonicalRef = TopologyLineageProofEngine.createFaceReference(
      { documentId: 'DOC-CAM', revision: 1 } as any,
      extrude.id,
      topFace!
    );

    // Mutate part: change depth to 45
    history.updateFeatureDefinition(extrude.id, {
      type: 'EXTRUDE', name: 'EXT_01',
      parameters: { depth: 45, profileId: 'SK_01' },
    });
    const r2 = history.regenerate({ forceAll: true });
    expect(r2.success).toBe(true);
    const solid2 = extrude.outputGeometry as Solid;
    
    // Resolve for CAM recompute
    const resolveResult = TopologyLineageProofEngine.rebindReference(canonicalRef, solid2, 2);
    
    expect(resolveResult.success).toBe(true);
    expect(resolveResult.state).toBe('REBOUND'); // Depth changed -> REFERENCE_CHANGED/REBOUND
    expect(resolveResult.reboundEntity).toBeDefined();
    // Verify it detects that geometry signature changed, marking toolpath STALE / INVALIDATED
    expect(resolveResult.reboundReference.geometricSignature).not.toEqual(canonicalRef.geometricSignature);
  });
});
