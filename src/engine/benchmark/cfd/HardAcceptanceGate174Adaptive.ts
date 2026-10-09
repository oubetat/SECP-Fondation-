/**
 * SECP Industrial OS v2 — Hard Acceptance Gate 174 (Adaptive Industrial CFD Qualification)
 * Phase 15 (PATCH-174)
 *
 * Enforces the 8 mandatory qualification criteria for transitioning CFD from a static solver
 * to an autonomous, adaptive industrial CFD engine.
 */

import { AdaptiveCFDBenchmarkSuite, AdaptiveSuiteReport } from './AdaptiveCFDBenchmarkSuite';
import { Gate174Check } from './HardAcceptanceGate174';
import { CFDVerdict } from './types';
import { pureSha256 } from '../../../polyfills/crypto';

export interface AdaptiveGate174Report {
  gateId: string;
  title: string;
  passed: boolean;
  verdict: CFDVerdict;
  totalScore: number;
  checks: Gate174Check[];
  suiteReport: AdaptiveSuiteReport;
  attestation: {
    hash: string;
    signature: string;
    timestamp: string;
    verifiedBy: string;
  };
}

export class HardAcceptanceGate174Adaptive {
  public static evaluateGate(): AdaptiveGate174Report {
    const suiteReport = AdaptiveCFDBenchmarkSuite.runAll();
    const checks: Gate174Check[] = [];

    // Check 1: Pre-Flight Physics & Thermodynamics
    const c1 = suiteReport.results.find(r => r.id === 'ADAPT-01-PREFLIGHT-PHYSICS');
    const g1Passed = c1?.passed === true;
    checks.push({
      id: 'GATE174-A01-PREFLIGHT-PHYSICS',
      name: 'Pre-Flight Physics & Thermodynamic Sanity',
      criterion: 'Positive density, viscosity, speed of sound, and non-zero bounding box verified.',
      passed: g1Passed,
      score: g1Passed ? 100 : 0,
      details: c1?.details || 'Pre-flight check evaluated.'
    });

    // Check 2: Finite Volume Mesh Diagnostics
    const c2 = suiteReport.results.find(r => r.id === 'ADAPT-02-MESH-DIAGNOSTICS');
    const g2Passed = c2?.passed === true;
    checks.push({
      id: 'GATE174-A02-MESH-DIAGNOSTICS',
      name: 'Spatial Mesh Quality & Geometric Metrics',
      criterion: 'Non-orthogonality < 70°, skewness < 0.85, volume jump < 10:1.',
      passed: g2Passed,
      score: g2Passed ? 100 : 0,
      details: c2?.metric || 'Mesh quality evaluated.'
    });

    // Check 3: Boundary Condition Well-Posedness
    const c3 = suiteReport.results.find(r => r.id === 'ADAPT-03-BC-VALIDATION');
    const g3Passed = c3?.passed === true;
    checks.push({
      id: 'GATE174-A03-BC-VALIDATION',
      name: 'Boundary Conditions & Pressure Pinning',
      criterion: 'Dirichlet/Neumann pairs, inflow/outflow balance, and pressure reference validated.',
      passed: g3Passed,
      score: g3Passed ? 100 : 0,
      details: c3?.metric || 'BCs evaluated.'
    });

    // Check 4: Adaptive CFL & Dynamic Timestep Control
    const c4 = suiteReport.results.find(r => r.id === 'ADAPT-04-CFL-ADAPTIVE-STEPPING');
    const g4Passed = c4?.passed === true;
    checks.push({
      id: 'GATE174-A04-ADAPTIVE-CFL-TIMESTEPPING',
      name: 'Adaptive CFL & PID Timestep Integration',
      criterion: 'Dynamic time-step scaling responsive to convective/acoustic wave speeds.',
      passed: g4Passed,
      score: g4Passed ? 100 : 0,
      details: c4?.metric || 'CFL controller evaluated.'
    });

    // Check 5: Dynamic Under-Relaxation (Alpha Adaptation)
    const c5 = suiteReport.results.find(r => r.id === 'ADAPT-05-DYNAMIC-RELAXATION');
    const g5Passed = c5?.passed === true;
    checks.push({
      id: 'GATE174-A05-DYNAMIC-RELAXATION',
      name: 'Dynamic Under-Relaxation (Alpha Adaptation)',
      criterion: 'Automated damping on residual spikes and acceleration on monotonic regimes.',
      passed: g5Passed,
      score: g5Passed ? 100 : 0,
      details: c5?.metric || 'Dynamic relaxation evaluated.'
    });

    // Check 6: False-Convergence Prevention Trap
    const c6 = suiteReport.results.find(r => r.id === 'ADAPT-06-FALSE-CONVERGENCE-TRAP');
    const g6Passed = c6?.passed === true;
    checks.push({
      id: 'GATE174-A06-FALSE-CONVERGENCE-TRAP',
      name: 'Dual-Condition False-Convergence Protection',
      criterion: 'Residual drops must not emit CONVERGED when physical mass balance fails.',
      passed: g6Passed,
      score: g6Passed ? 100 : 0,
      details: c6?.details || 'False-convergence trap evaluated.'
    });

    // Check 7: Compressible Shock-Capturing Readiness
    const c7 = suiteReport.results.find(r => r.id === 'ADAPT-07-SHOCK-SENSOR-HIGH-SPEED');
    const g7Passed = c7?.passed === true;
    checks.push({
      id: 'GATE174-A07-COMPRESSIBLE-SHOCK-READINESS',
      name: 'Ducros Shock Sensor & Compressible Mach Diagnostics',
      criterion: 'Accurate detection of shock fronts and supersonic/transonic Mach regimes.',
      passed: g7Passed,
      score: g7Passed ? 100 : 0,
      details: c7?.metric || 'Shock sensor evaluated.'
    });

    // Check 8: Automated Divergence Recovery & State Rollback
    const c8 = suiteReport.results.find(r => r.id === 'ADAPT-08-DIVERGENCE-RECOVERY');
    const g8Passed = c8?.passed === true;
    checks.push({
      id: 'GATE174-A08-DIVERGENCE-RECOVERY',
      name: 'Divergence Recovery & Checkpoint Rollback',
      criterion: '100% automated recovery on unphysical velocity/NaN divergence with CFL halving.',
      passed: g8Passed,
      score: g8Passed ? 100 : 0,
      details: c8?.metric || 'Divergence recovery evaluated.'
    });

    const passedCount = checks.filter(c => c.passed).length;
    const totalScore = Math.round(checks.reduce((acc, c) => acc + c.score, 0) / checks.length);
    const passed = passedCount === checks.length;
    const verdict: CFDVerdict = passed ? 'PASS' : 'FAIL';

    const payload = checks.map(c => `${c.id}:${c.passed}:${c.score}`).join('|');
    const contentHash = pureSha256(payload);
    const hash = `sha256-gate174-adaptive-${contentHash.substring(0, 16)}`;
    const signature = `SIG-GATE174-ADAPTIVE-CFD-SECP-${contentHash.substring(0, 12).toUpperCase()}`;

    return {
      gateId: 'HARD-ACCEPTANCE-GATE-174-ADAPTIVE',
      title: 'SECP Hard Acceptance Gate 174 — Adaptive Industrial CFD Qualification',
      passed,
      verdict,
      totalScore,
      checks,
      suiteReport,
      attestation: {
        hash,
        signature,
        timestamp: new Date().toISOString(),
        verifiedBy: 'SECP Independent Adaptive CFD Verifier'
      }
    };
  }
}
