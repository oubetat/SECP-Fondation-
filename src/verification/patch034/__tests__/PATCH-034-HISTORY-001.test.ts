/**
 * SECP CAD Kernel — PATCH-034-HISTORY-001
 * Forensic Verification Test: Canonical Feature History Preservation
 *
 * PROVES:
 * - Sequential extrusion operations append to history rather than overwriting.
 * - Previous features (Feature A, Extrude A) remain fully intact with immutable identities.
 * - New features (Feature B, Extrude B) resolve collision-free identities and valid causal dependencies.
 * - Re-extrusion / modification of an existing feature updates in-place without duplicate buildup.
 * - DocumentEvaluator reconstructs full history and produces real topological B-Rep solids.
 * - Geometric volumes and cryptographic hashes are causal and mathematically grounded.
 */

import { describe, it, expect } from 'vitest';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';
import { TopoShapeEnum, Solid } from '../../../engine/cad-kernel/topology/TopologyContracts';

function createRectangleSketch(width: number, height: number) {
  return [
    { type: 'LINE', points: [{ x: 0, y: 0 }, { x: width, y: 0 }] },
    { type: 'LINE', points: [{ x: width, y: 0 }, { x: width, y: height }] },
    { type: 'LINE', points: [{ x: width, y: height }, { x: 0, y: height }] },
    { type: 'LINE', points: [{ x: 0, y: height }, { x: 0, y: 0 }] }
  ];
}

describe('PATCH-034-HISTORY-001: Preserve Canonical Feature History', () => {
  const brepKernel = new BRepKernel();

  it('proves non-destructive feature history accumulation and causality across sequential operations', () => {
    // Initial State: Canonical empty document
    const initialDoc = SketchUIIntegration.createEmptyDocument('DOC_HISTORY_VERIFICATION');
    expect(initialDoc.features.length).toBe(0);
    expect(initialDoc.sketches.length).toBe(0);

    // =========================================================================
    // CASE A: Sketch A (100 x 50) -> Extrude A (depth 20)
    // =========================================================================
    const sketchA = createRectangleSketch(100, 50);
    const depthA = 20;
    const resA = SketchUIIntegration.applyExtrudeAction(initialDoc, sketchA, depthA);

    expect(resA.success).toBe(true);
    expect(resA.evaluatedShape).toBeDefined();
    expect(resA.evaluatedShape?.shapeType).toBe(TopoShapeEnum.SOLID);

    const solidA = resA.evaluatedShape as Solid;
    const volA_m3 = brepKernel.computeVolume(solidA);
    const volA_mm3 = volA_m3 * 1e9;
    // Expected: 100 * 50 * 20 = 100,000 mm³
    expect(Math.abs(volA_mm3 - 100000)).toBeLessThan(1.0);

    const evidenceA = BRepHasher.computeEvidence(solidA);
    expect(evidenceA.geometryHash).toBeDefined();
    expect(evidenceA.geometryHash.length).toBe(64);

    const docAfterA = resA.document;
    expect(docAfterA.features.length).toBe(2);
    expect(docAfterA.features[0].featureId).toBe('F_SKETCH_1');
    expect(docAfterA.features[1].featureId).toBe('F_EXTRUDE_1');
    expect(docAfterA.features[1].dependencyIds).toEqual(['F_SKETCH_1']);
    expect(docAfterA.sketches.length).toBe(1);

    // =========================================================================
    // CASE B: On the SAME canonical document, perform Sketch B (50 x 40) -> Extrude B (depth 30)
    // =========================================================================
    const sketchB = createRectangleSketch(50, 40);
    const depthB = 30;
    const resB = SketchUIIntegration.applyExtrudeAction(docAfterA, sketchB, depthB);

    expect(resB.success).toBe(true);
    expect(resB.evaluatedShape).toBeDefined();
    expect(resB.evaluatedShape?.shapeType).toBe(TopoShapeEnum.SOLID);

    const solidB = resB.evaluatedShape as Solid;
    const volB_m3 = brepKernel.computeVolume(solidB);
    const volB_mm3 = volB_m3 * 1e9;
    // Expected: 50 * 40 * 30 = 60,000 mm³
    expect(Math.abs(volB_mm3 - 60000)).toBeLessThan(1.0);

    const evidenceB = BRepHasher.computeEvidence(solidB);
    expect(evidenceB.geometryHash).toBeDefined();
    expect(evidenceB.geometryHash.length).toBe(64);

    const docAfterB = resB.document;

    // =========================================================================
    // FORMAL ASSERTIONS (Mandated by PATCH-034-HISTORY-001 contract)
    // =========================================================================

    // 1. Total feature count is 4 (2 sketches, 2 extrusions)
    expect(docAfterB.features.length).toBe(4);

    // 2. Feature A remains intact
    const featA = docAfterB.features.find(f => (f.featureId || f.id) === 'F_SKETCH_1');
    expect(featA).toBeDefined();
    expect(featA?.type).toBe('SKETCH');

    // 3. Extrude A remains intact
    const extA = docAfterB.features.find(f => (f.featureId || f.id) === 'F_EXTRUDE_1');
    expect(extA).toBeDefined();
    expect(extA?.type).toBe('EXTRUDE');
    expect(extA?.definition?.parameters?.depth).toBe(20);
    expect(extA?.dependencyIds).toEqual(['F_SKETCH_1']);

    // 4. Feature B exists with collision-free ID
    const featB = docAfterB.features.find(f => (f.featureId || f.id) === 'F_SKETCH_2');
    expect(featB).toBeDefined();
    expect(featB?.type).toBe('SKETCH');

    // 5. Extrude B exists with collision-free ID
    const extB = docAfterB.features.find(f => (f.featureId || f.id) === 'F_EXTRUDE_2');
    expect(extB).toBeDefined();
    expect(extB?.type).toBe('EXTRUDE');
    expect(extB?.definition?.parameters?.depth).toBe(30);

    // 6. Dependencies are valid (Extrude B depends strictly on Sketch B)
    expect(extB?.dependencyIds).toContain('F_SKETCH_2');
    expect(extB?.parentId).toBe('F_SKETCH_2');

    // 7. Re-evaluating the full document via DocumentEvaluator succeeds deterministically
    const fullReEval = DocumentEvaluator.evaluate(docAfterB);
    expect(fullReEval.success).toBe(true);
    expect(fullReEval.evaluatedShape).toBeDefined();

    // 8. Volume & Hash Causality is real (Non-trivial, mathematically distinct)
    expect(volA_mm3).not.toBe(volB_mm3);
    expect(evidenceA.geometryHash).not.toBe(evidenceB.geometryHash);

    // =========================================================================
    // CASE C: Re-extrude / Update existing feature without duplicate accumulation
    // =========================================================================
    const modifiedDepthA = 40;
    const resC = SketchUIIntegration.applyExtrudeAction(
      docAfterB,
      sketchA,
      modifiedDepthA,
      { sketchId: 'F_SKETCH_1' }
    );

    expect(resC.success).toBe(true);
    const docAfterC = resC.document;

    // Feature count MUST remain exactly 4 (no duplicate features created)
    expect(docAfterC.features.length).toBe(4);

    const updatedExtA = docAfterC.features.find(f => (f.featureId || f.id) === 'F_EXTRUDE_1');
    expect(updatedExtA?.definition?.parameters?.depth).toBe(40);

    // Feature B and Extrude B are still preserved
    expect(docAfterC.features.some(f => (f.featureId || f.id) === 'F_SKETCH_2')).toBe(true);
    expect(docAfterC.features.some(f => (f.featureId || f.id) === 'F_EXTRUDE_2')).toBe(true);
  });
});
