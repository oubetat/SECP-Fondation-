/**
 * SECP CAD Kernel — Kinematic Snapshot (PATCH-040)
 */

import { Matrix4x4Data } from './RecursiveAssemblyEvaluator';
import { AssemblyKinematicState } from './AssemblyKinematicState';

export interface TransformState {
  occurrencePath: string;
  worldMatrix: Matrix4x4Data;
}

export interface KinematicSnapshot {
  documentId: string;
  revision: number | string;
  transforms: Record<string, TransformState>;
  dof: number;
  solved: boolean;
  inputHash: string;
  outputHash: string;
}

export class KinematicSnapshotManager {
  public static createSnapshot(state: AssemblyKinematicState): KinematicSnapshot {
    const transforms: Record<string, TransformState> = {};
    for (const occ of state.occurrences) {
      const pathKey = occ.occurrencePath.join('/');
      transforms[pathKey] = {
        occurrencePath: pathKey,
        worldMatrix: occ.worldTransform
      };
    }

    const inputHash = this.computeInputHash(state);
    const outputHash = this.computeOutputHash(state);

    return {
      documentId: state.assemblyDocumentId,
      revision: state.revision,
      transforms,
      dof: state.degreesOfFreedom,
      solved: state.solved,
      inputHash,
      outputHash
    };
  }

  private static computeInputHash(state: AssemblyKinematicState): string {
    // Simple deterministic hash based on inputs
    const inputData = {
      docId: state.assemblyDocumentId,
      rev: state.revision,
      drivers: state.drivers.map(d => ({ id: d.mateId, p: d.parameterName, v: d.value }))
    };
    return this.hashString(JSON.stringify(inputData));
  }

  private static computeOutputHash(state: AssemblyKinematicState): string {
    // Simple deterministic hash based on outputs
    const outputData = {
      dof: state.degreesOfFreedom,
      solved: state.solved,
      transforms: state.occurrences.map(o => ({ p: o.occurrencePath.join('/'), m: o.worldTransform }))
    };
    return this.hashString(JSON.stringify(outputData));
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
