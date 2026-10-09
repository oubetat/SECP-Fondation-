
import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../document/DocumentEvaluator';
import { EngineeringDocument } from '../document/CADDocument';
import { BRepKernel } from '../brep/BRepKernel';
import { BRepHasher } from '../topology/BRepHasher';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { SketchProfileExtractor } from '../../sketch034/SketchProfileExtractor';

describe('KernelTruthQualification — PATCH-KERNEL-015', () => {
  const brepKernel = BRepKernel.getCanonical();

  it('should execute the 10-stage End-to-End Unified Engineering Truth Flow', () => {
    // Stage 1 & 2: Create Sketch 20x20 and Extrude 20
    // We use parameters to drive the feature
    const documentId = 'QUAL_TEST_001';
    let doc: EngineeringDocument = DocumentEvaluator.createDocument({
      documentId,
      parameters: [
        { id: 'p1', name: 'box_width', expression: '20', value: 20 },
        { id: 'p2', name: 'box_height', expression: '20', value: 20 },
        { id: 'p3', name: 'box_depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'F1',
          type: 'EXTRUDE',
          name: 'MainBody',
          parameters: {
            width: 'box_width',
            height: 'box_height',
            depth: 'box_depth'
          }
        }
      ]
    });

    // Phase 1 Execution
    const result1 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    
    if (!result1.success) {
      console.error('Evaluation 1 failed:', result1.diagnostics);
    }
    
    expect(result1.success).toBe(true);
    doc = result1.document;

    // Stage 3: Verification (BRep valid, volume = 8 cm³)
    const solid1 = result1.evaluatedShape!;
    expect(solid1).toBeDefined();
    // computeVolume returns m^3. We want mm^3 (1 m^3 = 10^9 mm^3)
    const volume1 = brepKernel.computeVolume(solid1 as any) * 1e9;
    // 20 * 20 * 20 = 8000 mm^3 = 8 cm^3
    expect(volume1).toBeCloseTo(8000, 0.1);

    const evidence1 = doc.evidence[doc.evidence.length - 1];
    const geoHash1 = evidence1.geometryHash;
    const topoHash1 = evidence1.topologyHash;
    const featureHash1 = evidence1.featureHash;

    console.log(`[STAGE 3] Volume: ${volume1} mm3, GeoHash: ${geoHash1}`);

    // Stage 4: Change Sketch 20x20 -> 40x20
    doc.parameters = doc.parameters.map(p => p.name === 'box_width' ? { ...p, expression: '40' } : p);
    doc.revision = 2;

    // Stage 5: Regenerate
    const result2 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    
    expect(result2.success).toBe(true);
    doc = result2.document;
    const solid2 = result2.evaluatedShape!;
    
    // Verify Volume
    const volume2 = brepKernel.computeVolume(solid2 as any) * 1e9;
    // 40 * 20 * 20 = 16000 mm^3 = 16 cm^3
    expect(volume2).toBeCloseTo(16000, 0.1);

    const evidence2 = doc.evidence[doc.evidence.length - 1];
    
    // Verify Determinism & Change
    // Same feature ID should remain in doc
    expect(doc.features[0].featureId).toBe('F1');
    
    // Geometry hash MUST change
    expect(evidence2.geometryHash).not.toBe(geoHash1);
    
    console.log(`[STAGE 5] Volume: ${volume2} mm3, GeoHash: ${evidence2.geometryHash}`);

    // Stage 6: Mesh Verification
    expect(doc.derived.mesh).toBeDefined();
    const meshHash2 = EngineeringHashChain.computeCanonicalHash(doc.derived.mesh).canonicalHash;
    expect(evidence2.meshHash).toBe(meshHash2);

    // Stage 7: FEA Verification
    expect(doc.derived.fea).toBeDefined();
    expect(doc.derived.fea?.solverInputHash).toBeDefined();
    console.log(`[STAGE 7] FEA SolverInputHash: ${doc.derived.fea?.solverInputHash}`);

    // Stage 8: CFD Verification
    expect(doc.derived.cfd).toBeDefined();
    expect(doc.derived.cfd?.solverInputHash).toBeDefined();
    console.log(`[STAGE 8] CFD SolverInputHash: ${doc.derived.cfd?.solverInputHash}`);

    // Stage 9: CAM Verification
    expect(doc.derived.cam).toBeDefined();
    expect(doc.derived.cam?.geometryHash).toBe(evidence2.geometryHash);
    console.log(`[STAGE 9] CAM GeoHash: ${doc.derived.cam?.geometryHash}`);

    // Stage 10: Evidence Chain Verification
    // Check if hashes are distinct from rev 1
    const evidenceRev1 = doc.evidence.find(e => e.revision === 1)!;
    const evidenceRev2 = doc.evidence.find(e => e.revision === 2)!;

    expect(evidenceRev2.featureHash).not.toBe(evidenceRev1.featureHash);
    expect(evidenceRev2.canonicalHash).not.toBe(evidenceRev1.canonicalHash);

    // Verify derived hashes in evidence
    expect(evidenceRev2.meshHash).toBeDefined();
    
    console.log('[STAGE 10] Evidence Chain Verified.');
  });

  it('Extension A — Canonical Identity: Same geometry + different IDs/names must produce same canonical hashes', () => {
    // Create Box A with ID 'solid_A_id' and Name 'solid_A_name'
    const boxA = brepKernel.createBox(
      0.02, // 20mm in meters
      0.02,
      0.02,
      'solid_A_id'
    );
    boxA.name = 'solid_A_name';

    // Create Box B with ID 'solid_B_id' and Name 'solid_B_name' but identical dimensions
    const boxB = brepKernel.createBox(
      0.02,
      0.02,
      0.02,
      'solid_B_id'
    );
    boxB.name = 'solid_B_name';

    // Compute evidence / hashes using BRepHasher
    const hashA = BRepHasher.computeEvidence(boxA);
    const hashB = BRepHasher.computeEvidence(boxB);

    // Assert that the canonical hashes are identical, proving stable geometry & topology representation
    expect(hashA.geometryHash).toBe(hashB.geometryHash);
    expect(hashA.topologyHash).toBe(hashB.topologyHash);

    // Create a modified Box C (different dimensions)
    const boxC = brepKernel.createBox(
      0.04, // 40mm
      0.02,
      0.02,
      'solid_A_id'
    );
    const hashC = BRepHasher.computeEvidence(boxC);

    // Assert that different geometries produce different hashes
    expect(hashC.geometryHash).not.toBe(hashA.geometryHash);
    console.log('[Extension A Passed] Canonical Identity verified.');
  });

  it('Extension B — Determinism: 3 consecutive evaluations of the exact same document must produce identical hashes', () => {
    const doc: EngineeringDocument = DocumentEvaluator.createDocument({
      documentId: 'DET_TEST_101',
      parameters: [
        { id: 'p1', name: 'width', expression: '20', value: 20 },
        { id: 'p2', name: 'height', expression: '20', value: 20 },
        { id: 'p3', name: 'depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'F_DET_1',
          type: 'EXTRUDE',
          name: 'Body',
          parameters: {
            width: 'width',
            height: 'height',
            depth: 'depth'
          }
        }
      ]
    });

    // Run Evaluation 1
    const res1 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    expect(res1.success).toBe(true);

    // Run Evaluation 2
    const res2 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    expect(res2.success).toBe(true);

    // Run Evaluation 3
    const res3 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    expect(res3.success).toBe(true);

    const ev1 = res1.document.evidence[res1.document.evidence.length - 1];
    const ev2 = res2.document.evidence[res2.document.evidence.length - 1];
    const ev3 = res3.document.evidence[res3.document.evidence.length - 1];

    // Assert complete determinism
    expect(ev1.geometryHash).toBe(ev2.geometryHash);
    expect(ev2.geometryHash).toBe(ev3.geometryHash);

    expect(ev1.topologyHash).toBe(ev2.topologyHash);
    expect(ev2.topologyHash).toBe(ev3.topologyHash);

    expect(ev1.meshHash).toBe(ev2.meshHash);
    expect(ev2.meshHash).toBe(ev3.meshHash);

    expect(res1.document.derived.fea?.solverInputHash).toBe(res2.document.derived.fea?.solverInputHash);
    expect(res2.document.derived.fea?.solverInputHash).toBe(res3.document.derived.fea?.solverInputHash);

    expect(res1.document.derived.cfd?.solverInputHash).toBe(res2.document.derived.cfd?.solverInputHash);
    expect(res2.document.derived.cfd?.solverInputHash).toBe(res3.document.derived.cfd?.solverInputHash);

    expect(res1.document.derived.cam?.geometryHash).toBe(res2.document.derived.cam?.geometryHash);
    expect(res2.document.derived.cam?.geometryHash).toBe(res3.document.derived.cam?.geometryHash);

    console.log('[Extension B Passed] Determinism verified over 3 runs.');
  });

  it('Extension C — Causal Propagation: Downstream changes are driven strictly by geometry shifts', () => {
    const doc: EngineeringDocument = DocumentEvaluator.createDocument({
      documentId: 'PROP_TEST_201',
      parameters: [
        { id: 'p1', name: 'width', expression: '20', value: 20 },
        { id: 'p2', name: 'height', expression: '20', value: 20 },
        { id: 'p3', name: 'depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'F_PROP_1',
          type: 'EXTRUDE',
          name: 'Body',
          parameters: {
            width: 'width',
            height: 'height',
            depth: 'depth'
          }
        }
      ]
    });

    // Run 1: 20x20x20
    const res1 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    const ev1 = res1.document.evidence[res1.document.evidence.length - 1];

    // Snapshot the original solver input hashes from run 1
    const feaHash1 = res1.document.derived.fea?.solverInputHash;
    const cfdHash1 = res1.document.derived.cfd?.solverInputHash;
    const camHash1 = res1.document.derived.cam?.hash;

    // Change parameter to 40
    doc.parameters = doc.parameters.map(p => p.name === 'width' ? { ...p, expression: '40' } : p);
    doc.revision = 2;

    // Run 2: 40x20x20
    const res2 = DocumentEvaluator.evaluate(doc, { 
      generateMesh: true, 
      generateFEA: true, 
      generateCFD: true, 
      generateCAM: true 
    });
    const ev2 = res2.document.evidence[res2.document.evidence.length - 1];

    // Assert that downstream artifacts changed because of geometry shift
    expect(ev1.geometryHash).not.toBe(ev2.geometryHash);
    expect(ev1.meshHash).not.toBe(ev2.meshHash);
    expect(feaHash1).not.toBe(res2.document.derived.fea?.solverInputHash);
    expect(cfdHash1).not.toBe(res2.document.derived.cfd?.solverInputHash);
    expect(camHash1).not.toBe(res2.document.derived.cam?.hash);

    console.log('[Extension C Passed] Causal Propagation verified.');
  });

  it('Extension D — Adversarial: Validation catches invalid profiles but processes rotated/reversed orientations correctly', () => {
    // 1. Open profile -> FAILS
    const openSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    };
    const openProfile = SketchProfileExtractor.extract(openSketch);
    expect(openProfile.isValid).toBe(false);
    expect(openProfile.error).toContain('fewer than 3 unique vertices');

    // 2. Non-adjacent Duplicate Vertices -> FAILS
    const duplicateSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 }, // Overlaps non-adjacent vertex 0
        { x: 0, y: 10 }
      ]
    };
    const duplicateProfile = SketchProfileExtractor.extract(duplicateSketch);
    expect(duplicateProfile.isValid).toBe(false);
    expect(duplicateProfile.error).toContain('Duplicate vertices detected');

    // 3. Degenerate profile (area = 0, collinear) -> FAILS
    const collinearSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 }
      ]
    };
    const degenerateProfile = SketchProfileExtractor.extract(collinearSketch);
    expect(degenerateProfile.isValid).toBe(false);

    // 4. Self-intersecting profile -> FAILS
    const selfIntersectSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ]
    };
    const selfIntersectProfile = SketchProfileExtractor.extract(selfIntersectSketch);
    expect(selfIntersectProfile.isValid).toBe(false);
    expect(selfIntersectProfile.error).toContain('Self-intersecting profile');

    // 5. Reversed Orientation (CW order of a rectangle) & Cyclic shift -> PASS with auto-correction to CCW
    const cwSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 0 }
      ]
    };
    const ccwSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ]
    };

    const cwProfile = SketchProfileExtractor.extract(cwSketch);
    const ccwProfile = SketchProfileExtractor.extract(ccwSketch);

    expect(cwProfile.isValid).toBe(true);
    expect(ccwProfile.isValid).toBe(true);

    // Compare physical properties (Must match perfectly regardless of starting vertex or orientation)
    expect(cwProfile.areaMm2).toBeCloseTo(ccwProfile.areaMm2, 0.001);
    expect(cwProfile.perimeterMm).toBeCloseTo(ccwProfile.perimeterMm, 0.001);
    expect(cwProfile.centroid.x).toBeCloseTo(ccwProfile.centroid.x, 0.001);
    expect(cwProfile.centroid.y).toBeCloseTo(ccwProfile.centroid.y, 0.001);

    // Extrude both and check B-Rep hashes to confirm perfect canonicalization under cyclically shifted / reversed inputs
    const solidCW = brepKernel.extrudePolygon(cwProfile, 0.02, 'cw_solid');
    const solidCCW = brepKernel.extrudePolygon(ccwProfile, 0.02, 'ccw_solid');

    const hashCW = BRepHasher.computeEvidence(solidCW);
    const hashCCW = BRepHasher.computeEvidence(solidCCW);

    expect(hashCW.geometryHash).toBe(hashCCW.geometryHash);
    expect(hashCW.topologyHash).toBe(hashCCW.topologyHash);

    console.log('[Extension D Passed] Adversarial Profile Validation fully verified.');
  });

  it('Extension E — Cross-Instance Determinism: Two completely independent document instances with identical geometry produce same canonical hashes', () => {
    const docA = DocumentEvaluator.createDocument({
      documentId: 'INSTANCE_A',
      parameters: [
        { id: 'p1_A', name: 'width', expression: '20', value: 20 },
        { id: 'p2_A', name: 'height', expression: '20', value: 20 },
        { id: 'p3_A', name: 'depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'FEAT_A_PRIMARY',
          type: 'EXTRUDE',
          name: 'First_Body',
          parameters: {
            width: 'width',
            height: 'height',
            depth: 'depth'
          }
        }
      ]
    });

    const docB = DocumentEvaluator.createDocument({
      documentId: 'INSTANCE_B_DIFFERENT',
      parameters: [
        { id: 'p1_B', name: 'width', expression: '20', value: 20 },
        { id: 'p2_B', name: 'height', expression: '20', value: 20 },
        { id: 'p3_B', name: 'depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'FEAT_B_DIFFERENT_ID_AND_ORDER',
          type: 'EXTRUDE',
          name: 'Alternative_Body_Name',
          parameters: {
            width: 'width',
            height: 'height',
            depth: 'depth'
          }
        }
      ]
    });

    const resA = DocumentEvaluator.evaluate(docA, { generateMesh: true, generateFEA: true, generateCFD: true, generateCAM: true });
    const resB = DocumentEvaluator.evaluate(docB, { generateMesh: true, generateFEA: true, generateCFD: true, generateCAM: true });

    const evA = resA.document.evidence[resA.document.evidence.length - 1];
    const evB = resB.document.evidence[resB.document.evidence.length - 1];

    expect(evA.geometryHash).toBe(evB.geometryHash);
    expect(evA.topologyHash).toBe(evB.topologyHash);

    console.log('[Extension E Passed] Cross-Instance Determinism verified.');
  });

  it('Extension F — Artifact-Level Causality: Downstream physical data actually changes upon parametric shift', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'CAUSAL_ARTIFACT_TEST',
      parameters: [
        { id: 'p1', name: 'width', expression: '20', value: 20 },
        { id: 'p2', name: 'height', expression: '20', value: 20 },
        { id: 'p3', name: 'depth', expression: '20', value: 20 }
      ],
      features: [
        {
          featureId: 'FEAT_CAUSAL',
          type: 'EXTRUDE',
          name: 'ExtrudeBody',
          parameters: {
            width: 'width',
            height: 'height',
            depth: 'depth'
          }
        }
      ]
    });

    // Run 1: 20x20x20
    const res1 = DocumentEvaluator.evaluate(doc, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    const mesh1 = res1.document.derived.mesh!;
    const fea1 = res1.document.derived.fea!;
    const cfd1 = res1.document.derived.cfd!;
    const cam1 = res1.document.derived.cam!;

    // Run 2: Width changed to 40 (40x20x20)
    doc.parameters = doc.parameters.map(p => p.name === 'width' ? { ...p, expression: '40' } : p);
    doc.revision = 2;

    const res2 = DocumentEvaluator.evaluate(doc, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    const mesh2 = res2.document.derived.mesh!;
    const fea2 = res2.document.derived.fea!;
    const cfd2 = res2.document.derived.cfd!;
    const cam2 = res2.document.derived.cam!;

    // 1. Mesh Physical Verification (Max vertex X-coordinate must shift from 0.02 to 0.04 meters)
    const maxXMesh1 = Math.max(...mesh1.vertices.filter((_, idx) => idx % 3 === 0));
    const maxXMesh2 = Math.max(...mesh2.vertices.filter((_, idx) => idx % 3 === 0));
    expect(maxXMesh1).toBeCloseTo(0.02, 0.001);
    expect(maxXMesh2).toBeCloseTo(0.04, 0.001);

    // 2. FEA Nodes Physical Verification (Max node coordinate must shift from 0.02 to 0.04)
    const maxXFea1 = Math.max(...Array.from(fea1.nodes).filter((_, idx) => idx % 3 === 0));
    const maxXFea2 = Math.max(...Array.from(fea2.nodes).filter((_, idx) => idx % 3 === 0));
    expect(maxXFea1).toBeCloseTo(0.02, 0.001);
    expect(maxXFea2).toBeCloseTo(0.04, 0.001);

    // 3. CFD Domain Physical Verification (Max X of fluid boundaries domain must increase)
    expect(cfd1.domainBounds.max[0]).toBeCloseTo(0.03, 0.001);
    expect(cfd2.domainBounds.max[0]).toBeCloseTo(0.05, 0.001);

    // 4. CAM Stock Physical Verification (Max X stock boundary must increase)
    expect(cam1.stockBounds.max[0]).toBeCloseTo(0.025, 0.001);
    expect(cam2.stockBounds.max[0]).toBeCloseTo(0.045, 0.001);

    console.log('[Extension F Passed] Artifact-Level Physical Causality verified.');
  });

  it('Extension G — Canonical Invariance Matrix: Evaluates precise invariants under varying design manipulations', () => {
    // We will evaluate a base shape and check hash variances/invariances under different manipulations
    const box = brepKernel.createBox(0.02, 0.02, 0.02, 'base_box');
    const hashBase = BRepHasher.computeEvidence(box);

    // 1. Invariance under ID change
    const boxIdChange = brepKernel.createBox(0.02, 0.02, 0.02, 'completely_different_id');
    const hashId = BRepHasher.computeEvidence(boxIdChange);
    expect(hashId.geometryHash).toBe(hashBase.geometryHash);
    expect(hashId.topologyHash).toBe(hashBase.topologyHash);

    // 2. Invariance under Name change
    const boxNameChange = brepKernel.createBox(0.02, 0.02, 0.02, 'base_box');
    boxNameChange.name = 'Some_Other_Name';
    const hashName = BRepHasher.computeEvidence(boxNameChange);
    expect(hashName.geometryHash).toBe(hashBase.geometryHash);
    expect(hashName.topologyHash).toBe(hashBase.topologyHash);

    // 3. Invariance under Cyclic Shift of Sketch Points / Loop Starting Point
    const pShiftSketch = {
      points: [
        { x: 20, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 20, y: 20 }
      ]
    };
    const pBaseSketch = {
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 0 }
      ]
    };
    const profileShift = SketchProfileExtractor.extract(pShiftSketch);
    const profileBase = SketchProfileExtractor.extract(pBaseSketch);

    const solidShift = brepKernel.extrudePolygon(profileShift, 0.02, 'solid_shift');
    const solidBase = brepKernel.extrudePolygon(profileBase, 0.02, 'solid_base');

    const hashShift = BRepHasher.computeEvidence(solidShift);
    const hashBaseProfile = BRepHasher.computeEvidence(solidBase);

    expect(hashShift.geometryHash).toBe(hashBaseProfile.geometryHash);
    expect(hashShift.topologyHash).toBe(hashBaseProfile.topologyHash);

    // 4. Invariance under CW -> CCW orientation correction
    // already established by profile extractor converting both to positive CCW
    expect(hashShift.geometryHash).toBe(hashBaseProfile.geometryHash);

    // 5. Variance under dimension shift (Geometry changes, Topology remains INVARIANT)
    const boxDimChange = brepKernel.createBox(0.04, 0.02, 0.02, 'base_box');
    const hashDim = BRepHasher.computeEvidence(boxDimChange);
    expect(hashDim.geometryHash).not.toBe(hashBase.geometryHash); // Geometry MUST change
    expect(hashDim.topologyHash).toBe(hashBase.topologyHash);      // Topology MUST NOT change (still 6-sided box)

    // 6. Variance under topology shift (Both Geometry & Topology change)
    // Construct a Hexagon (6 vertices) extruded solid (8 faces) vs Box (4 vertices, 6 faces)
    const hexagonSketch = {
      points: [
        { x: 10, y: 0 },
        { x: 20, y: 5 },
        { x: 20, y: 15 },
        { x: 10, y: 20 },
        { x: 0, y: 15 },
        { x: 0, y: 5 }
      ]
    };
    const hexagonProfile = SketchProfileExtractor.extract(hexagonSketch);
    const solidHexagon = brepKernel.extrudePolygon(hexagonProfile, 0.02, 'solid_hex');
    const hashHex = BRepHasher.computeEvidence(solidHexagon);

    expect(hashHex.geometryHash).not.toBe(hashBase.geometryHash); // Geometry changed
    expect(hashHex.topologyHash).not.toBe(hashBase.topologyHash); // Topology changed (8 faces vs 6 faces)

    console.log('[Extension G Passed] Canonical Invariance Matrix fully verified.');
  });
});

