import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../../engine/cad-kernel/history/FeatureHistory';
import { FeatureRegenerator } from '../../../engine/cad-kernel/history/FeatureRegenerator';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';

describe('PATCH-034-KERNEL-INTEGRATION-001 — Genuine Feature Regeneration & B-Rep Causal Links', () => {
  it('TEST-01: Sketch -> Extrude -> Modify -> Regenerate (Full Causal Trace)', () => {
    const history = new FeatureHistory('DOC_INT_001');
    const brepKernel = new BRepKernel();

    // 1. Create a Sketch Feature
    const sketchFeat = history.addFeature(
      'SKETCH',
      'Base_Rectangle',
      {
        type: 'SKETCH',
        name: 'Base_Rectangle',
        parameters: {
          plane: 'XY',
          closedProfile: true,
          entities: [
            { type: 'LINE', id: 'L1', data: { x1: 0, y1: 0, x2: 100, y2: 0 } },
            { type: 'LINE', id: 'L2', data: { x1: 100, y1: 0, x2: 100, y2: 50 } },
            { type: 'LINE', id: 'L3', data: { x1: 100, y1: 50, x2: 0, y2: 50 } },
            { type: 'LINE', id: 'L4', data: { x1: 0, y1: 50, x2: 0, y2: 0 } }
          ]
        },
        inputReferences: []
      },
      [],
      undefined,
      'F_SKETCH_1'
    );

    // 2. Extrude Boss (20mm)
    const extrudeFeat = history.addFeature(
      'EXTRUDE',
      'Boss_Extrude',
      {
        type: 'EXTRUDE',
        name: 'Boss_Extrude',
        parameters: {
          sketchId: 'F_SKETCH_1',
          depth: 20
        },
        inputReferences: []
      },
      ['F_SKETCH_1'],
      undefined,
      'F_EXTRUDE_1'
    );

    // 3. Regenerate
    const regen1 = FeatureRegenerator.regenerate(
      history.documentId,
      history.getAllFeatures(),
      history.getGraph()
    );

    expect(regen1.success).toBe(true);
    expect(regen1.executedFeatureIds).toContain('F_SKETCH_1');
    expect(regen1.executedFeatureIds).toContain('F_EXTRUDE_1');

    const solid20 = regen1.finalGeometry;
    expect(solid20).toBeDefined();

    // 4. Hash Measurement (V1)
    const evidence20 = BRepHasher.computeEvidence(solid20);
    expect(evidence20.geometryHash).toBeDefined();

    // Check if the coordinates are in m or mm by looking at the raw output volume. 
    // If it's already 100,000, then coordinates were in mm.
    let rawVol20 = brepKernel.computeVolume(solid20 as any);
    const vol20 = rawVol20 < 1 ? rawVol20 * 1e9 : rawVol20;
    
    console.log('volume20Mm3:', vol20);
    console.log('geometryHash20:', evidence20.geometryHash);
    console.log('topologyHash20:', evidence20.topologyHash);
    
    expect(Math.round(vol20)).toBe(100000);

    // 5. Modify Extrude Depth to 40mm
    extrudeFeat.definition.parameters.depth = 40;
    extrudeFeat.updateDefinition(extrudeFeat.definition);
    extrudeFeat.state = 'STALE';

    // 6. Regenerate
    const regen2 = FeatureRegenerator.regenerate(
      history.documentId,
      history.getAllFeatures(),
      history.getGraph()
    );

    if (!regen2.success) {
      console.error(regen2.diagnostics);
    }
    expect(regen2.success).toBe(true);
    const solid40 = regen2.finalGeometry;
    expect(solid40).toBeDefined();

    // 7. Hash Measurement (V2)
    const evidence40 = BRepHasher.computeEvidence(solid40);
    
    let rawVol40 = brepKernel.computeVolume(solid40 as any);
    const vol40 = rawVol40 < 1 ? rawVol40 * 1e9 : rawVol40;

    console.log('volume40Mm3:', vol40);
    console.log('geometryHash40:', evidence40.geometryHash);
    console.log('topologyHash40:', evidence40.topologyHash);
    
    expect(Math.round(vol40)).toBe(200000);

    // Proof of Real Causal Change: Parameter -> Volume -> Geometry -> Topology -> Hash
    expect(Math.round(vol20)).not.toEqual(Math.round(vol40));

    // Proof of Real Causal Change: Geometry must change, topology must be identical
    expect(evidence20.geometryHash).not.toEqual(evidence40.geometryHash);
    expect(evidence20.topologyHash).toEqual(evidence40.topologyHash);

    // ==========================================
    // 8. UNDO (Revert Extrude Depth back to 20mm)
    // ==========================================
    extrudeFeat.definition.parameters.depth = 20;
    extrudeFeat.updateDefinition(extrudeFeat.definition);
    extrudeFeat.state = 'STALE';

    const regenUndo = FeatureRegenerator.regenerate(
      history.documentId,
      history.getAllFeatures(),
      history.getGraph()
    );
    expect(regenUndo.success).toBe(true);

    const evidenceUndo = BRepHasher.computeEvidence(regenUndo.finalGeometry);
    let rawVolUndo = brepKernel.computeVolume(regenUndo.finalGeometry as any);
    const volUndo = rawVolUndo < 1 ? rawVolUndo * 1e9 : rawVolUndo;
    expect(Math.round(volUndo)).toBe(100000);

    // Proof of Undo: The engineering state perfectly restores to V1
    expect(evidenceUndo.geometryHash).toEqual(evidence20.geometryHash);
    expect(evidenceUndo.topologyHash).toEqual(evidence20.topologyHash);

    // ==========================================
    // 9. REDO (Revert Extrude Depth back to 40mm)
    // ==========================================
    extrudeFeat.definition.parameters.depth = 40;
    extrudeFeat.updateDefinition(extrudeFeat.definition);
    extrudeFeat.state = 'STALE';

    const regenRedo = FeatureRegenerator.regenerate(
      history.documentId,
      history.getAllFeatures(),
      history.getGraph()
    );
    expect(regenRedo.success).toBe(true);

    const evidenceRedo = BRepHasher.computeEvidence(regenRedo.finalGeometry);
    let rawVolRedo = brepKernel.computeVolume(regenRedo.finalGeometry as any);
    const volRedo = rawVolRedo < 1 ? rawVolRedo * 1e9 : rawVolRedo;
    expect(Math.round(volRedo)).toBe(200000);

    // Proof of Redo: The engineering state perfectly restores to V2
    expect(evidenceRedo.geometryHash).toEqual(evidence40.geometryHash);
    expect(evidenceRedo.topologyHash).toEqual(evidence40.topologyHash);
  });
});
