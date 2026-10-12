import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../../engine/cad-kernel/document/CADDocument';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';

describe('PATCH-034-SOT-001-SUB32-STEP2A — Intent Decoupling & Canonical Evaluation Causality', () => {
  const brepKernel = new BRepKernel();

  it('TEST-01: ParametricModelingPanel Intent (Length/Width/Height) -> Canonical Document -> Deterministic Causality', () => {
    // Canonical document creation
    const baseDoc: EngineeringDocument = SketchUIIntegration.createEmptyDocument('DOC_PARAMETRIC_TEST');

    // Intent A: Length=100, Width=50, Height=20
    const paramsA = { Length: 100, Width: 50, Height: 20 };
    const docA: EngineeringDocument = {
      ...baseDoc,
      parameters: [
        { id: 'PARAM_LENGTH', name: 'Length', expression: String(paramsA.Length), value: paramsA.Length, unit: 'mm' },
        { id: 'PARAM_WIDTH', name: 'Width', expression: String(paramsA.Width), value: paramsA.Width, unit: 'mm' },
        { id: 'PARAM_HEIGHT', name: 'Height', expression: String(paramsA.Height), value: paramsA.Height, unit: 'mm' }
      ],
      features: [
        {
          id: 'FEAT_PARAMETRIC_BOX',
          name: 'Parametric_Extrude',
          type: 'EXTRUDE',
          definition: {
            type: 'EXTRUDE',
            name: 'Parametric_Extrude',
            parameters: {
              width: paramsA.Length,
              height: paramsA.Width,
              depth: paramsA.Height
            },
            inputReferences: [],
            dependencyIds: []
          }
        }
      ],
      revision: Number(baseDoc.revision) + 1
    };

    const resA = DocumentEvaluator.evaluate(docA);
    expect(resA.success).toBe(true);
    expect(resA.evaluatedShape).toBeDefined();

    const solidA = resA.evaluatedShape as any;
    const rawVolA = brepKernel.computeVolume(solidA);
    const volA = Math.round(rawVolA < 1 ? rawVolA * 1e9 : rawVolA);
    const evA = BRepHasher.computeEvidence(solidA);

    // Intent B: Height changes from 20 to 40 (double height)
    const paramsB = { Length: 100, Width: 50, Height: 40 };
    const docB: EngineeringDocument = {
      ...baseDoc,
      parameters: [
        { id: 'PARAM_LENGTH', name: 'Length', expression: String(paramsB.Length), value: paramsB.Length, unit: 'mm' },
        { id: 'PARAM_WIDTH', name: 'Width', expression: String(paramsB.Width), value: paramsB.Width, unit: 'mm' },
        { id: 'PARAM_HEIGHT', name: 'Height', expression: String(paramsB.Height), value: paramsB.Height, unit: 'mm' }
      ],
      features: [
        {
          id: 'FEAT_PARAMETRIC_BOX',
          name: 'Parametric_Extrude',
          type: 'EXTRUDE',
          definition: {
            type: 'EXTRUDE',
            name: 'Parametric_Extrude',
            parameters: {
              width: paramsB.Length,
              height: paramsB.Width,
              depth: paramsB.Height
            },
            inputReferences: [],
            dependencyIds: []
          }
        }
      ],
      revision: Number(baseDoc.revision) + 2
    };

    const resB = DocumentEvaluator.evaluate(docB);
    expect(resB.success).toBe(true);
    expect(resB.evaluatedShape).toBeDefined();

    const solidB = resB.evaluatedShape as any;
    const rawVolB = brepKernel.computeVolume(solidB);
    const volB = Math.round(rawVolB < 1 ? rawVolB * 1e9 : rawVolB);
    const evB = BRepHasher.computeEvidence(solidB);

    // Assert causal volume change (100*50*20 = 100,000; 100*50*40 = 200,000)
    expect(volA).toBe(100000);
    expect(volB).toBe(200000);
    expect(volB).toBe(2 * volA);

    // Assert geometry hash difference and topology lineage consistency
    expect(evA.geometryHash).not.toEqual(evB.geometryHash);
    expect(evA.topologyHash).toEqual(evB.topologyHash);
  });

  it('TEST-02: SketcherPanel Intent (sketchEntities + extrudeDepth) -> SketchUIIntegration -> Causal BRep', () => {
    const docA = SketchUIIntegration.createEmptyDocument('DOC_SKETCH_INTENT_A');
    const sketchEntities = [
      { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
      { type: 'LINE', points: [{ x: 200, y: 0 }, { x: 200, y: 120 }] },
      { type: 'LINE', points: [{ x: 200, y: 120 }, { x: 0, y: 120 }] },
      { type: 'LINE', points: [{ x: 0, y: 120 }, { x: 0, y: 0 }] }
    ];

    // Extrude depth 20
    const resA = SketchUIIntegration.applyExtrudeAction(docA, sketchEntities, 20);
    expect(resA.success).toBe(true);
    expect(resA.evaluatedShape).toBeDefined();

    const solidA = resA.evaluatedShape as any;
    const rawVolA = brepKernel.computeVolume(solidA);
    const volA = Math.round(rawVolA < 1 ? rawVolA * 1e9 : rawVolA);
    const evA = BRepHasher.computeEvidence(solidA);

    // Extrude depth 40
    const docB = SketchUIIntegration.createEmptyDocument('DOC_SKETCH_INTENT_B');
    const resB = SketchUIIntegration.applyExtrudeAction(docB, sketchEntities, 40);
    expect(resB.success).toBe(true);
    expect(resB.evaluatedShape).toBeDefined();

    const solidB = resB.evaluatedShape as any;
    const rawVolB = brepKernel.computeVolume(solidB);
    const volB = Math.round(rawVolB < 1 ? rawVolB * 1e9 : rawVolB);
    const evB = BRepHasher.computeEvidence(solidB);

    // Assert causal volume doubling (200*120*20 = 480,000; 200*120*40 = 960,000)
    expect(volA).toBe(480000);
    expect(volB).toBe(960000);
    expect(volB).toBe(2 * volA);

    // Assert hash change
    expect(evA.geometryHash).not.toEqual(evB.geometryHash);
    expect(evA.topologyHash).toEqual(evB.topologyHash);
  });
});
