import { describe, it, expect } from 'vitest';
import { BRepKernel } from '../../brep/BRepKernel';
import { FEAAdapter } from '../FEAAdapter';
import { LinearStructuralSolver } from '../../../fem/solver/LinearStructuralSolver';
import { EngineeringHashChain } from '../../../evidence/EngineeringHashChain';
import { StructuralModel } from '../../../fem/solver/StructuralModel';

describe('Geometry Identity and FEA Dependency Verification', () => {
  const solver = new LinearStructuralSolver();
  const brepKernel = BRepKernel.getCanonical();

  it('should maintain identical hashes for same geometry even with different IDs (Geometry Identity)', () => {
    // 1. Setup two solids with IDENTICAL geometry but DIFFERENT IDs
    const solidA = brepKernel.createBox(1.0, 1.0, 1.0, 'Part_A');
    const solidB = brepKernel.createBox(1.0, 1.0, 1.0, 'Part_B');

    // 2. Discretize both
    const meshA = FEAAdapter.meshFromBRep(solidA, { elementKind: 'TRI3' });
    const meshB = FEAAdapter.meshFromBRep(solidB, { elementKind: 'TRI3' });

    // 3. ASSERT: BRep Hashes must be identical (Canonical Geometry Identity)
    console.log('BRepHash A:', meshA.brepHash);
    console.log('BRepHash B:', meshB.brepHash);
    expect(meshA.brepHash).toBe(meshB.brepHash);

    // 4. ASSERT: FEA Mesh Hashes must be identical
    expect(meshA.meshHash).toBe(meshB.meshHash);

    // 5. Run FEA on both
    const modelA = StructuralModel.fromMesh(meshA, { id: 'Model_A' });
    const modelB = StructuralModel.fromMesh(meshB, { id: 'Model_B' });
    const resA = solver.solve(modelA);
    const resB = solver.solve(modelB);

    // 6. ASSERT: Results must be identical
    expect(resA.displacements).toEqual(resB.displacements);
  });

  it('should detect geometric changes and propagate them through the entire pipeline', () => {
    // 1. Setup two solids with DIFFERENT geometry
    const solidA = brepKernel.createBox(1.0, 1.0, 1.0, 'BOX_1');
    const solidB = brepKernel.createBox(1.5, 1.0, 1.0, 'BOX_2'); // Different length

    // 2. Discretize both
    const meshA = FEAAdapter.meshFromBRep(solidA, { elementKind: 'TRI3' });
    const meshB = FEAAdapter.meshFromBRep(solidB, { elementKind: 'TRI3' });

    // 3. ASSERT: BRep Hashes must be different
    expect(meshA.brepHash).not.toBe(meshB.brepHash);

    // 4. ASSERT: Mesh Hashes must be different
    expect(meshA.meshHash).not.toBe(meshB.meshHash);

    // 5. Run FEA
    const modelA = StructuralModel.fromMesh(meshA, { id: 'Model_A' });
    const modelB = StructuralModel.fromMesh(meshB, { id: 'Model_B' });
    const resA = solver.solve(modelA);
    const resB = solver.solve(modelB);

    // 6. ASSERT: Stiffness matrices must be different
    const hashK_A = EngineeringHashChain.computeCanonicalHash(resA.stiffnessMatrix).canonicalHash;
    const hashK_B = EngineeringHashChain.computeCanonicalHash(resB.stiffnessMatrix).canonicalHash;
    expect(hashK_A).not.toBe(hashK_B);

    // 7. ASSERT: Displacements must be different
    const hashU_A = EngineeringHashChain.computeCanonicalHash(resA.displacements).canonicalHash;
    const hashU_B = EngineeringHashChain.computeCanonicalHash(resB.displacements).canonicalHash;
    expect(hashU_A).not.toBe(hashU_B);

    // 8. ASSERT: Stresses must be different
    if (resA.elementResults && resB.elementResults) {
        const stressA = resA.elementResults.map(r => r.elementCenterVonMises);
        const stressB = resB.elementResults.map(r => r.elementCenterVonMises);
        expect(stressA).not.toEqual(stressB);
    }
  });
});
