import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';

describe('PATCH-034-SOT-002-SUB32 — Intent Decoupling & Canonical Evaluation Causality', () => {
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
      revision: baseDoc.revision + 1
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
      revision: baseDoc.revision + 2
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

  it('TEST-03: Engineering Truth - EngineeringDocument.parameters is the Sole Authoritative SOT driving Feature Parameters', () => {
    const baseDoc: EngineeringDocument = SketchUIIntegration.createEmptyDocument('DOC_SOT_TRUTH');

    // Feature definition explicitly binds to parameter names 'Length', 'Width', 'Height'
    // It does NOT have its own autonomous dimensions!
    const featureWithParamBindings = {
      id: 'FEAT_BOX_BOUND',
      name: 'Bound_Extrude',
      type: 'EXTRUDE',
      definition: {
        type: 'EXTRUDE',
        name: 'Bound_Extrude',
        parameters: {
          width: 'Length',
          height: 'Width',
          depth: 'Height'
        },
        inputReferences: [],
        dependencyIds: []
      }
    };

    // Revision 1: Length=300, Width=100, Height=50
    const docRev1: EngineeringDocument = {
      ...baseDoc,
      parameters: [
        { id: 'P_LEN', name: 'Length', expression: '300', value: 300, unit: 'mm' },
        { id: 'P_WID', name: 'Width', expression: '100', value: 100, unit: 'mm' },
        { id: 'P_HGT', name: 'Height', expression: '50', value: 50, unit: 'mm' }
      ],
      features: [featureWithParamBindings],
      revision: 1
    };

    const res1 = DocumentEvaluator.evaluate(docRev1);
    expect(res1.success).toBe(true);
    const rawVol1 = brepKernel.computeVolume(res1.evaluatedShape as any);
    const vol1 = Math.round(rawVol1 < 1 ? rawVol1 * 1e9 : rawVol1);
    expect(vol1).toBe(300 * 100 * 50); // 1,500,000 mm3

    // Revision 2: SOT Mutation - ONLY EngineeringDocument.parameters changes.
    // The Feature definition remains identical!
    const docRev2: EngineeringDocument = {
      ...docRev1,
      parameters: [
        { id: 'P_LEN', name: 'Length', expression: '300', value: 300, unit: 'mm' },
        { id: 'P_WID', name: 'Width', expression: '100', value: 100, unit: 'mm' },
        { id: 'P_HGT', name: 'Height', expression: '100', value: 100, unit: 'mm' } // Height doubled
      ],
      revision: 2
    };

    const res2 = DocumentEvaluator.evaluate(docRev2);
    expect(res2.success).toBe(true);
    const rawVol2 = brepKernel.computeVolume(res2.evaluatedShape as any);
    const vol2 = Math.round(rawVol2 < 1 ? rawVol2 * 1e9 : rawVol2);
    expect(vol2).toBe(300 * 100 * 100); // 3,000,000 mm3
    expect(vol2).toBe(2 * vol1);

    const ev1 = BRepHasher.computeEvidence(res1.evaluatedShape as any);
    const ev2 = BRepHasher.computeEvidence(res2.evaluatedShape as any);
    expect(ev1.geometryHash).not.toEqual(ev2.geometryHash);
    expect(ev1.topologyHash).toEqual(ev2.topologyHash);
  });
});
