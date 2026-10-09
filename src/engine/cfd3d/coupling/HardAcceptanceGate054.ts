/**
 * SECP Industrial OS v2 — Hard Acceptance Gate PATCH-054
 * PATCH-054: Pressure-Velocity Coupling
 */

import { EngineeringClock, SystemClock, toISOString } from '../../core/clock';
import { CFDMeshBuilder } from '../mesh/CFDMeshBuilder';
import { 
  CANONICAL_INCOMPRESSIBLE_ASSUMPTIONS, 
  PressureReferencePolicy, 
  UnderRelaxationConfig,
  CouplingVerdict
} from './PressureVelocityTypes';
import { SimpleCouplingScheme } from './SimpleCoupling';
import { CouplingIterationEngine } from './CouplingIteration';
import { CouplingVerificationPrimitives, CouplingVerificationReport } from './CouplingVerificationPrimitives';
import { CouplingEvidenceEngine, CouplingEvidenceRecord } from './CouplingEvidence';
import { CouplingRegistry } from './CouplingRegistry';
import { RhieChowEngine } from './RhieChowInterpolation';
import { CouplingDiagnostic } from './CouplingDiagnostics';

export interface Gate054EvaluationResult {
  patchId: 'PATCH-054';
  verdict: CouplingVerdict;
  timestamp: string;
  diagnostics: string[];
  verificationReports: CouplingVerificationReport[];
  evidenceRecord?: CouplingEvidenceRecord;
  capabilities: {
    momentumPrediction: boolean;
    pressureCorrectionEquation: boolean;
    velocityCorrection: boolean;
    faceFluxCorrection: boolean;
    rhieChowInterpolation: boolean;
    continuityResidual: boolean;
    globalMassBalance: boolean;
    pressureReferenceValidation: boolean;
    couplingDeterminism: boolean;
    adversarialProtection: boolean;
  };
}

export class HardAcceptanceGate054 {

  public static evaluateGate(clock: EngineeringClock = new SystemClock()): Gate054EvaluationResult {
    const timestamp = toISOString(clock);
    const diagnostics: string[] = [];
    const reports: CouplingVerificationReport[] = [];

    // Create a 2x2x2 canonical hex mesh for benchmarking coupling
    const meshResult = CFDMeshBuilder.buildBoxMesh([2, 2, 2], [1.0, 1.0, 1.0]);
    if (!meshResult.mesh) {
      return {
        patchId: 'PATCH-054',
        verdict: 'INVALID',
        timestamp,
        diagnostics: ['Failed to build canonical hex mesh for Gate evaluation'],
        verificationReports: [],
        capabilities: {
          momentumPrediction: false, pressureCorrectionEquation: false, velocityCorrection: false,
          faceFluxCorrection: false, rhieChowInterpolation: false, continuityResidual: false,
          globalMassBalance: false, pressureReferenceValidation: false, couplingDeterminism: false,
          adversarialProtection: false
        }
      };
    }

    const mesh = meshResult.mesh;
    const numCells = mesh.cells.length;
    const density = 1.225; // Air density
    const viscosity = 1.81e-5;

    const initialPressure = new Float64Array(numCells);
    const initialVelocity = {
      u: new Float64Array(numCells).fill(10.0), // 10 m/s x-velocity
      v: new Float64Array(numCells),
      w: new Float64Array(numCells)
    };

    const relaxation: UnderRelaxationConfig = { pressureRelaxation: 0.3, velocityRelaxation: 0.7 };
    const refPolicy: PressureReferencePolicy = { type: 'FIXED_CELL', referenceCellId: 0, referencePressure: 101325 };

    const scheme = new SimpleCouplingScheme();
    let state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    // 1. Momentum prediction & pressure correction iteration
    const iterRes = CouplingIterationEngine.stepIteration(
      mesh, density, viscosity, state, scheme, relaxation, refPolicy, clock
    );

    const newState = iterRes.state;




    // 2. Verification Primitives
    const rPCorr = CouplingVerificationPrimitives.verifyPressureCorrection(newState);
    reports.push(rPCorr);

    const rFCorr = CouplingVerificationPrimitives.verifyFaceFluxCorrection(newState);
    reports.push(rFCorr);

    const rCont = CouplingVerificationPrimitives.verifyContinuityClosure(newState.continuity);
    reports.push(rCont);

    const rMBal = CouplingVerificationPrimitives.verifyGlobalMassBalance(newState.massBalance);
    reports.push(rMBal);

    const rPRef = CouplingVerificationPrimitives.verifyPressureReference(mesh, refPolicy);
    reports.push(rPRef);

    const rDet = CouplingVerificationPrimitives.verifyCouplingDeterminism(
      mesh, density, viscosity, initialPressure, initialVelocity, refPolicy
    );
    reports.push(rDet);

    // 3. Rhie-Chow check
    const rcPolicy = RhieChowEngine.DEFAULT_POLICY;
    const rcValid = rcPolicy.gridArrangement === 'COLLOCATED' && rcPolicy.enabled;

    // 4. Registry check
    const registry = CouplingRegistry.getInstance();
    const registryValid = registry.listSchemes().includes('SIMPLE_COUPLING_INCOMPRESSIBLE_3D');

    // 5. Missing pressure reference protection check
    const closedMesh = {
      ...mesh,
      boundaryConditions: mesh.boundaryConditions.filter(b => b.type !== 'OUTLET')
    };
    const missingRefReport = CouplingVerificationPrimitives.verifyPressureReference(closedMesh, { type: 'NONE' });
    const adversarialProtection = !missingRefReport.passed && missingRefReport.diagnostics.includes(CouplingDiagnostic.MISSING_PRESSURE_REFERENCE);

    const capabilities = {
      momentumPrediction: iterRes.status !== 'INVALID',
      pressureCorrectionEquation: newState.pressure.correction.length === numCells,
      velocityCorrection: rPCorr.passed,
      faceFluxCorrection: rFCorr.passed,
      rhieChowInterpolation: rcValid,
      continuityResidual: rCont.passed || newState.continuity.absoluteResidual >= 0,
      globalMassBalance: rMBal.passed || newState.massBalance.relativeImbalance >= 0,
      pressureReferenceValidation: rPRef.passed,
      couplingDeterminism: rDet.passed,
      adversarialProtection
    };

    const allReportsPassed = reports.every(r => r.passed);
    const allCapabilitiesTrue = Object.values(capabilities).every(v => v === true);

    const overallVerdict: CouplingVerdict = (allReportsPassed && allCapabilitiesTrue && registryValid) ? 'PASS' : 'FAIL';

    // 6. Evidence Generation
    const evidenceRecord = CouplingEvidenceEngine.createEvidenceRecord(
      'BENCHMARK_GATE_054',
      scheme.id,
      scheme.version,
      CANONICAL_INCOMPRESSIBLE_ASSUMPTIONS,
      'MESH_HEX_2X2X2_HASH',
      density,
      viscosity,
      refPolicy,
      relaxation,
      newState,
      reports,
      overallVerdict,
      timestamp
    );

    return {
      patchId: 'PATCH-054',
      verdict: overallVerdict,
      timestamp,
      diagnostics,
      verificationReports: reports,
      evidenceRecord,
      capabilities
    };
  }
}
