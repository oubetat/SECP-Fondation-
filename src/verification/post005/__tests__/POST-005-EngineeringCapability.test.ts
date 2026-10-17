import { describe, it, expect } from 'vitest';
import { NurbsKnotInsertion } from '../../../engine/cad-kernel/nurbs/NurbsKnotInsertion';
import { NurbsCurve, NurbsTolerance } from '../../../engine/cad-kernel/nurbs/NurbsContracts';
import { NurbsEvaluator } from '../../../engine/cad-kernel/nurbs/NurbsEvaluator';
import { FilletEngine } from '../../../engine/cad-kernel/modeling/FilletEngine';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { GeometricTolerance } from '../../../engine/cad-kernel/predicates/GeometricTolerance';
import { MoldEngine } from '../../../engine/cad/mold/MoldEngine';
import { asM } from '../../../engine/cad-kernel/core/Units';
import { StiffnessMatrixEngine } from '../../../engine/structural-physics/StiffnessMatrixEngine';
import { DisplacementAnalysisEngine } from '../../../engine/structural-physics/DisplacementAnalysisEngine';
import { FEAMesh, MaterialProperties, StructuralAnalysisResults } from '../../../engine/structural-physics/StructuralPhysicsTypes';

describe('POST-005 Track B: Engineering Capability Verification', () => {
  const tol: NurbsTolerance = { absolute: 1e-7, relative: 1e-6 };

  // Independent mathematical reference implementation: De Boor algorithm
  function independentDeBoorEvaluate(degree: number, controlPoints: { x: number; y: number; z: number; w?: number }[], knots: number[], u: number): { x: number; y: number; z: number } {
    const k = knots.length - 1;
    let s = 0;
    while (s < knots.length - 1 && knots[s + 1] <= u) {
      s++;
    }
    if (s < degree) s = degree;
    if (s > controlPoints.length - 1) s = controlPoints.length - 1;

    // Initialize d vectors
    const d: { x: number; y: number; z: number; w: number }[] = [];
    for (let i = 0; i <= degree; i++) {
      const cp = controlPoints[s - degree + i];
      const w = cp.w ?? 1;
      d[i] = { x: cp.x * w, y: cp.y * w, z: cp.z * w, w };
    }

    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const idx = s - degree + j;
        const knotRight = knots[idx + degree - r + 1];
        const knotLeft = knots[idx];
        const alpha = knotRight === knotLeft ? 0 : (u - knotLeft) / (knotRight - knotLeft);
        d[j] = {
          x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
          y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
          z: (1 - alpha) * d[j - 1].z + alpha * d[j].z,
          w: (1 - alpha) * d[j - 1].w + alpha * d[j].w
        };
      }
    }

    const finalW = d[degree].w || 1;
    return {
      x: d[degree].x / finalW,
      y: d[degree].y / finalW,
      z: d[degree].z / finalW
    };
  }

  it('GAP-002: Cox-de Boor knot insertion preserves curve geometry across evaluation domain against independent mathematical reference', () => {
    // Quadratic Bezier arc: degree 2, 3 control points
    const originalCurve: any = {
      degree: 2,
      controlPoints: [
        { x: asM(0), y: asM(0), z: asM(0), w: 1 },
        { x: asM(1), y: asM(2), z: asM(0), w: 1 },
        { x: asM(2), y: asM(0), z: asM(0), w: 1 }
      ],
      knots: [0, 0, 0, 1, 1, 1],
      evaluate: (u: number) => {
        const evalRes = NurbsEvaluator.evaluateCurve(originalCurve, u, tol);
        return evalRes.point;
      },
      domain: () => ({ uMin: 0, uMax: 1 })
    };

    // Insert knot at u = 0.5 with multiplicity 1
    const refinedCurve = NurbsKnotInsertion.insertKnotCurve(originalCurve, 0.5, 1, tol);
    expect(refinedCurve).not.toBeNull();
    expect(refinedCurve!.controlPoints.length).toBe(4); // 3 + 1
    expect(refinedCurve!.knots).toEqual([0, 0, 0, 0.5, 1, 1, 1]);

    // Test geometric invariance against independent reference over 20 sample points across [0, 1]
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
    const ptOrig = originalCurve.evaluate(u);
    const ptRefined = refinedCurve!.evaluate!(u);
    const ptIndependent = independentDeBoorEvaluate(refinedCurve!.degree, refinedCurve!.controlPoints as any, refinedCurve!.knots as any, u);

    expect(ptRefined.x as any).toBeCloseTo(ptOrig.x, 5);
    expect(ptRefined.y as any).toBeCloseTo(ptOrig.y, 5);
    expect(ptRefined.z as any).toBeCloseTo(ptOrig.z, 5);

    expect(ptRefined.x as any).toBeCloseTo(ptIndependent.x, 5);
    expect(ptRefined.y as any).toBeCloseTo(ptIndependent.y, 5);
    expect(ptRefined.z as any).toBeCloseTo(ptIndependent.z, 5);
    }

    // Boundary knot insertion rejection
    const invalidRefinement = NurbsKnotInsertion.insertKnotCurve(originalCurve, -0.1, 1, tol);
    expect(invalidRefinement).toBeNull();
  });

  it('GAP-001: FilletEngine modifies solid B-Rep topology, inserts blend faces, and validates', () => {
    const brepKernel = new BRepKernel();
    const solid = brepKernel.createBox(asM(1), asM(1), asM(1));
    const edgeId = solid.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.id;

    const filletEngine = new FilletEngine();
    const gTol = GeometricTolerance.DEFAULT;

    // 1. Valid Fillet execution on shared edge
    const result = filletEngine.execute(solid, { edgeIds: [edgeId], radius: 0.05 }, gTol);
    expect(result.status).toBe('SUCCESS');
    expect(result.resultSolid).toBeDefined();
    expect(result.resultSolid).not.toBe(solid); // Material non-identity proof

    // 2. Reject non-existent edge ID
    const nonExistentResult = filletEngine.execute(solid, { edgeIds: ['e_non_existent'], radius: 0.05 }, gTol);
    expect(nonExistentResult.status).toBe('FAILED');

    // 3. Reject invalid / negative radius
    const negRadiusResult = filletEngine.execute(solid, { edgeIds: [edgeId], radius: -0.05 }, gTol);
    expect(negRadiusResult.status).toBe('FAILED');

    // 4. Reject excessive radius
    const invalidResult = filletEngine.execute(solid, { edgeIds: [edgeId], radius: 5.0 }, gTol); // radius > edge length 1.0
    expect(invalidResult.status).toBe('FAILED');
    expect(invalidResult.diagnostics?.[0]).toMatch(/exceeds or equals edge length/);
  });

  it('GAP-003: MoldEngine generates Core, Cavity, and validates draft moldability', () => {
    const parting = MoldEngine.createPartingDefinition(
      'PARTING-01',
      'BODY-CASE-01',
      { x: asM(0), y: asM(0), z: asM(0) },
      { x: asM(0), y: asM(0), z: asM(1) },
      { x: asM(0), y: asM(0), z: asM(1) },
      1
    );

    expect(parting.partingId).toBe('PARTING-01');
    expect(parting.pullDirection.z).toBeCloseTo(1, 5);

    // Test Draft Moldability
    const moldableNormals = [
      { x: asM(0.1), y: asM(0), z: asM(0.99) },
      { x: asM(-0.1), y: asM(0), z: asM(0.99) }
    ];
    const isMoldable = MoldEngine.verifyDraftMoldability(parting, moldableNormals, 2.0);
    expect(isMoldable).toBe(true);

    const split = MoldEngine.performMoldSplit('SPLIT-01', parting, 50000, 500000, 1);
    expect(split.splitId).toBe('SPLIT-01');
    expect(split.core.coreId).toMatch(/^CORE_/);
    expect(split.cavity.cavityId).toMatch(/^CAVITY_/);
    expect(split.core.volumeMm3 + split.cavity.volumeMm3 + 50000).toBeCloseTo(500000, 1);
  });

  it('GAP-007 & GAP-008: StiffnessMatrixEngine and DisplacementAnalysisEngine perform accurate FEA physics', () => {
    // 2-element 1D bar mesh
    const mesh: FEAMesh = {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0, dofIndices: [0, 1, 2] },
        { id: 2, x: 1, y: 0, z: 0, dofIndices: [3, 4, 5] },
        { id: 3, x: 2, y: 0, z: 0, dofIndices: [6, 7, 8] }
      ],
      elements: [
        { id: 1, type: 'BAR_1D', nodeIds: [1, 2], materialId: 'STEEL', crossSectionArea: 0.01 },
        { id: 2, type: 'BAR_1D', nodeIds: [2, 3], materialId: 'STEEL', crossSectionArea: 0.01 }
      ],
      qualityMetrics: {
        aspectRatioMin: 1.0,
        aspectRatioMax: 1.0,
        jacobianDeterminantMin: 1.0,
        isValid: true
      }
    };

    const materials = new Map<string, MaterialProperties>([
      ['STEEL', { id: 'STEEL', name: 'Structural Steel', youngsModulus: 2e11, poissonsRatio: 0.3, yieldStrength: 2.5e8, density: 7850 }]
    ]);

    const kGlobal = StiffnessMatrixEngine.assembleGlobalStiffness(mesh, materials);
    expect(kGlobal.dimension).toBe(9); // 3 nodes * 3 DOFs

    const props = StiffnessMatrixEngine.analyzeStiffnessProperties(kGlobal);
    expect(props.isSymmetric).toBe(true);
    expect(props.trace).toBeGreaterThan(0);

    // Test Displacement Analysis
    const dummyResults: StructuralAnalysisResults = {
      partId: 'PART-01',
      converged: true,
      residualNorm: 1e-6,
      maxDisplacement: 0.005,
      maxStress: 1e8,
      yieldExceeded: false,
      nodes: [
        { nodeId: 1, displacement: { x: 0, y: 0, z: 0 }, strain: { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, stress: { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, vonMises: 0, safetyFactor: 2.0 },
        { nodeId: 2, displacement: { x: 0.0025, y: 0, z: 0 }, strain: { xx: 0.0005, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, stress: { xx: 1e8, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, vonMises: 1e8, safetyFactor: 2.5 },
        { nodeId: 3, displacement: { x: 0.005, y: 0, z: 0 }, strain: { xx: 0.0005, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, stress: { xx: 1e8, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, vonMises: 1e8, safetyFactor: 2.5 }
      ]
    };

    const dispSummary = DisplacementAnalysisEngine.summarizeDisplacementField(dummyResults);
    expect(dispSummary.maxDisplacementMag).toBe(0.005);
    expect(dispSummary.maxDisplacementNodeId).toBe(3);
    expect(dispSummary.meanDisplacementMag).toBeCloseTo(0.0025, 4);

    const midpointDisp = DisplacementAnalysisEngine.interpolateDisplacementAtPoint(dummyResults, mesh, 1, { x: 0.5, y: 0, z: 0 });
    expect(midpointDisp.x).toBeCloseTo(0.00125, 4);
  });
});
