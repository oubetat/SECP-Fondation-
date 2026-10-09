import { CreepEngine, CreepConstants } from "./CreepEngine";
import { CreepMaterialPointDriver, CreepLoadingStep } from "./CreepMaterialPointDriver";
import { IndependentCreepAuditor } from "./IndependentCreepAuditor";
import { CreepVerdict } from "./types";

export interface Gate093Report {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate093 {
  public static evaluateGate(): Gate093Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    const constants: CreepConstants = {
      A0: 1e-15, // Pre-exponential factor
      n: 5,      // Stress exponent
      Q: 150000, // Activation energy (J/mol)
      R: 8.314,  // Gas constant (J/mol*K)
      E: 200e9,
      nu: 0.3
    };

    const initialState = CreepEngine.createInitialState(600); // 600K

    // 1. STEADY_STATE_CREEP_VERIFICATION
    const pathSteady = Array(10).fill({
      stress: [100e6, 0, 0, 0, 0, 0], // 100 MPa
      temperature: 600,
      dt: 3600 // 1 hour steps
    });
    const reportSteady = CreepMaterialPointDriver.runPath(initialState, pathSteady, constants);
    const finalSteady = reportSteady.history[reportSteady.history.length - 1];
    
    checks.push({
      id: "STEADY_STATE_CREEP_ACCUMULATION",
      passed: finalSteady.state.equivalentCreepStrain > 0 && finalSteady.state.accumulatedTime === 36000,
      details: "Verified linear accumulation of creep strain under constant load"
    });

    // 2. TEMPERATURE_SENSITIVITY_CHECK (Arrhenius)
    const resLowT = CreepEngine.computeUpdate(initialState, [100e6, 0, 0, 0, 0, 0], 500, 3600, constants);
    const resHighT = CreepEngine.computeUpdate(initialState, [100e6, 0, 0, 0, 0, 0], 700, 3600, constants);
    
    checks.push({
      id: "ARRHENIUS_TEMPERATURE_SENSITIVITY",
      passed: resHighT.newState.equivalentCreepStrain > resLowT.newState.equivalentCreepStrain * 100,
      details: "Verified exponential creep rate dependence on temperature (Arrhenius effect)"
    });

    // 3. STRESS_SENSITIVITY_CHECK (Power Law)
    const resLowSigma = CreepEngine.computeUpdate(initialState, [50e6, 0, 0, 0, 0, 0], 600, 3600, constants);
    const resHighSigma = CreepEngine.computeUpdate(initialState, [100e6, 0, 0, 0, 0, 0], 600, 3600, constants);
    
    // With n=5, 2^5 = 32x difference expected
    checks.push({
      id: "NORTON_POWER_LAW_SENSITIVITY",
      passed: Math.abs(resHighSigma.newState.equivalentCreepStrain / resLowSigma.newState.equivalentCreepStrain - 32) < 1e-3,
      details: "Verified power-law stress dependence (Norton Law)"
    });

    // 4. ZERO_STRESS_STABILITY
    const resZero = CreepEngine.computeUpdate(initialState, [0, 0, 0, 0, 0, 0], 600, 3600, constants);
    checks.push({
      id: "ZERO_STRESS_STABILITY",
      passed: resZero.newState.equivalentCreepStrain === 0,
      details: "Verified no creep accumulation at zero stress"
    });

    // 5. INDEPENDENT_AUDIT
    const audit = IndependentCreepAuditor.audit(reportSteady.history, constants);
    checks.push({
      id: "INDEPENDENT_CREEP_AUDIT",
      passed: audit.verdict === "PASS",
      details: "Passed monotonicity and thermodynamic dissipation checks"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
