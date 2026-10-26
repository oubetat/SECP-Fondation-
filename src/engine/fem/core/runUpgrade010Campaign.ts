/**
 * SECP Industrial OS — Nonlinear Material Mechanics (SECP-FEM-UPGRADE-010)
 * runUpgrade010Campaign.ts
 * 
 * Verification campaign for J2 Elastoplasticity.
 */

import { J2Plasticity3D } from "./J2Plasticity3D";
import { FEMCore } from "./FEMCore";
import { FEMModel, DOFComponent } from "./FEMTypes";

async function runMAT001_ElasticResponse() {
  console.log("Running MAT-001: Elastic Isotropic Response...");
  const model = new J2Plasticity3D(200000, 0.3, 250, 2000);
  const initialState = model.getInitialState();
  
  // Apply purely elastic strain increment
  const eps = [1e-4, 0, 0, 0, 0, 0];
  const result = model.update(eps, initialState);
  
  // Analytical: sigma_xx = (lambda + 2*mu) * eps_xx
  // mu = 200000 / (2 * 1.3) = 76923.07
  // lambda = (200000 * 0.3) / (1.3 * 0.4) = 115384.6
  // sigma_xx = (115384.6 + 2 * 76923.07) * 1e-4 = 26.923 MPa
  const expected = 26.92307;
  const diff = Math.abs(result.stress[0] - expected);
  
  if (diff < 1e-4) {
    console.log(`[PASS] MAT-001: Stress match analytical. val=${result.stress[0].toFixed(5)}`);
  } else {
    console.error(`[FAIL] MAT-001: Stress mismatch. val=${result.stress[0].toFixed(5)}, exp=${expected}`);
    process.exit(1);
  }
}

async function runMAT003_FirstYield() {
  console.log("Running MAT-003: First Yield Transition...");
  const sigma_y0 = 250;
  const model = new J2Plasticity3D(200000, 0.3, sigma_y0, 2000);
  const initialState = model.getInitialState();
  
  // Uniaxial yielding: sigma_xx = sigma_y0
  // eps_xx = sigma_y0 / E = 250 / 200000 = 0.00125
  // But in 3D, sigma_xx = sigma_y0 requires lateral contraction
  // If we just apply eps_xx, we get multiaxial stress state.
  // Von Mises q = sqrt(1.5 * s:s). For uniaxial sigma, q = sigma.
  
  // Apply large strain to cause yield
  const eps_yield = [0.002, 0, 0, 0, 0, 0];
  const result = model.update(eps_yield, initialState);
  
  const q = Math.sqrt(1.5 * (
    (result.stress[0] - (result.stress[0]+result.stress[1]+result.stress[2])/3)**2 + 
    (result.stress[1] - (result.stress[0]+result.stress[1]+result.stress[2])/3)**2 +
    (result.stress[2] - (result.stress[0]+result.stress[1]+result.stress[2])/3)**2
  ));
  
  if (q >= sigma_y0 - 1e-8) {
    console.log(`[PASS] MAT-003: Yield reached. q=${q.toFixed(2)}, sigma_y0=${sigma_y0}`);
  } else {
    console.error(`[FAIL] MAT-003: Yield not reached. q=${q.toFixed(2)}`);
    process.exit(1);
  }
}

async function runMAT013_ConsistentTangent() {
  console.log("Running MAT-013: Consistent Tangent Finite Difference...");
  const model = new J2Plasticity3D(200000, 0.3, 250, 5000);
  const initialState = model.getInitialState();
  
  // Establish a plastic state first
  const eps_p = [0.003, -0.001, -0.001, 0, 0, 0];
  const baseResult = model.update(eps_p, initialState);
  const baseState = baseResult.state;
  
  const h = 1e-6;
  const Ct_fd = new Array(6).fill(0).map(() => new Array(6).fill(0));
  
  for (let j = 0; j < 6; j++) {
    const eps_plus = [...eps_p];
    eps_plus[j] += h;
    const res_plus = model.update(eps_plus, initialState);
    
    const eps_minus = [...eps_p];
    eps_minus[j] -= h;
    const res_minus = model.update(eps_minus, initialState);
    
    for (let i = 0; i < 6; i++) {
      Ct_fd[i][j] = (res_plus.stress[i] - res_minus.stress[i]) / (2 * h);
    }
  }
  
  const Ct_analytical = baseResult.tangent;
  
  let maxDiff = 0;
  let worstI = 0, worstJ = 0;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const diff = Math.abs(Ct_analytical.get(i, j) - Ct_fd[i][j]);
      const relDiff = diff / (Math.abs(Ct_analytical.get(i, j)) + 1e-9);
      if (relDiff > maxDiff) {
        maxDiff = relDiff;
        worstI = i; worstJ = j;
      }
    }
  }
  
  if (maxDiff < 1e-3) {
    console.log(`[PASS] MAT-013: Tangent matches FD. maxRelDiff=${maxDiff.toExponential(4)}`);
  } else {
    console.error(`[FAIL] MAT-013: Tangent mismatch. maxRelDiff=${maxDiff.toExponential(4)} at (${worstI},${worstJ})`);
    console.error(`  Analytical: ${Ct_analytical.get(worstI, worstJ).toFixed(4)}`);
    console.error(`  Numerical:  ${Ct_fd[worstI][worstJ].toFixed(4)}`);
    process.exit(1);
  }
}

async function runSTR002_SingleElementPlasticity() {
  console.log("Running STR-002: Single TET4 Plastic Response...");
  const core = new FEMCore();
  
  // Unit cube TET4: (0,0,0), (1,0,0), (0,1,0), (0,0,1)
  const model: FEMModel = {
    nodes: new Map([
      ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
      ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
      ["n3", { nodeId: "n3", x: 0, y: 10, z: 0 }],
      ["n4", { nodeId: "n4", x: 0, y: 0, z: 10 }]
    ]),
    elements: new Map([
      ["e1", {
        elementId: "e1",
        nodeIds: ["n1", "n2", "n3", "n4"],
        materialId: "m1",
        sectionId: "s1",
        formulationId: "TET4_PLASTIC"
      }]
    ]),
    materials: new Map([
      ["m1", { materialId: "m1", E: 200000, nu: 0.3 }]
    ]),
    sections: new Map([
      ["s1", { sectionId: "s1" }]
    ]),
    loads: [
      { nodeId: "n2", dof: DOFComponent.UX, value: 50000 } // Tension to cause yield
    ],
    boundaryConditions: [
      { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
      { nodeId: "n1", dof: DOFComponent.UZ, value: 0 },
      { nodeId: "n3", dof: DOFComponent.UX, value: 0 },
      { nodeId: "n4", dof: DOFComponent.UX, value: 0 }
    ]
  };

  const matModel = new J2Plasticity3D(200000, 0.3, 250, 5000);
  
  const result = await core.solveNonlinear(model, {
    materialModel: matModel,
    maxLoadSteps: 5,
    onIteration: (step, iter, res) => console.log(`  Step ${step}, Iter ${iter}, ResNorm: ${res.toExponential(4)}`)
  });

  if (result.converged) {
    const eqPlasticStrain = (result.fields.elementFields.get("e1") as any).equivalentPlasticStrain;
    console.log(`[PASS] STR-002: Plastic TET4 converged. eqPlasticStrain=${eqPlasticStrain.toExponential(4)}`);
  } else {
    console.error(`[FAIL] STR-002: Plastic TET4 failed to converge.`);
    process.exit(1);
  }
}

async function runCampaign() {
  console.log("SECP-FEM-UPGRADE-010 Verification Campaign Started");
  console.log("=================================================");
  
  try {
    await runMAT001_ElasticResponse();
    await runMAT003_FirstYield();
    await runMAT013_ConsistentTangent();
    await runSTR002_SingleElementPlasticity();
    
    console.log("\n=================================================");
    console.log("CAMPAIGN RESULT: QUALIFIED_WITHIN_DECLARED_SCOPE");
  } catch (err) {
    console.error("\nCAMPAIGN FAILED");
    console.error(err);
    process.exit(1);
  }
}

runCampaign();
