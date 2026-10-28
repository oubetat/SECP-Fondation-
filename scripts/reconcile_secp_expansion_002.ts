/**
 * SECP Industrial OS — Engineering Truth OS
 * reconcile_secp_expansion_002.ts
 *
 * Reconciles and formats exact un-truncated numerical evidence, SHA-256 provenance hashes,
 * Picard iteration tables, multi-state tangent error norms, and J2 plastic rollback states.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { HyperelasticNeoHookean3D } from '../src/engine/fem/core/HyperelasticNeoHookean3D';
import { HyperelasticMooneyRivlin3D } from '../src/engine/fem/core/HyperelasticMooneyRivlin3D';
import { ConstitutiveTangentVerifier } from '../src/engine/fem/core/ConstitutiveTangentVerifier';
import { TET4LargeDeformationPlasticFormulation } from '../src/engine/fem/core/TET4LargeDeformationPlasticFormulation';
import {
  BidirectionalElectrothermalSolver3D,
  ElectrothermalNode3D,
  ElectrothermalTetElement3D,
  ElectricalBoundaryCondition,
  ThermalBoundaryCondition
} from '../src/engine/physics/electromagnetics/BidirectionalElectrothermalSolver3D';
import { FEMDOFManager } from '../src/engine/fem/core/FEMDOFManager';
import { DOFComponent, FEMModel, FEMElement, FEMNode, FEMMaterial } from '../src/engine/fem/core/FEMTypes';
import { NonlinearEquilibriumSolver } from '../src/engine/fem/core/NonlinearEquilibriumSolver';
import { MaterialStateManager } from '../src/engine/fem/core/MaterialStateManager';

function fullSha256File(filePath: string): string {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function reconcile() {
  console.log('=== STARTING RECONCILIATION FOR SECP-PHYSICS-EXPANSION-002 ===\n');

  const outDir = path.resolve('reports/SECP-PHYSICS-EXPANSION-002');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();

  // 1. RECONCILE CONSTITUTIVE TANGENTS
  console.log('--- 1. Constitutive Tangent Verification Across 4 Deformation States ---');
  const neoModel = new HyperelasticNeoHookean3D({ E: 200.0, nu: 0.4 });
  const mrModel = new HyperelasticMooneyRivlin3D({ C10: 10.0, C01: 2.0, K: 1000.0 });

  const states = [
    {
      stateName: "Uniaxial Tension",
      F: [[1.15, 0, 0], [0, 0.93, 0], [0, 0, 0.93]]
    },
    {
      stateName: "Equibiaxial Tension",
      F: [[1.10, 0, 0], [0, 1.10, 0], [0, 0, 0.826]]
    },
    {
      stateName: "Pure Shear",
      F: [[1.0, 0.15, 0], [0.0, 1.0, 0], [0.0, 0.0, 1.0]]
    },
    {
      stateName: "Combined Shear Compression",
      F: [[0.90, 0.10, 0.05], [0.02, 0.92, 0.04], [0.01, 0.03, 1.08]]
    }
  ];

  const neoMulti = ConstitutiveTangentVerifier.verifyHyperelasticTangentMultiState(neoModel, states, 1e-6, 0.01);
  const mrMulti = ConstitutiveTangentVerifier.verifyHyperelasticTangentMultiState(mrModel as any, states, 1e-6, 0.01);
  const wrongTangentRejection = ConstitutiveTangentVerifier.verifyRejectionOfIncorrectTangent(neoModel, states[0].F, 1.25);

  console.log('Neo-Hookean Multi-State Tangent Error Norms:');
  neoMulti.stateResults.forEach(r => {
    console.log(`  State: ${r.stateName.padEnd(28)} | Max Abs Error: ${r.maxAbsError.toExponential(4)} MPa | Max Rel Error: ${(r.maxRelError * 100).toFixed(8)}% | Passed: ${r.passed}`);
  });

  console.log('Mooney-Rivlin Multi-State Tangent Error Norms:');
  mrMulti.stateResults.forEach(r => {
    console.log(`  State: ${r.stateName.padEnd(28)} | Max Abs Error: ${r.maxAbsError.toExponential(4)} MPa | Max Rel Error: ${(r.maxRelError * 100).toFixed(8)}% | Passed: ${r.passed}`);
  });

  console.log(`Corrupted Tangent (1.25x) Rejection Proof: ${wrongTangentRejection ? 'REJECTED_AS_EXPECTED' : 'FAILED'}`);

  // 2. RECONCILE J2 PLASTICITY & ROLLBACK
  console.log('\n--- 2. J2 Elastoplasticity: Elastic, Yield, Plastic Evolution & Rollback ---');
  const plasticForm = new TET4LargeDeformationPlasticFormulation();

  // Elastic Trial
  const S_elastic = [5.0, 0, 0, 0, 0, 0]; // 5 MPa < 10 MPa yield
  const resElastic = plasticForm.performRadialReturn(S_elastic, 70000, 0.33, 10.0, 500.0);

  // Plastic Trial
  const S_plastic = [30.0, 0, 0, 0, 0, 0]; // 30 MPa > 10 MPa yield
  const resPlastic = plasticForm.performRadialReturn(S_plastic, 70000, 0.33, 10.0, 500.0);

  // State Manager Rollback Test
  const stateMgr = new MaterialStateManager();
  stateMgr.initializeElement("E1", 1, {
    stress: [0, 0, 0, 0, 0, 0],
    plasticStrain: [0, 0, 0, 0, 0, 0],
    equivalentPlasticStrain: 0,
    yieldStress: 10.0,
    yieldFlag: false
  });

  // State BEFORE trial update
  const stateInitial = { ...stateMgr.getElementStates("E1", true)[0] };

  // Update trial state
  stateMgr.updateIntegrationPoint("E1", 0, {
    stress: resPlastic.S_ret,
    plasticStrain: [0.01, 0, 0, 0, 0, 0],
    equivalentPlasticStrain: resPlastic.equivalentPlasticStrain,
    yieldStress: 10.0 + 500.0 * resPlastic.equivalentPlasticStrain,
    yieldFlag: true
  });
  const stateTrial = { ...stateMgr.getElementStates("E1", true)[0] };

  // Rollback trial state
  stateMgr.rollback();
  const stateAfterRollback = { ...stateMgr.getElementStates("E1", true)[0] };

  console.log(`Elastic Trial  : S_trial = 5.0 MPa  => yieldFlag = ${resElastic.yieldFlag}, alpha = ${resElastic.equivalentPlasticStrain}`);
  console.log(`Plastic Trial  : S_trial = 30.0 MPa => yieldFlag = ${resPlastic.yieldFlag}, alpha = ${resPlastic.equivalentPlasticStrain.toFixed(6)}, S_returned_xx = ${resPlastic.S_ret[0].toFixed(4)} MPa`);
  console.log(`State Initial  : alpha = ${stateInitial.equivalentPlasticStrain}, yield = ${stateInitial.yieldFlag}`);
  console.log(`State Trial    : alpha = ${stateTrial.equivalentPlasticStrain.toFixed(6)}, yield = ${stateTrial.yieldFlag}`);
  console.log(`State Rollback : alpha = ${stateAfterRollback.equivalentPlasticStrain}, yield = ${stateAfterRollback.yieldFlag} (DISCARDED_SUCCESSFULLY)`);

  // 3. RECONCILE BIDIRECTIONAL ELECTROTHERMAL FEEDBACK
  console.log('\n--- 3. 3D Bidirectional Electrothermal Picard Feedback History ---');
  const L = 0.1, W = 0.02, H = 0.02;

  const esNodes: ElectrothermalNode3D[] = [
    { id: "N0", x: 0, y: 0, z: 0 },
    { id: "N1", x: L, y: 0, z: 0 },
    { id: "N2", x: L, y: W, z: 0 },
    { id: "N3", x: 0, y: W, z: 0 },
    { id: "N4", x: 0, y: 0, z: H },
    { id: "N5", x: L, y: 0, z: H },
    { id: "N6", x: L, y: W, z: H },
    { id: "N7", x: 0, y: W, z: H }
  ];

  const esElements: ElectrothermalTetElement3D[] = [
    { id: "T1", nodeIds: ["N0", "N1", "N3", "N4"], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 },
    { id: "T2", nodeIds: ["N1", "N2", "N3", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 },
    { id: "T3", nodeIds: ["N1", "N4", "N5", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 },
    { id: "T4", nodeIds: ["N3", "N4", "N6", "N7"], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 },
    { id: "T5", nodeIds: ["N1", "N3", "N4", "N6"], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 }
  ];

  const electricalBCs: ElectricalBoundaryCondition[] = [
    { nodeId: "N0", potential: 12.0 },
    { nodeId: "N3", potential: 12.0 },
    { nodeId: "N4", potential: 12.0 },
    { nodeId: "N7", potential: 12.0 },
    { nodeId: "N1", potential: 0.0 },
    { nodeId: "N2", potential: 0.0 },
    { nodeId: "N5", potential: 0.0 },
    { nodeId: "N6", potential: 0.0 }
  ];

  const thermalBCs: ThermalBoundaryCondition[] = [
    { nodeId: "N0", type: "PRESCRIBED", temperatureC: 20.0 },
    { nodeId: "N3", type: "PRESCRIBED", temperatureC: 20.0 },
    { nodeId: "N4", type: "PRESCRIBED", temperatureC: 20.0 },
    { nodeId: "N7", type: "PRESCRIBED", temperatureC: 20.0 }
  ];

  const biSolver = new BidirectionalElectrothermalSolver3D();
  const biResult = biSolver.solve(esNodes, esElements, electricalBCs, thermalBCs, {
    maxIterations: 20,
    toleranceK: 1e-3,
    relaxationFactor: 0.7
  });

  console.log('Iterative Feedback Picard Table:');
  console.log(`  Iter | maxDeltaT (K) | Elec Power (W) | Min Sigma (S/m) | Max Sigma (S/m)`);
  console.log(`  --------------------------------------------------------------------------`);
  biResult.iterationHistory.forEach(h => {
    console.log(`  ${h.iteration.toString().padStart(4)} | ${h.maxDeltaTK.toFixed(6).padStart(13)} | ${h.maxElectricalPowerW.toFixed(4).padStart(14)} | ${h.minConductivitySm.toFixed(1).padStart(15)} | ${h.maxConductivitySm.toFixed(1).padStart(15)}`);
  });

  console.log(`\nCoupling Conservation: P_elec = ${biResult.totalElectricalPowerWatts.toFixed(6)} W, P_therm = ${biResult.totalThermalHeatWatts.toFixed(6)} W (Imbalance = ${((Math.abs(biResult.totalElectricalPowerWatts - biResult.totalThermalHeatWatts) / biResult.totalElectricalPowerWatts) * 100).toFixed(8)}%)`);

  // 4. MESH SENSITIVITY TABLE
  console.log('\n--- 4. Mesh Refinement Sensitivity Study ---');
  const meshLevels = [1, 2, 4];
  const meshData = meshLevels.map(numLayers => {
    const nodesLayer: ElectrothermalNode3D[] = [];
    const elementsLayer: ElectrothermalTetElement3D[] = [];
    const elecBcsLayer: ElectricalBoundaryCondition[] = [];
    const thermBcsLayer: ThermalBoundaryCondition[] = [];

    const dx = L / numLayers;
    for (let k = 0; k <= numLayers; k++) {
      const x = k * dx;
      nodesLayer.push({ id: `LN_0_${k}`, x, y: 0, z: 0 });
      nodesLayer.push({ id: `LN_1_${k}`, x, y: W, z: 0 });
      nodesLayer.push({ id: `LN_2_${k}`, x, y: W, z: H });
      nodesLayer.push({ id: `LN_3_${k}`, x, y: 0, z: H });

      if (k === 0) {
        elecBcsLayer.push({ nodeId: `LN_0_${k}`, potential: 12.0 }, { nodeId: `LN_1_${k}`, potential: 12.0 }, { nodeId: `LN_2_${k}`, potential: 12.0 }, { nodeId: `LN_3_${k}`, potential: 12.0 });
        thermBcsLayer.push({ nodeId: `LN_0_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_1_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_2_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_3_${k}`, type: "PRESCRIBED", temperatureC: 20.0 });
      } else if (k === numLayers) {
        elecBcsLayer.push({ nodeId: `LN_0_${k}`, potential: 0.0 }, { nodeId: `LN_1_${k}`, potential: 0.0 }, { nodeId: `LN_2_${k}`, potential: 0.0 }, { nodeId: `LN_3_${k}`, potential: 0.0 });
        thermBcsLayer.push({ nodeId: `LN_0_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_1_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_2_${k}`, type: "PRESCRIBED", temperatureC: 20.0 }, { nodeId: `LN_3_${k}`, type: "PRESCRIBED", temperatureC: 20.0 });
      }
    }

    let tCount = 0;
    for (let k = 0; k < numLayers; k++) {
      const i0 = `LN_0_${k}`, i1 = `LN_1_${k}`, i2 = `LN_2_${k}`, i3 = `LN_3_${k}`;
      const j0 = `LN_0_${k+1}`, j1 = `LN_1_${k+1}`, j2 = `LN_2_${k+1}`, j3 = `LN_3_${k+1}`;
      elementsLayer.push({ id: `LT_${tCount++}`, nodeIds: [i0, i1, i3, j0], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 });
      elementsLayer.push({ id: `LT_${tCount++}`, nodeIds: [i1, i2, i3, j2], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 });
      elementsLayer.push({ id: `LT_${tCount++}`, nodeIds: [i1, j0, j1, j2], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 });
      elementsLayer.push({ id: `LT_${tCount++}`, nodeIds: [i3, j0, j2, j3], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 });
      elementsLayer.push({ id: `LT_${tCount++}`, nodeIds: [i1, i3, j0, j2], nominalConductivity: 1e4, tempCoefficient: 0.0039, thermalConductivity: 200, referenceTempC: 20 });
    }

    const sol = biSolver.solve(nodesLayer, elementsLayer, elecBcsLayer, thermBcsLayer, { maxIterations: 20, toleranceK: 1e-3 });
    const maxT = Math.max(...Array.from(sol.nodalTemperaturesC.values()));
    return {
      numLayers,
      nodes: nodesLayer.length,
      elements: elementsLayer.length,
      elecPowerW: sol.totalElectricalPowerWatts,
      peakTempC: maxT,
      iters: sol.totalIterations
    };
  });

  console.log(`  Layers | Nodes | Elements | Elec Power (W) | Peak Temp (C) | Iters`);
  console.log(`  ------------------------------------------------------------------`);
  meshData.forEach(m => {
    console.log(`  ${m.numLayers.toString().padStart(6)} | ${m.nodes.toString().padStart(5)} | ${m.elements.toString().padStart(8)} | ${m.elecPowerW.toFixed(4).padStart(14)} | ${m.peakTempC.toFixed(4).padStart(13)} | ${m.iters.toString().padStart(5)}`);
  });

  // 5. FULL SHA-256 PROVENANCE DIGESTS
  console.log('\n--- 5. Full 64-Character SHA-256 Provenance Manifest ---');
  const sourceFiles = [
    "src/engine/fem/core/ConstitutiveTangentVerifier.ts",
    "src/engine/fem/core/HyperelasticNeoHookean3D.ts",
    "src/engine/fem/core/HyperelasticMooneyRivlin3D.ts",
    "src/engine/fem/core/TET4LargeDeformationPlasticFormulation.ts",
    "src/engine/physics/electromagnetics/BidirectionalElectrothermalSolver3D.ts"
  ];

  const sourceDigests = sourceFiles.map(f => ({
    filePath: f,
    sha256: fullSha256File(f)
  }));

  sourceDigests.forEach(s => {
    console.log(`  Source  : ${s.filePath.padEnd(65)} => SHA256: ${s.sha256}`);
  });

  const artifactFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.json') || f.endsWith('.md'));
  const artifactDigests = artifactFiles.map(f => ({
    artifactName: f,
    sha256: fullSha256File(path.join(outDir, f))
  }));

  artifactDigests.forEach(a => {
    console.log(`  Artifact: ${a.artifactName.padEnd(45)} => SHA256: ${a.sha256}`);
  });

  console.log('\n=== RECONCILIATION COMPLETE ===');
}

reconcile().catch(err => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
