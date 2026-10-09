/**
 * SECP Industrial OS v2 — Hard Acceptance Gate PATCH-053
 * PATCH-053: Flux Framework
 */

import { EngineeringClock, SystemClock, toISOString } from '../../core/clock';
import { PhysicsModel, ConservativeState, Vector3, FluxVerdict } from './FluxTypes';
import { CentralFluxScheme } from './CentralFlux';
import { UpwindFluxScheme } from './UpwindFlux';
import { FluxStateEngine } from './FluxState';
import { PhysicalFluxEngine } from './PhysicalFlux';
import { FluxVerificationPrimitives, FluxVerificationReport } from './FluxVerificationPrimitives';
import { FluxBoundaryHandler } from './FluxBoundaryHandler';
import { FluxEvidenceEngine, FluxEvidenceRecord } from './FluxEvidence';
import { FluxRegistry } from './FluxRegistry';
import { BoundaryType } from '../mesh/CFDMeshTypes';

export interface Gate053EvaluationResult {
  patchId: 'PATCH-053';
  verdict: FluxVerdict;
  timestamp: string;
  diagnostics: string[];
  verificationReports: FluxVerificationReport[];
  evidenceRecord?: FluxEvidenceRecord;
  capabilities: {
    physicalFlux: boolean;
    centralFlux: boolean;
    upwindFlux: boolean;
    boundaryHandler: boolean;
    invalidStateRejection: boolean;
    conservation: boolean;
    symmetry: boolean;
    determinism: boolean;
  };
}

export class HardAcceptanceGate053 {

  public static evaluateGate(clock: EngineeringClock = new SystemClock()): Gate053EvaluationResult {
    const timestamp = toISOString(clock);
    const diagnostics: string[] = [];
    const reports: FluxVerificationReport[] = [];

    // Canonical Physics Model (Ideal air)
    const physicsModel: PhysicsModel = {
      modelType: 'EULER_3D',
      gamma: 1.4,
      gasConstant: 287.05
    };

    // Benchmark states
    const primLeft = { rho: 1.225, u: 100, v: 0, w: 0, p: 101325, T: 288.15 };
    const primRight = { rho: 1.0, u: 80, v: 10, w: -5, p: 90000, T: 280.0 };

    let stateLeft: ConservativeState;
    let stateRight: ConservativeState;

    try {
      stateLeft = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
      stateRight = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    } catch (err: any) {
      return {
        patchId: 'PATCH-053',
        verdict: FluxVerdict.INVALID,
        timestamp,
        diagnostics: [`Failed state conversion: ${err.message}`],
        verificationReports: [],
        capabilities: {
          physicalFlux: false, centralFlux: false, upwindFlux: false, boundaryHandler: false,
          invalidStateRejection: false, conservation: false, symmetry: false, determinism: false
        }
      };
    }

    const normal: Vector3 = [1, 0, 0];

    // 1. Physical Flux Evaluation
    const pFlux = PhysicalFluxEngine.computePhysicalFlux(stateLeft, normal, physicsModel);
    const physicalFluxValid = pFlux.validity && (pFlux.waveSpeed ?? 0) > 0;
    if (!physicalFluxValid) {
      diagnostics.push('Physical flux evaluation failed or invalid wave speed.');
    }

    // 2. Central Flux & Upwind Schemes
    const centralScheme = new CentralFluxScheme();
    const upwindScheme = new UpwindFluxScheme();

    // 3. Verification Primitives Evaluation
    // Central Flux Symmetry
    const rCentralSym = FluxVerificationPrimitives.verifyFluxSymmetry(
      centralScheme, stateLeft, stateRight, normal, physicsModel, 1e-10
    );
    reports.push(rCentralSym);

    // Central Flux Conservation
    const rCentralCons = FluxVerificationPrimitives.verifyFluxConservation(
      centralScheme, stateLeft, stateRight, normal, physicsModel, 1e-10
    );
    reports.push(rCentralCons);

    // Upwind Flux Conservation
    const rUpwindCons = FluxVerificationPrimitives.verifyFluxConservation(
      upwindScheme, stateLeft, stateRight, normal, physicsModel, 1e-10
    );
    reports.push(rUpwindCons);

    // Uniform state verification
    const rUniform = FluxVerificationPrimitives.verifyUniformState(
      centralScheme, stateLeft, normal, physicsModel, 1e-10
    );
    reports.push(rUniform);

    // Determinism check
    const rDet = FluxVerificationPrimitives.verifyFluxDeterminism(
      upwindScheme, stateLeft, stateRight, normal, physicsModel
    );
    reports.push(rDet);

    // 4. Invalid State Rejection Check
    const invalidPrim = { rho: -1.0, u: 0, v: 0, w: 0, p: -500, T: -10 };
    const invalidVal = FluxStateEngine.validatePrimitiveState(invalidPrim, physicsModel);
    const invalidRejectionValid = !invalidVal.valid && invalidVal.diagnostics.length > 0;
    if (!invalidRejectionValid) {
      diagnostics.push('Invalid state rejection failed.');
    }

    // 5. Boundary Handler Check
    const wallRes = FluxBoundaryHandler.computeBoundaryFlux(
      BoundaryType.WALL, stateLeft, null, normal, physicsModel
    );
    const boundaryHandlerValid = wallRes.capability === 'SUPPORTED' && wallRes.fluxResult.validity && wallRes.fluxResult.flux.rho === 0;
    if (!boundaryHandlerValid) {
      diagnostics.push('Boundary handler verification failed for slip wall.');
    }

    // 6. Registry Integrity Check
    const registry = FluxRegistry.getInstance();
    const registeredSchemes = registry.listSchemes();
    const registryValid = registeredSchemes.includes('CENTRAL_FLUX_EULER_3D') && registeredSchemes.includes('RUSANOV_UPWIND_FLUX_EULER_3D');
    if (!registryValid) {
      diagnostics.push('Flux registry missing default schemes.');
    }

    // Overall Capabilities
    const capabilities = {
      physicalFlux: physicalFluxValid,
      centralFlux: rCentralCons.passed,
      upwindFlux: rUpwindCons.passed,
      boundaryHandler: boundaryHandlerValid,
      invalidStateRejection: invalidRejectionValid,
      conservation: rCentralCons.passed && rUpwindCons.passed,
      symmetry: rCentralSym.passed,
      determinism: rDet.passed
    };

    const allReportsPassed = reports.every(r => r.passed);
    const allCapabilitiesTrue = Object.values(capabilities).every(v => v === true);

    const overallVerdict: FluxVerdict = (allReportsPassed && allCapabilitiesTrue) ? FluxVerdict.PASS : FluxVerdict.FAIL;

    // 7. Evidence Generation
    const cFluxResult = centralScheme.compute(stateLeft, stateRight, normal, physicsModel);
    const evidenceRecord = FluxEvidenceEngine.createEvidenceRecord(
      'BENCHMARK_GATE_053',
      centralScheme.id,
      centralScheme.version,
      physicsModel,
      stateLeft,
      stateRight,
      normal,
      cFluxResult,
      reports,
      timestamp
    );

    return {
      patchId: 'PATCH-053',
      verdict: overallVerdict,
      timestamp,
      diagnostics,
      verificationReports: reports,
      evidenceRecord,
      capabilities
    };
  }
}
