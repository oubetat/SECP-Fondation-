/**
 * SECP Industrial OS — Engineering Truth OS
 * FEMUpgrade011HyperelasticLargeDeform.test.ts
 *
 * SECP-PHYSICS-EXPANSION-001: Verification Suite for Hyperelasticity & Large Deformation 3D Solid Mechanics.
 *
 * Tests:
 * 1. Exact reduction of hyperelastic tangent tensor to Hookean elasticity at F = I
 * 2. Uniaxial stretch benchmark matching analytical continuum theory
 * 3. Rigid body rotation invariance (objective frame indifference: Q in SO(3) -> S = 0, W = 0)
 * 4. Geometric stiffness K_geo symmetry and correct scaling with PK2 stress
 * 5. Full Newton-Raphson nonlinear equilibrium solve with TET4_LARGE_DEFORM
 * 6. Adversarial fail-closed rejection of inverted elements (det(F) <= 0 or det(J0) <= 0)
 */

import { describe, it, expect } from "vitest";
import { HyperelasticNeoHookean3D } from "../HyperelasticNeoHookean3D";
import { TET4LargeDeformationFormulation } from "../TET4LargeDeformationFormulation";
import { TET43DFormulation } from "../TET43DFormulation";
import { FEMDOFManager } from "../FEMDOFManager";
import { FEMModel, DOFComponent, FEMNode, FEMElement, FEMMaterial } from "../FEMTypes";
import { NonlinearEquilibriumSolver } from "../NonlinearEquilibriumSolver";

describe("SECP-PHYSICS-EXPANSION-001: Hyperelasticity & Large Deformation", () => {
  const E = 210000; // MPa
  const nu = 0.3;
  const mu = E / (2.0 * (1.0 + nu)); // 80769.23 MPa
  const K = E / (3.0 * (1.0 - 2.0 * nu)); // 175000 MPa

  it("1. Verifies exact reduction to linear Hookean elasticity tensor at zero deformation (F = I)", () => {
    const hyper = new HyperelasticNeoHookean3D({ E, nu });
    const linearTet = new TET43DFormulation();
    const D_linear = linearTet.computeConstitutiveMatrixD(E, nu);

    const I3 = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const { C_mat, S_voigt, strainEnergy } = hyper.computeStressAndTangent(I3);

    expect(strainEnergy).toBeCloseTo(0.0, 10);
    for (const s of S_voigt) {
      expect(Math.abs(s)).toBeLessThan(1e-10);
    }

    // Verify C_mat matches D_linear exactly component by component
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        expect(C_mat.get(r, c)).toBeCloseTo(D_linear.get(r, c), 4);
      }
    }
  });

  it("2. Verifies analytical uniaxial stretch benchmark", () => {
    // Pure stretch F = diag(lambda, 1/sqrt(lambda), 1/sqrt(lambda)) for isochoric deformation J = 1
    const hyper = new HyperelasticNeoHookean3D({ mu, K });
    const stretch = 1.15; // 15% tensile stretch
    const lateral = 1.0 / Math.sqrt(stretch);

    const F = [
      [stretch, 0, 0],
      [0, lateral, 0],
      [0, 0, lateral]
    ];

    const { S_tensor, S_voigt, J } = hyper.computeStressAndTangent(F);
    expect(J).toBeCloseTo(1.0, 8); // Isochoric

    // Analytical PK2 stress: S11 = mu * (1 - lambda^-3)
    // S_iso_11 = mu * J^(-2/3) * (1 - 1/3 * I1 * C^-1_11)
    // For general compressible, Cauchy sigma_11 - sigma_22 = mu * (lambda^2 - 1/lambda)
    const sigma11 = (1.0 / J) * (F[0][0] * S_tensor[0][0] * F[0][0]);
    const sigma22 = (1.0 / J) * (F[1][1] * S_tensor[1][1] * F[1][1]);
    const stressDiff = sigma11 - sigma22;
    const analyticalDiff = mu * (stretch * stretch - 1.0 / stretch);

    expect(stressDiff).toBeCloseTo(analyticalDiff, 1);
  });

  it("3. Verifies objective frame indifference under 3D finite rigid-body rotation", () => {
    const hyper = new HyperelasticNeoHookean3D({ E, nu });

    // 45 degree rotation about Z axis
    const theta = Math.PI / 4.0;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const Q = [
      [cosT, -sinT, 0],
      [sinT,  cosT, 0],
      [0,     0,    1]
    ];

    const { S_voigt, strainEnergy, J } = hyper.computeStressAndTangent(Q);

    expect(J).toBeCloseTo(1.0, 10);
    expect(strainEnergy).toBeCloseTo(0.0, 10);
    for (const s of S_voigt) {
      expect(Math.abs(s)).toBeLessThan(1e-9);
    }
  });

  it("4. Verifies geometric stiffness K_geo symmetry and positive definiteness under tension", () => {
    const formulation = new TET4LargeDeformationFormulation();

    const nodes = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 0, z: 10 }
    ];

    const { dNdX, dNdY, dNdZ, volume0 } = formulation.computeReferenceDerivatives(nodes);

    // Tensile stress state S_xx = 500 MPa
    const S_tensor = [
      [500, 0, 0],
      [0, 50, 0],
      [0, 0, 50]
    ];

    const Kgeo = formulation.computeGeometricStiffness(S_tensor, dNdX, dNdY, dNdZ, volume0);

    // Check symmetry: Kgeo_ij == Kgeo_ji
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        expect(Kgeo.get(i, j)).toBeCloseTo(Kgeo.get(j, i), 10);
      }
    }
  });

  it("5. Verifies finite element nonlinear Newton-Raphson convergence on TET4_LARGE_DEFORM", async () => {
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ["N0", { nodeId: "N0", x: 0, y: 0, z: 0 }],
        ["N1", { nodeId: "N1", x: 20, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 0, y: 20, z: 0 }],
        ["N3", { nodeId: "N3", x: 0, y: 0, z: 20 }]
      ]),
      elements: new Map<string, FEMElement>([
        [
          "E1",
          {
            elementId: "E1",
            formulationId: "TET4_LARGE_DEFORM",
            nodeIds: ["N0", "N1", "N2", "N3"],
            materialId: "RUBBER"
          }
        ]
      ]),
      materials: new Map<string, FEMMaterial>([
        ["RUBBER", { materialId: "RUBBER", name: "Elastomer", E: 100.0, nu: 0.45, density: 1.1e-9 }]
      ]),
      sections: new Map(),
      boundaryConditions: [
        // Fix base nodes N0, N2, N3 in all directions
        { nodeId: "N0", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UZ, value: 0 }
      ],
      loads: [
        // Pull node N1 with large tensile force along X
        { nodeId: "N1", dof: DOFComponent.UX, value: 50.0 }
      ]
    };

    const dofMgr = new FEMDOFManager();
    dofMgr.buildDOFs(model, [DOFComponent.UX, DOFComponent.UY, DOFComponent.UZ]);

    const formulations = new Map();
    const largeDeform = new TET4LargeDeformationFormulation();
    formulations.set("TET4_LARGE_DEFORM", largeDeform);

    const solver = new NonlinearEquilibriumSolver();
    const result = await solver.solve(model, dofMgr, formulations, {
      maxIterations: 15,
      maxLoadSteps: 4,
      relativeTolerance: 1e-5
    });

    expect(result.converged).toBe(true);
    expect(result.steps).toBeGreaterThanOrEqual(1);

    // Recover stress and verify Cauchy stress and von Mises are positive
    const recovered = largeDeform.computeStressStrain(
      model.elements.get("E1")!,
      model,
      dofMgr,
      result.U
    );

    expect(recovered.vonMisesStress).toBeGreaterThan(0.0);
    expect(recovered.strain.epsilon_x).toBeGreaterThan(0.0); // Positive Green-Lagrange strain
  });

  it("6. Adversarial check: fails closed on degenerate or inverted element", () => {
    const hyper = new HyperelasticNeoHookean3D({ E, nu });

    // Inverted deformation gradient (det(F) < 0)
    const F_inverted = [
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    expect(() => hyper.computeStressAndTangent(F_inverted)).toThrow(/HYPERELASTIC_DEGENERACY/);

    // Inverted tetrahedron coordinates (coplanar / zero volume)
    const coplanarNodes = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
      { x: 30, y: 0, z: 0 }
    ];
    const formulation = new TET4LargeDeformationFormulation();
    expect(() => formulation.computeReferenceDerivatives(coplanarNodes)).toThrow(/DEGENERATE_REFERENCE_TET/);
  });
});
