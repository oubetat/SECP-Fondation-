/**
 * SECP CAD Kernel — Kinematic Evidence Builder (PATCH-040)
 */

import { AssemblyKinematicState } from './AssemblyKinematicState';
import { KinematicSnapshot } from './KinematicSnapshot';
import { InterferenceStatus } from './AssemblyInterferenceAnalyzer';

export interface KinematicEvidence {
  documentId: string;
  revision: number | string;

  inputHash: string;
  outputHash: string;

  solved: boolean;
  degreesOfFreedom: number;

  interferenceStatus: InterferenceStatus;

  diagnostics: string[];
  timestamp: string;
}

export class KinematicEvidenceBuilder {
  public static build(
    state: AssemblyKinematicState,
    snapshot: KinematicSnapshot,
    interferenceStatus: InterferenceStatus
  ): KinematicEvidence {
    return {
      documentId: state.assemblyDocumentId,
      revision: state.revision,
      inputHash: snapshot.inputHash,
      outputHash: snapshot.outputHash,
      solved: state.solved,
      degreesOfFreedom: state.degreesOfFreedom,
      interferenceStatus,
      diagnostics: [...state.diagnostics],
      timestamp: new Date().toISOString()
    };
  }
}
