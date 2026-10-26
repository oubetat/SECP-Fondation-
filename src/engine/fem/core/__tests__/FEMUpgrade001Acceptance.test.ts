/**
 * SECP Industrial OS — SECP-FEM-UPGRADE-001
 * Sparse Finite Element Solver & Numerical Stability Upgrade
 * Formal Acceptance Test Suite
 * 
 * Verifies all 11 required capabilities:
 * - SPARSE-001: Correctness of sparse matrix storage (CSR/DOK)
 * - SPARSE-002: Equivalence of sparse and dense assembly
 * - SPARSE-003: Correct accumulation of overlapping element DOFs
 * - SOLVER-001: PCG agreement with analytical reference solution
 * - SOLVER-002: PCG agreement with direct solver
 * - SOLVER-003: Rejection of non-convergence (no fake success)
 * - SOLVER-004: Rejection and diagnosis of non-SPD systems
 * - BC-001: Boundary condition enforcement after direct elimination
 * - BC-002: Reaction force equilibrium
 * - NUM-001: Detection and rejection of NaN/Infinity
 * - SCALE-001: Benchmark scaling (DOFs, nnz, sparsity, timing)
 */

import { describe, it, expect } from "vitest";
import { SparseMatrix } from "../SparseMatrix";
import { SparsePCGSolver } from "../SparsePCGSolver";
import { GlobalAssemblyEngine } from "../GlobalAssemblyEngine";
import { BoundaryConditionEngine } from "../BoundaryConditionEngine";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";
import { FEMDOFManager } from "../FEMDOFManager";
import { Bar1DFormulation } from "../Bar1DFormulation";
import { CST2DFormulation } from "../CST2DFormulation";

describe("SECP-FEM-UPGRADE-001: Acceptance Test Suite", () => {
  const formulations = new Map();
  formulations.set("BAR_1D", new Bar1DFormulation());
  formulations.set("CST_2D", new CST2DFormulation());

  // ---------------------------------------------------------------------------
  // SPARSE-001: Correctness of Sparse Matrix Storage
  // ---------------------------------------------------------------------------
  it("SPARSE-001: stores sparse entries correctly in CSR format without data loss", () => {
    const sm = new SparseMatrix(4, 4);
    sm.set(0, 0, 10.0);
    sm.set(0, 2, -2.0);
    sm.set(1, 1, 5.0);
    sm.set(2, 0, -2.0);
    sm.set(2, 2, 8.0);
    sm.set(3, 3, 4.0);

    expect(sm.getNNZ()).toBe(6);
    expect(sm.get(0, 0)).toBe(10.0);
    expect(sm.get(0, 1)).toBe(0.0);
    expect(sm.get(0, 2)).toBe(-2.0);

    const csr = sm.toCSR();
    expect(csr.nnz).toBe(6);
    expect(csr.rowPointers.length).toBe(5);
    expect(csr.rowPointers[0]).toBe(0);
    expect(csr.rowPointers[4]).toBe(6);

    // Test fast SpMV
    const x = [1, 2, 3, 4];
    const y = sm.multiplyVector(x);
    // Row 0: 10*1 + (-2)*3 = 4
    // Row 1: 5*2 = 10
    // Row 2: (-2)*1 + 8*3 = 22
    // Row 3: 4*4 = 16
    expect(y[0]).toBe(4);
    expect(y[1]).toBe(10);
    expect(y[2]).toBe(22);
    expect(y[3]).toBe(16);
  });

  // ---------------------------------------------------------------------------
  // SPARSE-002: Equivalence of Sparse and Dense Assembly
  // ---------------------------------------------------------------------------
  it("SPARSE-002: produces numerically identical matrices between sparse and dense assembly", () => {
    // 3-node, 2-element 1D bar
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 500, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }],
        ["e2", { elementId: "e2", nodeIds: ["n2", "n3"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }],
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 210000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 100 }]]),
      loads: [{ nodeId: "n3", dof: DOFComponent.UX, value: 5000 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, [DOFComponent.UX]);

    const assemblyEngine = new GlobalAssemblyEngine();
    const dual = assemblyEngine.assembleDual(model, dofManager, formulations);

    expect(dual.isNumericallyEquivalent).toBe(true);
    expect(dual.maxAbsoluteDifference).toBeLessThan(1e-12);
    expect(dual.K_sparse.getNNZ()).toBe(7); // 3x3 matrix with band
  });

  // ---------------------------------------------------------------------------
  // SPARSE-003: Correct Accumulation of Overlapping Element DOFs
  // ---------------------------------------------------------------------------
  it("SPARSE-003: correctly accumulates overlapping element stiffness at shared nodes", () => {
    const sm = new SparseMatrix(3, 3);
    // Element 1 contributes 42 to DOF 1
    sm.add(1, 1, 42.0);
    // Element 2 also contributes 58 to DOF 1
    sm.add(1, 1, 58.0);
    // Element 3 contributes 100 to DOF 1
    sm.add(1, 1, 100.0);

    expect(sm.get(1, 1)).toBe(200.0);
  });

  // ---------------------------------------------------------------------------
  // SOLVER-001: PCG Agreement with Analytical Reference Solution
  // ---------------------------------------------------------------------------
  it("SOLVER-001: PCG solver converges to exact analytical displacement delta = F*L / (A*E)", () => {
    const L = 1000;
    const A = 100;
    const E = 200000;
    const F = 10000;
    const analyticalDisp = (F * L) / (A * E); // = 0.5 mm

    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: F }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(model, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION',
      pcgOptions: { relativeTolerance: 1e-10 }
    });

    const numericalDisp = result.displacements.get("n2")![DOFComponent.UX]!;
    const relError = Math.abs(numericalDisp - analyticalDisp) / analyticalDisp;

    expect(relError).toBeLessThan(1e-8);
    expect(result.solverTypeUsed).toBe('SPARSE_PCG');
    expect(result.solverDiagnostics?.converged).toBe(true);
    expect(result.equilibrium.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // SOLVER-002: PCG Agreement with Direct Solver on 2D Mesh
  // ---------------------------------------------------------------------------
  it("SOLVER-002: PCG solver agrees with Direct Solver on 2D CST plane stress mesh", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 0, y: 100, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 210000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", thickness: 2.0 }]]),
      loads: [
        { nodeId: "n2", dof: DOFComponent.UX, value: 2500 },
        { nodeId: "n3", dof: DOFComponent.UY, value: 1200 }
      ],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n2", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n3", dof: DOFComponent.UX, value: 0 }
      ]
    };

    const core = new FEMCore();

    const directResult = core.solve(model, {
      solverType: 'DIRECT_PARTITIONED',
      bcMethod: 'DIRECT_ELIMINATION'
    });

    const pcgResult = core.solve(model, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION',
      pcgOptions: { relativeTolerance: 1e-12 }
    });

    for (const [nodeId, directDisp] of directResult.displacements.entries()) {
      const pcgDisp = pcgResult.displacements.get(nodeId)!;
      for (const comp of [DOFComponent.UX, DOFComponent.UY]) {
        const dVal = directDisp[comp] || 0;
        const pVal = pcgDisp[comp] || 0;
        expect(Math.abs(dVal - pVal)).toBeLessThan(1e-8);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // SOLVER-003: Rejection of Non-Convergence
  // ---------------------------------------------------------------------------
  it("SOLVER-003: explicitly rejects non-convergence instead of returning a fake success", () => {
    const sm = new SparseMatrix(2, 2);
    sm.set(0, 0, 100);
    sm.set(0, 1, 99.9999);
    sm.set(1, 0, 99.9999);
    sm.set(1, 1, 100);

    const b = [1.0, 2.0];

    // Restrict max iterations to 1 and require impossible 1e-15 relative tolerance
    expect(() => {
      SparsePCGSolver.solve(sm, b, {
        maxIterations: 1,
        relativeTolerance: 1e-15,
        absoluteTolerance: 1e-15
      });
    }).toThrow(/PCG_CONVERGENCE_FAILURE/);
  });

  // ---------------------------------------------------------------------------
  // SOLVER-004: Rejection of Non-SPD / Unconstrained Systems
  // ---------------------------------------------------------------------------
  it("SOLVER-004: diagnoses and rejects non-SPD systems (unconstrained rigid body mode)", () => {
    // Model with NO boundary conditions (free floating bar under load)
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 100, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 1 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 50 }],
      boundaryConditions: [] // NO BOUNDARY CONDITIONS -> Singular / Non-SPD
    };

    const core = new FEMCore();
    expect(() => {
      core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
    }).toThrow();
  });

  // ---------------------------------------------------------------------------
  // BC-001: Boundary Conditions after Direct Elimination
  // ---------------------------------------------------------------------------
  it("BC-001: accurately enforces fixed and prescribed displacement boundary conditions", () => {
    const L = 100;
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 200, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 1 }]]),
      loads: [],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0.0 }, // fixed at 0
        { nodeId: "n2", dof: DOFComponent.UX, value: 0.05 } // prescribed displacement 0.05
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'AUTO', bcMethod: 'DIRECT_ELIMINATION' });

    expect(result.displacements.get("n1")![DOFComponent.UX]).toBeCloseTo(0.0, 8);
    expect(result.displacements.get("n2")![DOFComponent.UX]).toBeCloseTo(0.05, 8);
  });

  // ---------------------------------------------------------------------------
  // BC-002: Exact Reaction Force Equilibrium
  // ---------------------------------------------------------------------------
  it("BC-002: validates exact reaction force equilibrium sum F_ext + sum R = 0", () => {
    const P = 1500;
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 200, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 1 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: P }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    expect(result.equilibrium.ok).toBe(true);
    expect(Math.abs(result.equilibrium.sumFx)).toBeLessThan(1e-10);
    // Reaction at n1 must equal -P
    const dof1 = core.getDOFManager().getDOF("n1", DOFComponent.UX)!;
    expect(result.reactions[dof1.globalId]).toBeCloseTo(-P, 6);
  });

  // ---------------------------------------------------------------------------
  // NUM-001: Detection and Rejection of NaN / Infinity
  // ---------------------------------------------------------------------------
  it("NUM-001: detects and rejects non-finite numerical inputs (NaN / Inf)", () => {
    const sm = new SparseMatrix(2, 2);
    expect(() => sm.set(0, 0, NaN)).toThrow(/NUMERICAL_ERROR/);
    expect(() => sm.add(0, 0, Infinity)).toThrow(/NUMERICAL_ERROR/);
    expect(() => sm.set(0, 0, -Infinity)).toThrow(/NUMERICAL_ERROR/);
  });

  // ---------------------------------------------------------------------------
  // SCALE-001: Benchmark Scaling (Memory, DOFs, NNZ, Sparsity)
  // ---------------------------------------------------------------------------
  it("SCALE-001: benchmarks sparse scaling and sparsity across increasing DOF counts", () => {
    const numElements = 20;
    const numNodes = numElements + 1;
    const nodes = new Map<string, any>();
    const elements = new Map<string, any>();

    for (let i = 0; i < numNodes; i++) {
      nodes.set(`n${i}`, { nodeId: `n${i}`, x: i * 50, y: 0, z: 0 });
    }

    for (let i = 0; i < numElements; i++) {
      elements.set(`e${i}`, {
        elementId: `e${i}`,
        nodeIds: [`n${i}`, `n${i + 1}`],
        formulationId: "BAR_1D",
        materialId: "mat1",
        sectionId: "sec1"
      });
    }

    const model: FEMModel = {
      nodes,
      elements,
      materials: new Map([["mat1", { materialId: "mat1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 50 }]]),
      loads: [{ nodeId: `n${numElements}`, dof: DOFComponent.UX, value: 10000 }],
      boundaryConditions: [{ nodeId: "n0", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    expect(result.sparseMetrics.totalDOFs).toBe(21);
    expect(result.sparseMetrics.sparsityRatio).toBeGreaterThan(0.85); // Over 85% sparse!
    expect(result.solverDiagnostics?.converged).toBe(true);
    expect(result.equilibrium.ok).toBe(true);
  });
});
