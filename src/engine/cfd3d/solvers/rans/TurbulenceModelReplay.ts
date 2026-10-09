/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Model Replay Mechanisms
 */

import { TurbulenceModelIdentity, TurbulenceModelState, TurbulenceModel } from './TurbulenceModelContract';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { RansFieldState } from './RansSolverTypes';
import { MaterialProperties } from '../laminar/LaminarSolverTypes';
import { TurbulenceModelRegistry } from './TurbulenceModelRegistry';

export class TurbulenceModelReplay {
  public static replayTurbulenceModel(
    identity: TurbulenceModelIdentity,
    config: any,
    mesh: CFDMesh3D,
    meanState: RansFieldState,
    turbulenceState: TurbulenceModelState,
    materialState: MaterialProperties
  ): TurbulenceModelState {
    const registry = TurbulenceModelRegistry.getInstance();
    const model = registry.get(identity.modelId, identity.version);

    if (!model) {
      throw new Error(`Turbulence model not found for replay: ${identity.modelId}@${identity.version}`);
    }

    // Deterministic execution replay
    const replayedInitialState = model.initialize(mesh, meanState, materialState, config);
    return model.evaluate(replayedInitialState);
  }
}
