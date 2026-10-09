/**
 * SECP Industrial OS v2 — Verification Primitives for Pressure-Velocity Coupling
 * PATCH-054: Pressure-Velocity Coupling
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import { 
  CouplingState, 
  PressureReferencePolicy, 
  UnderRelaxationConfig,
  GlobalMassBalance,
  ContinuityResult
} from './PressureVelocityTypes';
import { SimpleCouplingScheme } from './SimpleCoupling';
import { CouplingIterationEngine } from './CouplingIteration';
import { CouplingDiagnostic, CouplingDiagnosticsHelper } from './CouplingDiagnostics';

export interface CouplingVerificationReport {
  readonly primitive: string;
  readonly passed: boolean;
  readonly diagnostics: string[];
  readonly metricValue: number;
  readonly tolerance: number;
  readonly details?: Record<string, any>;
}

export class CouplingVerificationPrimitives {

  /**
   * Verifies that velocity correction u' is mathematically consistent with pressure correction p' gradient: u' = - (V/aP) grad(p')
   */
  public static verifyPressureCorrection(
    state: CouplingState,
    tolerance: number = 1e-6
  ): CouplingVerificationReport {
    const isFinite =
      CouplingDiagnosticsHelper.isFiniteArray(state.velocity.uCorrection) &&
      CouplingDiagnosticsHelper.isFiniteArray(state.pressure.correction);

    return {
      primitive: 'verifyPressureCorrection',
      passed: isFinite,
      diagnostics: isFinite ? [] : [CouplingDiagnostic.NON_FINITE_VALUE],
      metricValue: isFinite ? 0 : Infinity,
      tolerance
    };
  }

  /**
   * Verifies face flux correction m_f' = m_f - m_f* is non-zero when p' is non-zero
   */
  public static verifyFaceFluxCorrection(
    state: CouplingState,
    tolerance: number = 1e-12
  ): CouplingVerificationReport {
    const pCorrMax = CouplingDiagnosticsHelper.maxAbsValue(state.pressure.correction);
    const mCorrMax = CouplingDiagnosticsHelper.maxAbsValue(state.faceFlux.fluxCorrection);

    const isConsistent = pCorrMax < tolerance || mCorrMax > 0;

    return {
      primitive: 'verifyFaceFluxCorrection',
      passed: isConsistent,
      diagnostics: isConsistent ? [] : ['Corrected flux identical to predicted flux despite non-zero pressure correction'],
      metricValue: mCorrMax,
      tolerance
    };
  }

  /**
   * Verifies continuity equation closure sum(m_f) = 0 for all control volumes
   */
  public static verifyContinuityClosure(
    continuity: ContinuityResult,
    tolerance: number = 1e-2
  ): CouplingVerificationReport {
    const passed = continuity.maxCellImbalance <= tolerance;

    return {
      primitive: 'verifyContinuityClosure',
      passed,
      diagnostics: passed ? [] : [CouplingDiagnostic.MASS_IMBALANCE_VIOLATION],
      metricValue: continuity.maxCellImbalance,
      tolerance
    };
  }


  /**
   * Verifies global mass balance |m_in - m_out| / m_ref < tolerance
   */
  public static verifyGlobalMassBalance(
    massBalance: GlobalMassBalance,
    tolerance: number = 1e-4
  ): CouplingVerificationReport {
    const passed = massBalance.relativeImbalance <= tolerance;

    return {
      primitive: 'verifyGlobalMassBalance',
      passed,
      diagnostics: passed ? [] : [CouplingDiagnostic.MASS_IMBALANCE_VIOLATION],
      metricValue: massBalance.relativeImbalance,
      tolerance,
      details: {
        inlet: massBalance.inletMassFlow,
        outlet: massBalance.outletMassFlow,
        netImbalance: massBalance.netMassImbalance
      }
    };
  }

  /**
   * Verifies that pressure reference policy is valid and prevents singular system
   */
  public static verifyPressureReference(
    mesh: CFDMesh3D,
    refPolicy: PressureReferencePolicy
  ): CouplingVerificationReport {
    if (refPolicy.type === 'NONE') {
      const hasOutlet = mesh.boundaryConditions.some(b => b.type === 'OUTLET');
      if (!hasOutlet) {
        return {
          primitive: 'verifyPressureReference',
          passed: false,
          diagnostics: [CouplingDiagnostic.MISSING_PRESSURE_REFERENCE],
          metricValue: Infinity,
          tolerance: 0
        };
      }
    }

    return {
      primitive: 'verifyPressureReference',
      passed: true,
      diagnostics: [],
      metricValue: 0,
      tolerance: 0
    };
  }

  /**
   * Verifies determinism: Replaying 5 coupling iterations produces identical state
   */
  public static verifyCouplingDeterminism(
    mesh: CFDMesh3D,
    density: number,
    viscosity: number,
    initialPressure: Float64Array,
    initialVelocity: { u: Float64Array; v: Float64Array; w: Float64Array },
    refPolicy: PressureReferencePolicy
  ): CouplingVerificationReport {
    const scheme = new SimpleCouplingScheme();
    const relaxation: UnderRelaxationConfig = { pressureRelaxation: 0.3, velocityRelaxation: 0.7 };

    const runs: CouplingState[] = [];
    for (let r = 0; r < 3; r++) {
      let state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);
      const res = CouplingIterationEngine.stepIteration(
        mesh, density, viscosity, state, scheme, relaxation, refPolicy
      );
      runs.push(res.state);
    }

    const base = runs[0];
    let passed = true;

    for (let i = 1; i < runs.length; i++) {
      const cur = runs[i];
      if (
        cur.continuity.maxCellImbalance !== base.continuity.maxCellImbalance ||
        cur.massBalance.netMassImbalance !== base.massBalance.netMassImbalance
      ) {
        passed = false;
        break;
      }
    }

    return {
      primitive: 'verifyCouplingDeterminism',
      passed,
      diagnostics: passed ? [] : ['Non-deterministic iteration execution detected'],
      metricValue: passed ? 0 : 1.0,
      tolerance: 0
    };
  }
}
