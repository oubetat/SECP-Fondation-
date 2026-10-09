/**
 * SECP CFD Evidence Contract & Serialization Architecture
 * 
 * Provides canonical, strictly validated serialization of per-iteration CFD evidence.
 * Prevents the Evidence Serialization Gap (where solver executes N iterations
 * but artifacts serialize trace.length = 0).
 */

import { CfdIterationLog3D, CfdSolution3D } from '../Fvm3DTypes';

export interface CanonicalIterationRecord {
  iteration: number;
  continuityResidual: number;
  continuityL1?: number;
  continuityL2?: number;
  continuityLinf?: number;
  uMomentumResidual: number;
  vMomentumResidual: number;
  wMomentumResidual: number;
  momentumL1?: number;
  momentumL2?: number;
  momentumLinf?: number;
  pressureChange: number;
  pressureCorrection?: number;
  rawPPrimeMax?: number | 'NOT_AVAILABLE';
  pressureCap?: number | 'NOT_AVAILABLE';
  appliedPPrimeMax?: number | 'NOT_AVAILABLE';
  pressureCapActivated?: boolean | 'NOT_AVAILABLE';
  velocityCorrection?: number;
  maxVelocityMS: number;
  rawVelocityMax?: number | 'NOT_AVAILABLE';
  velocityCap?: number | 'NOT_AVAILABLE';
  postCapVelocityMax?: number | 'NOT_AVAILABLE';
  numberOfVelocityClippedCells?: number | 'MISSING';
  globalMassImbalanceKgS: number;
  kResidual?: number | 'NOT_AVAILABLE';
  omegaResidual?: number | 'NOT_AVAILABLE';
  maxDeltaK?: number | 'NOT_AVAILABLE';
  maxDeltaOmega?: number | 'NOT_AVAILABLE';
  maxDeltaNut?: number | 'NOT_AVAILABLE';
  maxRelDeltaNut?: number | 'NOT_AVAILABLE';
  numberOfNutClippedCells?: number | 'NOT_AVAILABLE';
  cl?: number | 'NOT_AVAILABLE';
  cd?: number | 'NOT_AVAILABLE';
  cm?: number | 'NOT_AVAILABLE';
  minPressure?: number | 'NOT_AVAILABLE';
  maxPressure?: number | 'NOT_AVAILABLE';
  nanDetected?: boolean;
  infDetected?: boolean;
}

export interface SerializedCfdEvidencePackage {
  schemaVersion: '1.0.0-canonical';
  totalIterationsExecuted: number;
  traceLength: number;
  traceIntegrityGatePassed: boolean;
  iterationHistory: CanonicalIterationRecord[];
  provenance: {
    producer: string;
    container: string;
    consumer: string;
    timestamp: string;
  };
}

export class CfdEvidenceSerializer {
  public static readonly CANONICAL_FIELD = 'iterationHistory';

  /**
   * Serializes solution iteration history with hard fail-fast verification.
   * Throws EVIDENCE_SERIALIZATION_FAILURE if iterations were executed but history is empty or inconsistent.
   */
  public static serializeSolutionHistory(
    solution: Pick<CfdSolution3D, 'iterationHistory' | 'totalIterations'> & { history?: any[] },
    options: { producer?: string; consumer?: string; allowEmptyIfZero?: boolean } = {}
  ): SerializedCfdEvidencePackage {
    const producer = options.producer || 'Fvm3DNavierStokesSolver';
    const consumer = options.consumer || 'CfdEvidenceSerializer';
    const timestamp = new Date().toISOString();

    // Canonical field resolution
    const rawHistory = solution.iterationHistory ?? (solution as any).history;

    const iterationsExecuted = solution.totalIterations ?? (rawHistory ? rawHistory.length : 0);

    // GATE 1: Detect silent empty trace defect
    if (iterationsExecuted > 0 && (!rawHistory || rawHistory.length === 0)) {
      throw new Error(
        `EVIDENCE_SERIALIZATION_FAILURE: Solver executed ${iterationsExecuted} iterations ` +
        `but iterationHistory is empty (length = 0). Silent evidence loss rejected.`
      );
    }

    // GATE 2: Length consistency gate
    if (rawHistory && iterationsExecuted > 0 && rawHistory.length !== iterationsExecuted) {
      throw new Error(
        `EVIDENCE_SERIALIZATION_FAILURE: totalIterations (${iterationsExecuted}) does not match ` +
        `iterationHistory.length (${rawHistory.length}). Trace truncation or mismatch detected.`
      );
    }

    const records: CanonicalIterationRecord[] = [];
    let prevIter = -1;

    if (rawHistory && rawHistory.length > 0) {
      for (let i = 0; i < rawHistory.length; i++) {
        const item = rawHistory[i];

        // GATE 3: Strict monotonically increasing order
        if (item.iteration <= prevIter) {
          throw new Error(
            `EVIDENCE_SERIALIZATION_FAILURE: Non-monotonic iteration sequence at index ${i}. ` +
            `Current iteration ${item.iteration} <= Previous iteration ${prevIter}.`
          );
        }
        prevIter = item.iteration;

        const isNan = !isFinite(item.continuityResidual) || !isFinite(item.uMomentumResidual) || !isFinite(item.maxVelocityMS);
        const isInf = isNaN(item.continuityResidual) || isNaN(item.uMomentumResidual) || isNaN(item.maxVelocityMS);

        records.push({
          iteration: item.iteration,
          continuityResidual: item.continuityResidual,
          continuityL1: item.continuityL1,
          continuityL2: item.continuityL2,
          continuityLinf: item.continuityLinf,
          uMomentumResidual: item.uMomentumResidual,
          vMomentumResidual: item.vMomentumResidual,
          wMomentumResidual: item.wMomentumResidual,
          momentumL1: item.momentumL1,
          momentumL2: item.momentumL2,
          momentumLinf: item.momentumLinf,
          pressureChange: item.pressureChange,
          pressureCorrection: item.pressureCorrection,
          rawPPrimeMax: item.pressureCorrection ?? 'NOT_AVAILABLE',
          pressureCap: (item as any).pressureCap ?? 'NOT_AVAILABLE',
          appliedPPrimeMax: (item as any).appliedPPrimeMax ?? 'NOT_AVAILABLE',
          pressureCapActivated: (item as any).pressureCapActivated ?? 'NOT_AVAILABLE',
          velocityCorrection: item.velocityCorrection,
          maxVelocityMS: item.maxVelocityMS,
          rawVelocityMax: item.maxVelocity ?? item.maxVelocityMS,
          velocityCap: (item as any).velocityCap ?? 'NOT_AVAILABLE',
          postCapVelocityMax: (item as any).postCapVelocityMax ?? 'NOT_AVAILABLE',
          numberOfVelocityClippedCells: 'MISSING', // Truthful provenance: solver does not track count
          globalMassImbalanceKgS: item.globalMassImbalanceKgS,
          kResidual: item.kResidual ?? 'NOT_AVAILABLE',
          omegaResidual: item.omegaResidual ?? 'NOT_AVAILABLE',
          maxDeltaK: item.maxDeltaK ?? 'NOT_AVAILABLE',
          maxDeltaOmega: item.maxDeltaOmega ?? 'NOT_AVAILABLE',
          maxDeltaNut: item.maxDeltaNut ?? 'NOT_AVAILABLE',
          maxRelDeltaNut: item.maxRelDeltaNut ?? 'NOT_AVAILABLE',
          numberOfNutClippedCells: item.numberOfNutClippedCells ?? 'NOT_AVAILABLE',
          cl: item.cl ?? 'NOT_AVAILABLE',
          cd: item.cd ?? 'NOT_AVAILABLE',
          cm: item.cm ?? 'NOT_AVAILABLE',
          minPressure: item.minPressure ?? 'NOT_AVAILABLE',
          maxPressure: item.maxPressure ?? 'NOT_AVAILABLE',
          nanDetected: (item as any).nanDetected ?? isNan,
          infDetected: (item as any).infDetected ?? isInf
        });
      }
    }

    return {
      schemaVersion: '1.0.0-canonical',
      totalIterationsExecuted: iterationsExecuted,
      traceLength: records.length,
      traceIntegrityGatePassed: true,
      iterationHistory: records,
      provenance: {
        producer,
        container: 'CfdSolution3D.iterationHistory',
        consumer,
        timestamp
      }
    };
  }
}
