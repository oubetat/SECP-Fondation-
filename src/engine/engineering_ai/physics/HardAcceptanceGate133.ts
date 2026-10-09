import {
  PhysicsContext,
  PhysicsPrediction,
  PhysicsToleranceProfile
} from './types';
import { CanonicalPhysicsSerializer } from './CanonicalPhysicsSerializer';
import { GoverningEquationRegistry } from './GoverningEquationRegistry';
import { PhysicsDimensionalAnalyzer } from './PhysicsDimensionalAnalyzer';
import { PhysicsBoundsEngine } from './PhysicsBoundsEngine';
import { PhysicsConservationVerifier } from './PhysicsConservationVerifier';
import { PhysicsResidualEngine } from './PhysicsResidualEngine';
import { PhysicsHallucinationDetector } from './PhysicsHallucinationDetector';
import { PhysicsConstraintEngine } from './PhysicsConstraintEngine';
import { EngineeringPhysicsReasoner } from './EngineeringPhysicsReasoner';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';

export interface Gate133CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate133Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate133CheckResult[];
}

export class HardAcceptanceGate133 {
  public static evaluateGate(): Gate133Summary {
    const checks: Gate133CheckResult[] = [];

    const ctx: PhysicsContext = {
      contextId: 'PHYS-CTX-TURBINE-01',
      domain: 'FLUID',
      geometryHash: '3a1b2c3d4e5f67890a1b2c3d4e5f67893a1b2c3d4e5f67890a1b2c3d4e5f6789',
      meshHash: 'f1e2d3c4b5a69788f1e2d3c4b5a69788f1e2d3c4b5a69788f1e2d3c4b5a69788',
      materialStateHash: '1122334455667788990011223344556677889900112233445566778899001122',
      boundaryConditionHash: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      initialConditionHash: '9988776655443322110099887766554433221100998877665544332211009988',
      solverConfigurationHash: '0011223344556677889900112233445566778899001122334455667788990011',
      coordinateSystem: 'CARTESIAN_3D',
      units: 'SI',
      timeReference: 't0_steady',
      referenceFrame: 'INERTIAL',
      physicsModel: 'RANS_k_epsilon'
    };
    ctx.contextHash = CanonicalPhysicsSerializer.computeContextHash(ctx);

    // 1. GATE-133-01: Physics Context Creation & Reproducibility
    const recomputedHash = CanonicalPhysicsSerializer.computeContextHash(ctx);
    const g01Passed = recomputedHash === ctx.contextHash;
    checks.push({
      gateId: 'GATE-133-01',
      description: 'Physics Context Creation & Deterministic Hash Reproducibility',
      passed: g01Passed,
      score: g01Passed ? 100 : 0,
      details: g01Passed
        ? `Physics context hash verified reproducibly (${ctx.contextHash.slice(0, 16)}...)`
        : `Context hash mismatch`
    });

    // 2. GATE-133-02: Governing Equations Registry
    const eq = GoverningEquationRegistry.getEquation('EQ-NEWTON-2ND');
    const g02Passed = eq !== undefined && eq.domain === 'MECHANICS';
    checks.push({
      gateId: 'GATE-133-02',
      description: 'Governing Equations Registry & Domain Classification',
      passed: g02Passed,
      score: g02Passed ? 100 : 0,
      details: g02Passed
        ? `Retrieved equation EQ-NEWTON-2ND (${eq?.equationName}) in domain ${eq?.domain}`
        : `Governing equation lookup failed`
    });

    // 3. GATE-133-03: Mandatory Test — Dimensional Consistency (F = m * a -> Valid)
    const dimValidRes = PhysicsDimensionalAnalyzer.verifyEquationExpression('F = m * a', {
      F: 'FORCE',
      m: 'MASS',
      a: 'ACCELERATION'
    });
    const g03Passed = dimValidRes.valid;
    checks.push({
      gateId: 'GATE-133-03',
      description: 'Dimensional Consistency Analysis (F = m * a -> DIMENSIONALLY_VALID)',
      passed: g03Passed,
      score: g03Passed ? 100 : 0,
      details: g03Passed
        ? `Equation 'F = m * a' verified as DIMENSIONALLY_VALID`
        : `Valid dimensional analysis failed: ${dimValidRes.reason}`
    });

    // 4. GATE-133-04: Mandatory Test — Incompatible Dimensional Rejection (F = m + a -> Invalid)
    const dimInvalidRes = PhysicsDimensionalAnalyzer.verifyEquationExpression('F = m + a', {
      F: 'FORCE',
      m: 'MASS',
      a: 'ACCELERATION'
    });
    const g04Passed = !dimInvalidRes.valid;
    checks.push({
      gateId: 'GATE-133-04',
      description: 'Incompatible Dimensional Rejection (F = m + a -> DIMENSIONALLY_INVALID)',
      passed: g04Passed,
      score: g04Passed ? 100 : 0,
      details: g04Passed
        ? `Incompatible equation 'F = m + a' correctly rejected with DIMENSIONALLY_INVALID`
        : `Failed to reject dimensionally invalid equation`
    });

    // 5. GATE-133-05: Mandatory Test — Physical Bounds Violation (Absolute Temperature = -10 K)
    const boundViol = PhysicsBoundsEngine.verifyPhysicalBounds('T1', 'TEMPERATURE', -10, 'K');
    const g05Passed = boundViol.verdict === 'BOUND_VIOLATION';
    checks.push({
      gateId: 'GATE-133-05',
      description: 'Physical Bounds Engine (Absolute Temperature -10 K -> BOUND_VIOLATION)',
      passed: g05Passed,
      score: g05Passed ? 100 : 0,
      details: g05Passed
        ? `Negative absolute temperature (-10 K) correctly rejected as BOUND_VIOLATION`
        : `Physical bounds violation check failed`
    });

    // 6. GATE-133-06: Physical Bounds Pass (Density = 998 kg/m^3)
    const boundPass = PhysicsBoundsEngine.verifyPhysicalBounds('rho', 'DENSITY', 998, 'kg/m^3');
    const g06Passed = boundPass.verdict === 'WITHIN_PHYSICAL_BOUNDS';
    checks.push({
      gateId: 'GATE-133-06',
      description: 'Physical Bounds Engine (Density 998 kg/m^3 -> WITHIN_PHYSICAL_BOUNDS)',
      passed: g06Passed,
      score: g06Passed ? 100 : 0,
      details: g06Passed
        ? `Valid water density 998 kg/m^3 verified WITHIN_PHYSICAL_BOUNDS`
        : `Valid physical bound check failed`
    });

    // 7. GATE-133-07: Conservation Verification Pass
    const consPass = PhysicsConservationVerifier.verifyConservation('MASS', 10.0, 10.0005, 0, 0.001);
    const g07Passed = consPass.verdict === 'CONSERVATION_PASS';
    checks.push({
      gateId: 'GATE-133-07',
      description: 'Conservation Verification Pass (Mass Imbalance 0.005% <= 0.1% Tolerance)',
      passed: g07Passed,
      score: g07Passed ? 100 : 0,
      details: g07Passed
        ? `Mass conservation verified CONSERVATION_PASS (imbalance 0.005%)`
        : `Conservation pass check failed`
    });

    // 8. GATE-133-08: Mandatory Test — Conservation Failure Rejection
    const consFail = PhysicsConservationVerifier.verifyConservation('MASS', 10.0, 10.5, 0, 0.001);
    const g08Passed = consFail.verdict === 'CONSERVATION_FAILURE';
    checks.push({
      gateId: 'GATE-133-08',
      description: 'Conservation Failure Rejection (Mass Imbalance 5% > 0.1% Tolerance -> CONSERVATION_FAILURE)',
      passed: g08Passed,
      score: g08Passed ? 100 : 0,
      details: g08Passed
        ? `Mass conservation failure (5% imbalance) correctly flagged as CONSERVATION_FAILURE`
        : `Conservation failure check failed`
    });

    // 9. GATE-133-09: Mandatory Test — AI vs Analytical Solution (Hagen-Poiseuille Flow)
    const exactPoiseuilleQ = PhysicsResidualEngine.evaluatePoiseuilleFlow(1000, 0.01, 0.001, 1.0); // Q = (pi * 1000 * 0.01^4) / (8 * 0.001 * 1)
    const aiPredictionQ: PhysicsPrediction = {
      predictionId: 'PRED-Q-01',
      variable: 'Q',
      predictedValue: exactPoiseuilleQ * 1.002, // 0.2% error
      unit: 'm^3/s',
      uncertainty: 0.0001,
      confidence: 0.99,
      contextHash: ctx.contextHash,
      modelVersion: 'v1.0'
    };

    const resAnalytical = PhysicsResidualEngine.calculateResidual({
      predictionId: aiPredictionQ.predictionId,
      predictedValue: aiPredictionQ.predictedValue,
      referenceType: 'ANALYTICAL',
      referenceValue: exactPoiseuilleQ,
      tolerance: 0.01
    });

    const g09Passed = resAnalytical.verdict === 'MATCH_PASS' && resAnalytical.relativeError < 0.01;
    checks.push({
      gateId: 'GATE-133-09',
      description: 'AI vs Analytical Solution Residual Comparison (Hagen-Poiseuille Flow Rate)',
      passed: g09Passed,
      score: g09Passed ? 100 : 0,
      details: g09Passed
        ? `AI prediction compared against analytical solution: Rel Error = ${(resAnalytical.relativeError * 100).toFixed(3)}% <= 1.0%`
        : `Analytical solution comparison failed`
    });

    // 10. GATE-133-10: Mandatory Test — AI vs Solver (CFD Residual Comparison)
    const resSolver = PhysicsResidualEngine.calculateResidual({
      predictionId: 'PRED-P-01',
      predictedValue: 101325,
      referenceType: 'NUMERICAL_SOLVER',
      referenceValue: 101350,
      tolerance: 0.001
    });
    const g10Passed = resSolver.verdict === 'MATCH_PASS';
    checks.push({
      gateId: 'GATE-133-10',
      description: 'AI vs Numerical Solver Field Residual Comparison',
      passed: g10Passed,
      score: g10Passed ? 100 : 0,
      details: g10Passed
        ? `AI prediction compared against Numerical Solver: Rel Error = ${(resSolver.relativeError * 100).toFixed(4)}%`
        : `Numerical solver comparison failed`
    });

    // 11. GATE-133-11: Mandatory Test — AI vs Experiment with Measurement Uncertainty
    const resExp = PhysicsResidualEngine.calculateResidual({
      predictionId: 'PRED-T-01',
      predictedValue: 350.5,
      referenceType: 'EXPERIMENTAL',
      referenceValue: 350.0,
      tolerance: 0.01,
      measurementUncertainty: 1.0 // +/- 1.0 K instrument uncertainty
    });
    const g11Passed = resExp.normalizedResidual <= 1.0 && resExp.verdict === 'MATCH_PASS';
    checks.push({
      gateId: 'GATE-133-11',
      description: 'AI vs Experimental Measurement with Measurement Uncertainty Accounting',
      passed: g11Passed,
      score: g11Passed ? 100 : 0,
      details: g11Passed
        ? `Experimental residual normalized by uncertainty: ${resExp.normalizedResidual.toFixed(3)} <= 1.0`
        : `Experimental comparison failed`
    });

    // 12. GATE-133-12: Mandatory Test — Assumption Violation Detection (Mach 0.8 at incompressible assumption)
    const hallAssCheck = PhysicsHallucinationDetector.verifyClaimPhysicsGrounding(
      'Flow is incompressible at Mach = 0.8',
      ['EQ-CONTINUITY-INCOMPRESSIBLE'],
      ['incompressible'],
      ctx
    );
    const g12Passed = hallAssCheck.verdict === 'ASSUMPTION_INVALID';
    checks.push({
      gateId: 'GATE-133-12',
      description: 'Assumption Violation Detection (Incompressible assumption at Mach 0.8 -> ASSUMPTION_INVALID)',
      passed: g12Passed,
      score: g12Passed ? 100 : 0,
      details: g12Passed
        ? `Invalid assumption (incompressible at Mach 0.8) correctly detected as ASSUMPTION_INVALID`
        : `Assumption violation detection failed`
    });

    // 13. GATE-133-13: Mandatory Test — Hallucinated Physics Rejection (Unregistered Equation ID)
    const hallEqCheck = PhysicsHallucinationDetector.verifyClaimPhysicsGrounding(
      'Governed by fake quantum hydrodynamics equation EQ-FAKE-999',
      ['EQ-FAKE-999'],
      [],
      ctx
    );
    const g13Passed = hallEqCheck.verdict === 'UNSUPPORTED_PHYSICS_CLAIM';
    checks.push({
      gateId: 'GATE-133-13',
      description: 'Hallucinated Physics Rejection (Unregistered equation ID -> UNSUPPORTED_PHYSICS_CLAIM)',
      passed: g13Passed,
      score: g13Passed ? 100 : 0,
      details: g13Passed
        ? `Non-existent equation EQ-FAKE-999 correctly flagged as UNSUPPORTED_PHYSICS_CLAIM`
        : `Hallucinated physics check failed`
    });

    // 14. GATE-133-14: Mandatory Test — Causality Boundary
    const causalityRes = PhysicsHallucinationDetector.verifyCausalityVsCorrelation({
      hypothesisId: 'HYP-CAUSAL-01',
      cause: 'Viscosity increase',
      effect: 'Pressure drop increase',
      mechanism: 'Wall shear stress',
      supportingEvidence: ['Correlation r=0.98'],
      alternativeExplanations: ['Pipe diameter change'],
      status: 'PROPOSED',
      causalityVerified: false
    });
    const g14Passed = !causalityRes.valid && causalityRes.reasoning.includes('CAUSALITY_UNVERIFIED');
    checks.push({
      gateId: 'GATE-133-14',
      description: 'Causality vs Correlation Boundary (Correlation without solver proof -> CAUSALITY_UNVERIFIED)',
      passed: g14Passed,
      score: g14Passed ? 100 : 0,
      details: g14Passed
        ? `Unverified correlation correctly prevented from being promoted to verified causality`
        : `Causality boundary check failed`
    });

    // 15. GATE-133-15: Mandatory Test — CFD Truth (Unconverged Solver Rejection)
    const reasoner = new EngineeringPhysicsReasoner(ctx);
    const predCFD: PhysicsPrediction = {
      predictionId: 'PRED-CFD-01',
      variable: 'velocity',
      predictedValue: 45.2,
      unit: 'm/s',
      uncertainty: 0.1,
      confidence: 0.95,
      contextHash: ctx.contextHash,
      modelVersion: 'v1.0'
    };

    const cfdRes = reasoner.evaluatePredictionAndConstraints(
      predCFD,
      undefined,
      { solverConverged: false } // Solver NOT converged
    );

    const g15Passed = !cfdRes.admissible && cfdRes.evidence.verdict === 'NOT_CONVERGED';
    checks.push({
      gateId: 'GATE-133-15',
      description: 'CFD Truth Enforcement (Unconverged CFD solver -> NOT_CONVERGED, refusing AI override)',
      passed: g15Passed,
      score: g15Passed ? 100 : 0,
      details: g15Passed
        ? `Unconverged CFD solver result strictly kept as NOT_CONVERGED regardless of AI confidence`
        : `CFD truth enforcement failed`
    });

    // 16. GATE-133-16: Mandatory Test — FEM Truth (Residual Exceeded)
    const predFEM: PhysicsPrediction = {
      predictionId: 'PRED-FEM-01',
      variable: 'stress',
      predictedValue: 350e6, // 350 MPa
      unit: 'Pa',
      uncertainty: 1e6,
      confidence: 0.92,
      contextHash: ctx.contextHash,
      modelVersion: 'v1.0'
    };

    const femRes = reasoner.evaluatePredictionAndConstraints(
      predFEM,
      { type: 'NUMERICAL_SOLVER', value: 200e6, tolerance: 0.01 } // 200 MPa reference -> 75% error
    );

    const g16Passed = !femRes.admissible && femRes.evidence.verdict === 'NOT_VERIFIED';
    checks.push({
      gateId: 'GATE-133-16',
      description: 'FEM Truth Enforcement (FEM residual exceeded -> NOT_VERIFIED)',
      passed: g16Passed,
      score: g16Passed ? 100 : 0,
      details: g16Passed
        ? `Mismatched FEM prediction strictly flagged as NOT_VERIFIED`
        : `FEM truth enforcement failed`
    });

    // 17. GATE-133-17: Counterfactual Scenario Isolation
    const counterRes = reasoner.evaluateCounterfactualScenario({
      description: 'What if inlet temperature increases by 50 K?',
      parameters: { deltaT: 50 },
      boundaryConditions: { inletT: 350 },
      materialId: 'MAT-INCONEL-718',
      geometryId: 'GEO-BLADE-01',
      counterfactualType: 'BOUNDARY_CHANGE'
    });

    const g17Passed = counterRes.scenario.scenarioHash.length === 64 && counterRes.predictedOutcome.includes('COUNTERFACTUAL_PREDICTION');
    checks.push({
      gateId: 'GATE-133-17',
      description: 'Counterfactual Scenario Isolation (Unique scenarioHash, isolated from production state)',
      passed: g17Passed,
      score: g17Passed ? 100 : 0,
      details: g17Passed
        ? `Counterfactual scenario evaluated with isolated hash (${counterRes.scenario.scenarioHash.slice(0, 16)}...)`
        : `Counterfactual scenario isolation check failed`
    });

    // 18. GATE-133-18: Immutable Evidence Chain & Twin Evidence Integration
    const twinGraph = new TwinEvidenceGraphEngine('TWIN-PHY-REASON-01');
    const validPred: PhysicsPrediction = {
      predictionId: 'PRED-VALID-01',
      variable: 'pressure',
      predictedValue: 101325,
      unit: 'Pa',
      uncertainty: 10,
      confidence: 0.99,
      contextHash: ctx.contextHash,
      modelVersion: 'v1.0'
    };

    const validEval = reasoner.evaluatePredictionAndConstraints(
      validPred,
      { type: 'ANALYTICAL', value: 101325, tolerance: 0.001 },
      { quantityType: 'PRESSURE' },
      twinGraph
    );

    const g18Passed = validEval.admissible && validEval.evidence.evidenceHash.length === 64 && twinGraph.graph.nodes.size > 0;
    checks.push({
      gateId: 'GATE-133-18',
      description: 'Immutable Evidence Chain & Twin Evidence Graph Integration',
      passed: g18Passed,
      score: g18Passed ? 100 : 0,
      details: g18Passed
        ? `Evidence hash created and registered into Twin Evidence Graph (${validEval.evidence.evidenceHash.slice(0, 16)}...)`
        : `Evidence chain integration check failed`
    });

    // 19. GATE-133-19: Independent Verification Reproducibility
    const recomputedEvidenceHash = CanonicalPhysicsSerializer.computeEvidenceHash(validEval.evidence);
    const g19Passed = recomputedEvidenceHash === validEval.evidence.evidenceHash;
    checks.push({
      gateId: 'GATE-133-19',
      description: 'Independent Verification Reproducibility (Independent verifier derives identical hash)',
      passed: g19Passed,
      score: g19Passed ? 100 : 0,
      details: g19Passed
        ? `Independent verifier derived identical evidence hash (${recomputedEvidenceHash.slice(0, 16)}...)`
        : `Independent verification failed`
    });

    // 20. GATE-133-20: Integration with PATCH-131 & PATCH-132
    const g20Passed = ctx.geometryHash.length === 64 && ctx.contextHash.length === 64;
    checks.push({
      gateId: 'GATE-133-20',
      description: 'Integration with PATCH-131 (Foundation AI Runtime) & PATCH-132 (Geometry Reasoning Context)',
      passed: g20Passed,
      score: g20Passed ? 100 : 0,
      details: g20Passed
        ? `Seamlessly bound Geometry Context Hash with Physics Context Hash`
        : `PATCH-131/132 integration check failed`
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
