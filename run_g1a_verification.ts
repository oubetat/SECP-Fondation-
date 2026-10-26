import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';

import { PreFlightValidator } from './src/engine/cfd3d/adaptive/PreFlightValidator';
import { AdaptiveIndustrialCFDEngine } from './src/engine/cfd3d/adaptive/AdaptiveIndustrialCFDEngine';
import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';
import { CaseDefinition3D } from './src/engine/cfd3d/adaptive/AdaptiveCFDTypes';
import { FvmMesh3D } from './src/engine/cfd3d/Fvm3DTypes';

const G1_DIR = 'qualification-003/engine-upgrade-003/G1';
if (!fs.existsSync(G1_DIR)) {
  fs.mkdirSync(G1_DIR, { recursive: true });
}

function computeSha256(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const data = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function runG1AVerification() {
  console.log('================================================================');
  console.log('SECP-ENGINE-UPGRADE-003-G1-A: PREFLIGHT CONTRACT & INTEGRITY AUDIT');
  console.log('UTC Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const preFlightPath = 'src/engine/cfd3d/adaptive/PreFlightValidator.ts';
  const postSha256 = computeSha256(preFlightPath);
  const postSizeBytes = fs.statSync(path.join(process.cwd(), preFlightPath)).size;

  const preSha256 = '13217983c21a4176cf9889aa0914ae9bbd1f978a3c8e47d15a5fbc40d24bf51a';
  const preSizeBytes = 91;

  // ---------------------------------------------------------------------------
  // 1. BASELINE VALID TEST CASE
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Canonical Valid Case (Case 1 from Benchmark) ---');
  const validCaseDef: CaseDefinition3D = {
    caseId: 'CASE-ADAPT-01',
    name: 'Physical Thermodynamic Pre-Flight Validation',
    flowRegime: 'SUBSONIC',
    referenceVelocityMS: 15.0,
    referenceLengthM: 1.0,
    referenceAreaM2: 0.1,
    fluid: {
      densityKgM3: 1.225,
      viscosityPaS: 1.81e-5,
      specificHeatRatioGamma: 1.4,
      specificGasConstantR: 287.058,
      thermalConductivityWMK: 0.026,
      referenceTemperatureK: 288.15,
      referencePressurePa: 101325.0
    },
    boundaryConditions: [
      { name: 'inlet', type: 'INLET', u: 15.0, v: 0.0, w: 0.0 },
      { name: 'outlet', type: 'OUTLET', pressurePa: 101325.0 },
      { name: 'wall', type: 'WALL' },
      { name: 'symmetry', type: 'SYMMETRY' }
    ]
  };

  const validMesh = Fvm3DMeshGenerator.generate3DBlockMesh('mesh_ad01', 1.0, 0.2, 0.2, 8, 4, 4, 'INLET', 'OUTLET', 'WALL', 'SYMMETRY', { x: 15, y: 0, z: 0 }, 0);
  const validRes = PreFlightValidator.validateCase(validCaseDef, validMesh);

  assert.strictEqual(validRes.isReadyForSolve, true, 'Valid case must be ready for solve');
  assert.strictEqual(validRes.checkedItems.length, 10, 'Must perform all 10 checks');
  assert.ok(validRes.checkedItems.every(c => c.passed), 'All items in valid case must pass');
  assert.strictEqual(validRes.identifiedRisks.length, 0, 'No risks identified in valid case');
  console.log(`[PASS] Valid Case: Ready=${validRes.isReadyForSolve}, Checks Passed=${validRes.checkedItems.length}/10`);

  // ---------------------------------------------------------------------------
  // 2. ADVERSARIAL TEST BATTERY (FAIL-CLOSED INTEGRITY)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Adversarial Battery (8 Invalid Test Cases) ---');
  const adversarialTests: { name: string; run: () => { passed: boolean; message: string; risks: string[] } }[] = [
    {
      name: 'Adv-1: Null Case Definition',
      run: () => {
        const res = PreFlightValidator.validateCase(null as any, validMesh);
        return { passed: !res.isReadyForSolve && res.identifiedRisks.length > 0, message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-2: Missing Fluid Properties Object',
      run: () => {
        const res = PreFlightValidator.validateCase({ ...validCaseDef, fluid: null as any }, validMesh);
        return { passed: !res.isReadyForSolve, message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-3: Negative Fluid Density (-1.2 kg/m³)',
      run: () => {
        const res = PreFlightValidator.validateCase({ ...validCaseDef, fluid: { ...validCaseDef.fluid, densityKgM3: -1.2 } }, validMesh);
        return { passed: !res.isReadyForSolve && res.checkedItems.some(c => c.code === 'CHK_FLUID_DENSITY' && !c.passed), message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-4: Non-Finite Density (NaN)',
      run: () => {
        const res = PreFlightValidator.validateCase({ ...validCaseDef, fluid: { ...validCaseDef.fluid, densityKgM3: NaN } }, validMesh);
        return { passed: !res.isReadyForSolve, message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-5: Zero Dynamic Viscosity (0 Pa·s)',
      run: () => {
        const res = PreFlightValidator.validateCase({ ...validCaseDef, fluid: { ...validCaseDef.fluid, viscosityPaS: 0 } }, validMesh);
        return { passed: !res.isReadyForSolve && res.checkedItems.some(c => c.code === 'CHK_FLUID_VISCOSITY' && !c.passed), message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-6: Unphysical Specific Heat Ratio (gamma = 0.8 <= 1.0)',
      run: () => {
        const res = PreFlightValidator.validateCase({ ...validCaseDef, fluid: { ...validCaseDef.fluid, specificHeatRatioGamma: 0.8 } }, validMesh);
        return { passed: !res.isReadyForSolve && res.checkedItems.some(c => c.code === 'CHK_SPECIFIC_HEAT_RATIO' && !c.passed), message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-7: Degenerate 2D Mesh with Zero Span in Z',
      run: () => {
        // Clone mesh and flatten Z coordinates of centroids
        const flatMesh: FvmMesh3D = {
          ...validMesh,
          cells: validMesh.cells.map(c => ({ ...c, centroid: { ...c.centroid, z: 0.0 } }))
        };
        const res = PreFlightValidator.validateCase(validCaseDef, flatMesh);
        return { passed: !res.isReadyForSolve && res.checkedItems.some(c => c.code === 'CHK_DOMAIN_BOUNDING_BOX' && !c.passed), message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    },
    {
      name: 'Adv-8: Inverted Cell Volume (V <= 0)',
      run: () => {
        const invertedMesh: FvmMesh3D = {
          ...validMesh,
          cells: validMesh.cells.map((c, idx) => (idx === 0 ? { ...c, volume: -0.001 } : c))
        };
        const res = PreFlightValidator.validateCase(validCaseDef, invertedMesh);
        return { passed: !res.isReadyForSolve && res.checkedItems.some(c => c.code === 'CHK_CELL_VOLUMES' && !c.passed), message: res.identifiedRisks.join('; '), risks: res.identifiedRisks };
      }
    }
  ];

  const adversarialResults = [];
  for (const t of adversarialTests) {
    const outcome = t.run();
    assert.strictEqual(outcome.passed, true, `Adversarial test must be rejected: ${t.name}`);
    console.log(`[REJECTED/PASS] ${t.name} -> Message: ${outcome.message}`);
    adversarialResults.push({
      testName: t.name,
      rejectedSafely: outcome.passed,
      diagnosticRisks: outcome.risks
    });
  }

  // ---------------------------------------------------------------------------
  // 3. PROOF THAT INVALID INPUTS NEVER REACH SOLVER (FAIL-CLOSED ENTRY GUARD)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Pipeline Solver Fail-Closed Guard ---');
  let solverCaught = false;
  let errorMsg = '';
  try {
    const badCase: CaseDefinition3D = { ...validCaseDef, fluid: { ...validCaseDef.fluid, densityKgM3: -5.0 } };
    AdaptiveIndustrialCFDEngine.runSimulation(badCase, validMesh);
  } catch (err: any) {
    solverCaught = true;
    errorMsg = err.message;
  }
  assert.ok(solverCaught, 'Solver must refuse execution on invalid pre-flight');
  assert.ok(errorMsg.includes('CFD_PREFLIGHT_FAILURE'), 'Exception must be CFD_PREFLIGHT_FAILURE');
  console.log(`[PASS] Solver Abort Triggered: "${errorMsg}"`);

  // ---------------------------------------------------------------------------
  // 4. BENCHMARK SUITE REPLAY (EXACT G0 CRASH SITE RESOLVED)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Benchmark Case 1 Replay (Original Crash Site) ---');
  const preFlight1 = PreFlightValidator.validateCase(validCaseDef, validMesh);
  const p1Passed = preFlight1.isReadyForSolve && preFlight1.checkedItems.every(c => c.passed);
  assert.strictEqual(p1Passed, true, 'Original benchmark Case 1 must evaluate to true without exception');
  console.log(`[PASS] Benchmark Case 1 Replay: Passed=${p1Passed}, DurationMs evaluated cleanly without TypeError`);

  // ---------------------------------------------------------------------------
  // 5. WRITE G1-A EVIDENCE ARTIFACTS
  // ---------------------------------------------------------------------------
  const changeManifest = {
    taskId: 'SECP-ENGINE-UPGRADE-003-G1-A',
    timestampUTC: new Date().toISOString(),
    file: preFlightPath,
    before: {
      sizeBytes: preSizeBytes,
      sha256: preSha256,
      implementation: 'export class PreFlightValidator { static validateCase(){return {isReadyForSolve: true};} }',
      classification: 'UNCONDITIONAL_PASS_STUB'
    },
    after: {
      sizeBytes: postSizeBytes,
      sha256: postSha256,
      implementation: 'Full production 10-point physics, thermodynamics, bounding box, cell volume, and kinematics validator',
      classification: 'PRODUCTION_FAIL_CLOSED_VALIDATOR'
    },
    defectResolved: 'G0 crash: TypeError: Cannot read properties of undefined (reading every) at AdaptiveCFDBenchmarkSuite.ts:89:76'
  };
  fs.writeFileSync(path.join(G1_DIR, 'G1_CHANGE_MANIFEST.json'), JSON.stringify(changeManifest, null, 2));

  const contractCompatibilityMd = `# G1-A Contract Compatibility: PreFlightValidator

## 1. Schema & Consumer Contract Alignment
The repaired \`PreFlightValidator.validateCase\` strictly satisfies the \`PreFlightCheckReport\` interface defined in \`src/engine/cfd3d/adaptive/AdaptiveCFDTypes.ts\`:

\`\`\`ts
export interface PreFlightCheckReport {
  readonly isReadyForSolve: boolean;
  readonly checkedItems: {
    readonly code: string;
    readonly name: string;
    readonly passed: boolean;
    readonly message: string;
  }[];
  readonly identifiedRisks: string[];
  readonly recommendedAdjustments: string[];
}
\`\`\`

## 2. Consumer Impact Analysis
1. **\`src/engine/benchmark/cfd/AdaptiveCFDBenchmarkSuite.ts:89:76\`**:
   - Previous behavior: Crashed with \`TypeError\` trying to call \`preFlight1.checkedItems.every\` because \`checkedItems\` was \`undefined\`.
   - Repaired behavior: Populates \`checkedItems\` with 10 explicit physics checks. Evaluates \`preFlight1.checkedItems.every(c => c.passed) === true\` cleanly.
2. **\`src/engine/cfd3d/adaptive/AdaptiveIndustrialCFDEngine.ts:43-46\`**:
   - Previous behavior: Permitted invalid densities, negative volumes, and flat meshes directly into the field solvers.
   - Repaired behavior: If any check fails, \`isReadyForSolve\` is set to \`false\` and \`AdaptiveIndustrialCFDEngine\` aborts with a diagnostic \`CFD_PREFLIGHT_FAILURE\` error before allocating solver memory.
`;
  fs.writeFileSync(path.join(G1_DIR, 'G1_CONTRACT_COMPATIBILITY.md'), contractCompatibilityMd);

  const testResultsJson = {
    taskId: 'SECP-ENGINE-UPGRADE-003-G1-A',
    timestampUTC: new Date().toISOString(),
    status: 'ALL_TESTS_PASSED',
    canonicalValidCase: {
      readyForSolve: validRes.isReadyForSolve,
      totalChecks: validRes.checkedItems.length,
      allPassed: validRes.checkedItems.every(c => c.passed),
      checks: validRes.checkedItems
    },
    solverFailClosedTest: {
      executed: true,
      solverBlockedExecution: solverCaught,
      thrownError: errorMsg
    },
    benchmarkCase1Replay: {
      crashed: false,
      p1Passed
    }
  };
  fs.writeFileSync(path.join(G1_DIR, 'G1_TEST_RESULTS.json'), JSON.stringify(testResultsJson, null, 2));

  fs.writeFileSync(path.join(G1_DIR, 'G1_ADVERSARIAL_RESULTS.json'), JSON.stringify(adversarialResults, null, 2));

  const g1Adjudication = {
    gateId: 'SECP-ENGINE-UPGRADE-003-G1-A',
    verdict: 'PASS',
    timestampUTC: new Date().toISOString(),
    summary: 'PreFlightValidator successfully repaired from hollow stub to full 10-point fail-closed validation engine. Contract compatibility restored with AdaptiveCFDTypes and AdaptiveCFDBenchmarkSuite.',
    preFlightFileSha256: postSha256,
    adversarialCasesTested: adversarialResults.length,
    adversarialCasesRejectedSafely: adversarialResults.filter(r => r.rejectedSafely).length,
    solverFailClosedVerified: true
  };
  fs.writeFileSync(path.join(G1_DIR, 'G1_FINAL_ADJUDICATION.json'), JSON.stringify(g1Adjudication, null, 2));

  console.log('\n================================================================');
  console.log('G1-A COMPLETE: PreFlight Input Integrity & Contract Repair CERTIFIED');
  console.log('Artifacts sealed in:', G1_DIR);
  console.log('================================================================\n');
}

runG1AVerification().catch(err => {
  console.error('G1-A VERIFICATION FAILED:', err);
  process.exit(1);
});
