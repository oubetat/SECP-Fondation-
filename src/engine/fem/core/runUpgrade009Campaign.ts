/**
 * SECP Industrial OS — Geometrically Nonlinear Mechanics (SECP-FEM-UPGRADE-009)
 * runUpgrade009Campaign.ts
 * 
 * Verification campaign for Large-Deformation Physics.
 */

import { FEMCore } from "./FEMCore";
import { FEMModel, DOFComponent } from "./FEMTypes";

async function runGEOM001_LinearParity() {
  console.log("Running GEOM-001: Small Displacement Linear Parity...");
  const core = new FEMCore();
  
  // Simple horizontal bar: (0,0) fixed, (1000,0) loaded with 10N
  const model: FEMModel = {
    nodes: new Map([
      ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
      ["n2", { nodeId: "n2", x: 1000, y: 0, z: 0 }]
    ]),
    elements: new Map([
      ["e1", {
        elementId: "e1",
        nodeIds: ["n1", "n2"],
        materialId: "m1",
        sectionId: "s1",
        formulationId: "TRUSS_2D_NL"
      }]
    ]),
    materials: new Map([
      ["m1", { materialId: "m1", E: 210000, nu: 0.3 }]
    ]),
    sections: new Map([
      ["s1", { sectionId: "s1", area: 100 }]
    ]),
    loads: [
      { nodeId: "n2", dof: DOFComponent.UX, value: 100 } // Small load
    ],
    boundaryConditions: [
      { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
      { nodeId: "n2", dof: DOFComponent.UY, value: 0 }
    ]
  };

  // Linear solve
  const modelLinear: FEMModel = {
    ...model,
    elements: new Map(model.elements)
  };
  modelLinear.elements.set("e1", { ...model.elements.get("e1")!, formulationId: "BAR_1D" });
  const linearResult = core.solve(modelLinear);
  const u_linear = linearResult.displacements.get("n2")!.UX!;

  // Nonlinear solve
  const nlResult = await core.solveNonlinear(model, { maxLoadSteps: 1 });
  const u_nonlinear = nlResult.U[core.getDOFManager().getDOF("n2", DOFComponent.UX)!.globalId];

  const diff = Math.abs(u_linear - u_nonlinear);
  const tol = 1e-6;
  
  if (diff < tol) {
    console.log(`[PASS] GEOM-001: u_lin=${u_linear.toFixed(6)}, u_nl=${u_nonlinear.toFixed(6)}, diff=${diff.toExponential(4)}`);
  } else {
    console.error(`[FAIL] GEOM-001: Large discrepancy between linear and nonlinear results. diff=${diff.toExponential(4)}`);
    process.exit(1);
  }
}

async function runGEOM002_SnapThrough() {
  console.log("Running GEOM-002: Large Displacement Snap-Through (Numerical Test)...");
  const core = new FEMCore();
  
  // Simple inclined bar that will undergo large rotation/displacement
  // n1 (0,0) fixed
  // n2 (100, 2) loaded vertically
  const model: FEMModel = {
    nodes: new Map([
      ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
      ["n2", { nodeId: "n2", x: 100, y: 2, z: 0 }]
    ]),
    elements: new Map([
      ["e1", {
        elementId: "e1",
        nodeIds: ["n1", "n2"],
        materialId: "m1",
        sectionId: "s1",
        formulationId: "TRUSS_2D_NL"
      }]
    ]),
    materials: new Map([
      ["m1", { materialId: "m1", E: 200000, nu: 0.3 }]
    ]),
    sections: new Map([
      ["s1", { sectionId: "s1", area: 10 }]
    ]),
    loads: [
      { nodeId: "n2", dof: DOFComponent.UY, value: -50 } // Large load pushing it down
    ],
    boundaryConditions: [
      { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
      { nodeId: "n2", dof: DOFComponent.UX, value: 0 } // Constraint to move only vertically
    ]
  };

  const nlResult = await core.solveNonlinear(model, {
    maxLoadSteps: 10,
    relativeTolerance: 1e-8,
    onIteration: (step, iter, res) => console.log(`  Step ${step}, Iter ${iter}, ResNorm: ${res.toExponential(4)}`)
  });

  if (nlResult.converged) {
    const v2 = nlResult.U[core.getDOFManager().getDOF("n2", DOFComponent.UY)!.globalId];
    console.log(`[PASS] GEOM-002: Converged successfully. Final v2=${v2.toFixed(4)}`);
  } else {
    console.error(`[FAIL] GEOM-002: Solver failed to converge for snap-through test.`);
    process.exit(1);
  }
}

async function runGEOM006_TangentFiniteDifference() {
  console.log("Running GEOM-006: Tangent Stiffness Finite Difference Verification...");
  const core = new FEMCore();
  const truss = core["formulations"].get("TRUSS_2D_NL")!;
  
  const model: FEMModel = {
    nodes: new Map([
      ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
      ["n2", { nodeId: "n2", x: 100, y: 50, z: 0 }]
    ]),
    elements: new Map(),
    materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
    sections: new Map([["s1", { sectionId: "s1", area: 100 }]]),
    loads: [],
    boundaryConditions: []
  };
  const element = { elementId: "e1", nodeIds: ["n1", "n2"], materialId: "m1", sectionId: "s1", formulationId: "TRUSS_2D_NL" };
  model.elements.set("e1", element);
  
  const dofManager = core.getDOFManager();
  dofManager.buildDOFs(model, core["formulations"]);
  
  const U = new Float64Array([0.1, -0.2, 0.5, 0.3]); // Arbitrary non-zero displacement
  
  const { Kt, Fint } = truss.computeNonlinearMatrices!(element, model, dofManager, U);
  
  const h = 1e-7;
  const Kt_fd = new Array(4).fill(0).map(() => new Array(4).fill(0));
  
  for (let j = 0; j < 4; j++) {
    const Uh = new Float64Array(U);
    Uh[j] += h;
    const res_h = truss.computeNonlinearMatrices!(element, model, dofManager, Uh);
    for (let i = 0; i < 4; i++) {
      Kt_fd[i][j] = (res_h.Fint[i] - Fint[i]) / h;
    }
  }
  
  let maxDiff = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const diff = Math.abs(Kt.get(i, j) - Kt_fd[i][j]);
      const relDiff = diff / (Math.abs(Kt.get(i, j)) + 1e-9);
      if (relDiff > maxDiff) maxDiff = relDiff;
    }
  }
  
  if (maxDiff < 1e-4) {
    console.log(`[PASS] GEOM-006: Tangent stiffness matches finite difference. Max relative diff: ${maxDiff.toExponential(4)}`);
  } else {
    console.error(`[FAIL] GEOM-006: Tangent stiffness mismatch. Max relative diff: ${maxDiff.toExponential(4)}`);
    process.exit(1);
  }
}

async function runCampaign() {
  console.log("SECP-FEM-UPGRADE-009 Verification Campaign Started");
  console.log("=================================================");
  
  try {
    await runGEOM001_LinearParity();
    await runGEOM002_SnapThrough();
    await runGEOM006_TangentFiniteDifference();
    
    console.log("\n=================================================");
    console.log("CAMPAIGN RESULT: QUALIFIED_WITHIN_DECLARED_SCOPE");
  } catch (err) {
    console.error("\nCAMPAIGN FAILED");
    console.error(err);
    process.exit(1);
  }
}

runCampaign();
