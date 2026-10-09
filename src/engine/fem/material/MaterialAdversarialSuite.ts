import { J2PlasticityModel } from "./J2PlasticityModel";
import { MaterialState } from "./MaterialState";
import { MaterialStateHasher } from "./MaterialStateHasher";

export interface AdversarialCheckResult {
  testId: string;
  category: 'PARAMETER' | 'STATE' | 'CONSTITUTIVE' | 'ROLLBACK' | 'HASH';
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export interface MaterialAdversarialReport {
  allPassed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: AdversarialCheckResult[];
}

export class MaterialAdversarialSuite {
  static runAllAdversarialTests(): MaterialAdversarialReport {
    const results: AdversarialCheckResult[] = [];

    // 1. Invalid E <= 0
    try {
      new J2PlasticityModel({ E: -200e9, nu: 0.3, yieldStress: 250e6, hardeningModulus: 10e9 });
      results.push({
        testId: "ADV_NEG_E",
        category: "PARAMETER",
        description: "Rejection of negative Young's modulus E",
        passed: false,
        verdict: "FAILED_TO_REJECT",
        details: "Constructor accepted negative E"
      });
    } catch (e: any) {
      results.push({
        testId: "ADV_NEG_E",
        category: "PARAMETER",
        description: "Rejection of negative Young's modulus E",
        passed: true,
        verdict: "INVALID_PARAMETERS",
        details: `Correctly rejected: ${e.message}`
      });
    }

    // 2. Invalid Poisson's ratio >= 0.5 (incompressibility violation)
    try {
      new J2PlasticityModel({ E: 200e9, nu: 0.55, yieldStress: 250e6, hardeningModulus: 10e9 });
      results.push({
        testId: "ADV_INVALID_NU",
        category: "PARAMETER",
        description: "Rejection of Poisson ratio nu >= 0.5",
        passed: false,
        verdict: "FAILED_TO_REJECT",
        details: "Constructor accepted nu >= 0.5"
      });
    } catch (e: any) {
      results.push({
        testId: "ADV_INVALID_NU",
        category: "PARAMETER",
        description: "Rejection of Poisson ratio nu >= 0.5",
        passed: true,
        verdict: "INVALID_PARAMETERS",
        details: `Correctly rejected: ${e.message}`
      });
    }

    // 3. Negative yield stress
    try {
      new J2PlasticityModel({ E: 200e9, nu: 0.3, yieldStress: -100e6, hardeningModulus: 10e9 });
      results.push({
        testId: "ADV_NEG_YIELD",
        category: "PARAMETER",
        description: "Rejection of negative yield stress",
        passed: false,
        verdict: "FAILED_TO_REJECT",
        details: "Constructor accepted negative yield stress"
      });
    } catch (e: any) {
      results.push({
        testId: "ADV_NEG_YIELD",
        category: "PARAMETER",
        description: "Rejection of negative yield stress",
        passed: true,
        verdict: "INVALID_PARAMETERS",
        details: `Correctly rejected: ${e.message}`
      });
    }

    // 4. Negative hardening modulus
    try {
      new J2PlasticityModel({ E: 200e9, nu: 0.3, yieldStress: 250e6, hardeningModulus: -1e9 });
      results.push({
        testId: "ADV_NEG_HARDENING",
        category: "PARAMETER",
        description: "Rejection of negative hardening modulus H",
        passed: false,
        verdict: "FAILED_TO_REJECT",
        details: "Constructor accepted negative hardening modulus"
      });
    } catch (e: any) {
      results.push({
        testId: "ADV_NEG_HARDENING",
        category: "PARAMETER",
        description: "Rejection of negative hardening modulus H",
        passed: true,
        verdict: "INVALID_PARAMETERS",
        details: `Correctly rejected: ${e.message}`
      });
    }

    // 5. NaN in Strain Increment
    const validModel = new J2PlasticityModel({ E: 200e9, nu: 0.3, yieldStress: 250e6, hardeningModulus: 10e9, planeState: '3D' });
    const state = MaterialState.createInitial(6);
    const nanRes = validModel.updateConstitutive([0.001, NaN, 0.0, 0.0, 0.0, 0.0], state);
    results.push({
      testId: "ADV_NAN_STRAIN",
      category: "CONSTITUTIVE",
      description: "Detection and safe rejection of NaN strain increment",
      passed: !nanRes.converged && nanRes.verdict === 'INVALID_PARAMETERS',
      verdict: nanRes.verdict,
      details: nanRes.diagnostics || "Correctly flagged invalid parameters"
    });

    // 6. Inf in Strain Increment
    const infRes = validModel.updateConstitutive([Infinity, 0.0, 0.0, 0.0, 0.0, 0.0], state);
    results.push({
      testId: "ADV_INF_STRAIN",
      category: "CONSTITUTIVE",
      description: "Detection and safe rejection of Infinity strain increment",
      passed: !infRes.converged && infRes.verdict === 'INVALID_PARAMETERS',
      verdict: infRes.verdict,
      details: infRes.diagnostics || "Correctly flagged invalid parameters"
    });

    // 7. Corrupted Material State Detection (negative kappa and strain split violation)
    const corruptedState = state.clone();
    corruptedState.equivalentPlasticStrain = -0.5;
    corruptedState.plasticStrain = [0.05, 0.0, 0.0, 0.0, 0.0, 0.0];
    corruptedState.elasticStrain = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    corruptedState.totalStrain = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

    const valReport = MaterialStateHasher.validateStateIntegrity(corruptedState);
    results.push({
      testId: "ADV_CORRUPTED_STATE",
      category: "STATE",
      description: "State validator detects negative kappa & strain split violations",
      passed: !valReport.isValid && valReport.errors.length >= 2,
      verdict: valReport.isValid ? "UNCAUGHT_CORRUPTION" : "INVALID_STATE",
      details: `Detected violations: ${valReport.errors.join("; ")}`
    });

    // 8. Hash Alteration Detection
    const originalHash = MaterialStateHasher.hashState(state);
    const tamperedState = state.clone();
    tamperedState.stress[0] = 100.0;
    const tamperedHash = MaterialStateHasher.hashState(tamperedState);
    results.push({
      testId: "ADV_HASH_ALTERATION",
      category: "HASH",
      description: "Cryptographic hash reflects any stress/state mutation",
      passed: originalHash !== tamperedHash,
      verdict: "VERIFIED",
      details: `Original=${originalHash.slice(0, 12)}..., Tampered=${tamperedHash.slice(0, 12)}...`
    });

    const passedCount = results.filter(r => r.passed).length;
    return {
      allPassed: passedCount === results.length,
      totalTests: results.length,
      passedTests: passedCount,
      failedTests: results.length - passedCount,
      results
    };
  }
}
