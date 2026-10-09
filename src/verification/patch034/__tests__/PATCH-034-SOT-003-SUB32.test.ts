import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';

describe('PATCH-034-SOT-003-SUB32 — Step 3A Legacy SketchEditor Canonical Migration', () => {
  const brepKernel = new BRepKernel();

  it('TEST-01: Extrude Causal Integrity (Depth Proportionality)', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('DOC_SKETCH_INTEGRITY');
    
    // Rectangle sketch profile
    const rectSketch = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 150, y: 0 }] },
      { type: 'LINE', points: [{ x: 150, y: 0 }, { x: 150, y: 80 }] },
      { type: 'LINE', points: [{ x: 150, y: 80 }, { x: 0, y: 80 }] },
      { type: 'LINE', points: [{ x: 0, y: 80 }, { x: 0, y: 0 }] }
    ];

    // Case A: Extrude depth = 30 mm (Volume should be 150 * 80 * 30 = 360,000 mm3)
    const resultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 30);
    expect(resultA.success).toBe(true);
    expect(resultA.evaluatedShape).toBeDefined();

    const rawVolA = brepKernel.computeVolume(resultA.evaluatedShape as any);
    const volA = Math.round(rawVolA < 1 ? rawVolA * 1e9 : rawVolA);
    expect(volA).toBe(360000);

    const hashA = BRepHasher.computeEvidence(resultA.evaluatedShape as any);

    // Case B: Extrude depth = 60 mm (Volume should be 150 * 80 * 60 = 720,000 mm3)
    const resultB = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 60);
    expect(resultB.success).toBe(true);
    expect(resultB.evaluatedShape).toBeDefined();

    const rawVolB = brepKernel.computeVolume(resultB.evaluatedShape as any);
    const volB = Math.round(rawVolB < 1 ? rawVolB * 1e9 : rawVolB);
    expect(volB).toBe(720000);

    const hashB = BRepHasher.computeEvidence(resultB.evaluatedShape as any);

    // Assert Causal Proportionality & Lineage Preservation
    expect(volB).toBe(2 * volA);
    expect(hashA.geometryHash).not.toEqual(hashB.geometryHash);
    expect(hashA.topologyHash).toEqual(hashB.topologyHash);
  });

  it('TEST-02: Sketch Geometry Causal Integrity (Geometry Change changes Geometry Hash)', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('DOC_GEOM_INTEGRITY');

    // Case A: Sketch geometry A (Square 100x100)
    const sketchA = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
      { type: 'LINE', points: [{ x: 100, y: 100 }, { x: 0, y: 100 }] },
      { type: 'LINE', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }] }
    ];
    const resultA = SketchUIIntegration.applyExtrudeAction(docBase, sketchA, 50);
    expect(resultA.success).toBe(true);
    
    const rawVolA = brepKernel.computeVolume(resultA.evaluatedShape as any);
    const volA = Math.round(rawVolA < 1 ? rawVolA * 1e9 : rawVolA);
    expect(volA).toBe(500000); // 100 * 100 * 50 = 500,000 mm3

    const hashA = BRepHasher.computeEvidence(resultA.evaluatedShape as any);

    // Case B: Sketch geometry B (Rectangular 100x200 - different layout)
    const sketchB = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 200 }] },
      { type: 'LINE', points: [{ x: 100, y: 200 }, { x: 0, y: 200 }] },
      { type: 'LINE', points: [{ x: 0, y: 200 }, { x: 0, y: 0 }] }
    ];
    const resultB = SketchUIIntegration.applyExtrudeAction(docBase, sketchB, 50);
    expect(resultB.success).toBe(true);

    const rawVolB = brepKernel.computeVolume(resultB.evaluatedShape as any);
    const volB = Math.round(rawVolB < 1 ? rawVolB * 1e9 : rawVolB);
    expect(volB).toBe(1000000); // 100 * 200 * 50 = 1,000,000 mm3

    const hashB = BRepHasher.computeEvidence(resultB.evaluatedShape as any);

    // Assert different geometry hash & different topology hash due to shape aspect ratio changes
    expect(volB).toBe(2 * volA);
    expect(hashA.geometryHash).not.toEqual(hashB.geometryHash);
  });
});
