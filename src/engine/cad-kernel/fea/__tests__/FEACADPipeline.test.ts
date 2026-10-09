import { describe, expect, it } from 'vitest';
import { BRepKernel } from '../../brep/BRepKernel';
import { FEAAdapter } from '../FEAAdapter';
import { StructuralModel } from '../../../fem/solver/StructuralModel';
import { LinearStructuralSolver } from '../../../fem/solver/LinearStructuralSolver';

describe('PATCH-KERNEL-007 — CAD -> FEA Pipeline Verification', () => {
  const brepKernel = BRepKernel.getCanonical();
  const solver = new LinearStructuralSolver();

  it('executes BRep -> FEAMesher -> FEAMesh -> StructuralModel -> LinearStructuralSolver pipeline', () => {
    // 1. Part A BRep Creation
    const solidA = brepKernel.createBox(0.1, 0.02, 0.02, 'Part_A');
    expect(solidA).toBeDefined();

    // 2. Part A: BRep -> FEAMesher -> FEAMesh
    const meshA = FEAAdapter.meshFromBRep(solidA, { elementKind: 'TRI3' });
    expect(meshA.nodes.length).toBeGreaterThan(0);
    expect(meshA.elements.length).toBeGreaterThan(0);
    expect(meshA.brepSourceId).toBe(solidA.id);

    // 3. Part A: FEAMesh -> StructuralModel
    const modelA = StructuralModel.fromMesh(meshA, { id: 'Model_A' });
    expect(modelA.id).toBe('Model_A');
    expect(modelA.nodes.length).toEqual(meshA.nodes.length);
    expect(modelA.elements.length).toEqual(meshA.elements.length);

    // 4. Part A: StructuralModel -> LinearStructuralSolver
    const feaA = solver.solve(modelA);
    expect(feaA.converged).toBe(true);
    expect(feaA.verified).toBe(true);
    expect(feaA.stiffnessMatrix).toBeDefined();
    expect(feaA.displacements).toBeDefined();
    expect(feaA.elementResults.length).toBeGreaterThan(0);

    // 5. Modify Parameter to create Part B
    const solidB = brepKernel.createBox(0.25, 0.05, 0.02, 'Part_B');
    expect(solidB).toBeDefined();

    // 6. Part B: Pipeline execution
    const meshB = FEAAdapter.meshFromBRep(solidB, { elementKind: 'TRI3' });
    const modelB = StructuralModel.fromMesh(meshB, { id: 'Model_B' });
    const feaB = solver.solve(modelB);

    expect(feaB.converged).toBe(true);
    expect(feaB.verified).toBe(true);

    // 7. Mandatory Evidence Proofs:
    // BRepHash A != BRepHash B
    expect(meshA.brepHash).not.toEqual(meshB.brepHash);

    // FEA Mesh Hash A != FEA Mesh Hash B
    expect(meshA.meshHash).not.toEqual(meshB.meshHash);

    // K_A != K_B
    const K_A = feaA.stiffnessMatrix;
    const K_B = feaB.stiffnessMatrix;
    expect(K_A).not.toEqual(K_B);

    // u_A != u_B
    const u_A = feaA.displacements;
    const u_B = feaB.displacements;
    expect(u_A).not.toEqual(u_B);

    // stress_A != stress_B
    const stress_A = feaA.elementResults.map((r) => r.elementCenterVonMises);
    const stress_B = feaB.elementResults.map((r) => r.elementCenterVonMises);
    expect(stress_A).not.toEqual(stress_B);

    // Prove pipeline deterministic relationship:
    // feaB = LinearStructuralSolver.solve(StructuralModel.fromMesh(FEAAdapter.meshFromBRep(solidB)))
    const deterministicMeshB = FEAAdapter.meshFromBRep(solidB, { elementKind: 'TRI3' });
    const deterministicModelB = StructuralModel.fromMesh(deterministicMeshB, { id: 'Model_B' });
    const deterministicFeaB = solver.solve(deterministicModelB);

    expect(feaB.evidenceHash).toEqual(deterministicFeaB.evidenceHash);
    expect(feaB.displacements).toEqual(deterministicFeaB.displacements);
  });
});
