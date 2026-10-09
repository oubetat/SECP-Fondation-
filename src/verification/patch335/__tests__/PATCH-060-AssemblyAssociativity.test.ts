import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../../engine/cad-kernel/history/FeatureHistory';
import { PersistentTopologyNaming } from '../../../engine/cad-kernel/topology/PersistentTopologyNaming';
import { TopologyLineageProofEngine } from '../../../engine/topology/TopologyLineageProofEngine';
import { Solid, Face } from '../../../engine/cad-kernel/topology/TopologyContracts';

describe('PROMPT-060-A — Assembly Topology Associativity Proof', () => {
  it('ASSEMBLY-001: Assembly joint maintains canonical lineage when part geometry is mutated', async () => {
    const history = new FeatureHistory('DOC-ASSEMBLY-A');
    const sketch = history.addFeature('SKETCH', 'SK_01', {
      type: 'SKETCH', name: 'SK_01',
      parameters: { plane: 'XY', closedProfile: true, entities: [{ type: 'LINE', id: 'L1', points: [{x:0, y:0}, {x:50, y:0}]}, { type: 'LINE', id: 'L2', points: [{x:50, y:0}, {x:50, y:50}]}, { type: 'LINE', id: 'L3', points: [{x:50, y:50}, {x:0, y:50}]}, { type: 'LINE', id: 'L4', points: [{x:0, y:50}, {x:0, y:0}]} ] }
    }, [], undefined, 'SK_01');
    const extrude = history.addFeature('EXTRUDE', 'EXT_01', {
      type: 'EXTRUDE', name: 'EXT_01',
      parameters: { depth: 25, profileId: 'SK_01' },
    }, [sketch.id]);
    
    const r1 = history.regenerate({ forceAll: true });
    expect(r1.success).toBe(true);
    const solid1 = extrude.outputGeometry as Solid;
    
    const topFace = solid1.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))?.face;
    expect(topFace).toBeDefined();
    
    const canonicalRef = TopologyLineageProofEngine.createFaceReference(
      { documentId: 'DOC-ASSEMBLY-A', revision: 1 } as any,
      extrude.id,
      topFace!
    );

    history.updateFeatureDefinition(extrude.id, {
      type: 'EXTRUDE', name: 'EXT_01',
      parameters: { depth: 40, profileId: 'SK_01' },
    });
    const r2 = history.regenerate({ forceAll: true });
    expect(r2.success).toBe(true);
    const solid2 = extrude.outputGeometry as Solid;
    
    const resolveResult = TopologyLineageProofEngine.rebindReference(canonicalRef, solid2, 2);
    
    expect(resolveResult.success).toBe(true);
    expect(resolveResult.state).toBe('REBOUND'); 
    expect(resolveResult.reboundEntity).toBeDefined();
    expect(resolveResult.reboundReference.documentRevision).toBe(2);
    expect(resolveResult.reboundReference.geometricSignature).not.toEqual(canonicalRef.geometricSignature);
    expect(resolveResult.reboundReference.lineage.createdByFeature).toBe(extrude.id);
  });
});
