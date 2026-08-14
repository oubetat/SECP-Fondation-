import { DesignIntent, IntentType } from '../intent/DesignIntentTypes';
import { ManufacturingIntent, ProcessType } from './ManufacturingTypes';

/**
 * PATCH-SECP-049-D — Manufacturing Intent Integration Bridge
 * Connects SECP-048 Design Intent contracts to SECP-049 Manufacturing Intents & Process Constraints.
 */
export class ManufacturingIntentBridge {

  public static convertDesignIntents(
    designIntents: DesignIntent[],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): ManufacturingIntent[] {
    const mfgIntents: ManufacturingIntent[] = [];

    for (const di of designIntents) {
      if (di.status === 'SUPPRESSED') continue;

      const mfgIntent = this.convertSingleIntent(di, preferredProcess);
      if (mfgIntent) {
        mfgIntents.push(mfgIntent);
      }
    }

    return mfgIntents;
  }

  private static convertSingleIntent(
    di: DesignIntent,
    process: ProcessType
  ): ManufacturingIntent | null {
    const constraints: string[] = [];
    let tol = 0.1;
    let ra = 3.2; // Ra 3.2 um standard finish

    switch (di.type) {
      case IntentType.MINIMUM_WALL_THICKNESS:
        constraints.push('FORCE_LIGHT_CUTTING_DEPTH');
        constraints.push('FINISHING_PASS_REQUIRED');
        tol = 0.05;
        ra = 1.6;
        break;

      case IntentType.CONCENTRICITY:
      case IntentType.COAXIALITY:
        constraints.push('SINGLE_SETUP_MACHINING');
        constraints.push('PRECISION_BORING_OR_GRINDING');
        tol = 0.01;
        ra = 0.8;
        break;

      case IntentType.SYMMETRY:
        constraints.push('INDEXED_FIXTURE_MIRRORING');
        tol = 0.02;
        break;

      case IntentType.PARALLELISM:
      case IntentType.PERPENDICULARITY:
        constraints.push('DATUM_SURFACE_FINISHING');
        tol = 0.02;
        ra = 1.6;
        break;

      default:
        constraints.push('STANDARD_INSPECTION_CHECK');
        break;
    }

    return {
      intentId: `mfg-intent-${di.id}`,
      sourceDesignIntentId: di.id,
      targetProcess: process,
      requiredToleranceMm: tol,
      requiredSurfaceFinishRa: ra,
      processConstraints: constraints
    };
  }
}
