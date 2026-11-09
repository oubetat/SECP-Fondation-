/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006
 * Human Ergonomics Evaluation Engine (Main Entry Point)
 */

import { 
  ErgonomicMethodology, 
  ErgonomicEvidence, 
  RULAInput, 
  REBAInput, 
  OWASInput, 
  NIOSHInput 
} from './types';
import { RULAEngine } from './RULAEngine';
import { REBAEngine } from './REBAEngine';
import { OWASEngine } from './OWASEngine';
import { NIOSHEngine } from './NIOSHEngine';

export class HumanErgonomicsEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Performs a comprehensive ergonomic assessment using the specified methodology
   */
  public static assessRULA(input: RULAInput, dhmProfileId?: string): ErgonomicEvidence {
    return RULAEngine.assess(input, dhmProfileId);
  }

  public static assessREBA(input: REBAInput, dhmProfileId?: string): ErgonomicEvidence {
    return REBAEngine.assess(input, dhmProfileId);
  }

  public static assessOWAS(input: OWASInput, dhmProfileId?: string): ErgonomicEvidence {
    return OWASEngine.assess(input, dhmProfileId);
  }

  public static assessNIOSH(input: NIOSHInput, dhmProfileId?: string): ErgonomicEvidence {
    return NIOSHEngine.assess(input, dhmProfileId);
  }

  /**
   * Evaluates a given pose state with task-specific metadata using a chosen methodology
   */
  public static evaluatePosture(input: {
    pose: any; // HumanPoseState
    dhmProfileId: string;
    methodology: 'RULA' | 'REBA' | 'OWAS';
    taskInputs: {
      forceKg: number;
      isStatic: boolean;
      repetitionCountPerMin: number;
      durationMinutes: number;
      isSymmetric: boolean;
    }
  }): ErgonomicEvidence {
    const { pose, dhmProfileId, methodology, taskInputs } = input;

    switch (methodology) {
      case 'RULA':
        return RULAEngine.assess({
          pose,
          muscleUse: taskInputs.isStatic || taskInputs.repetitionCountPerMin > 4,
          loadKg: taskInputs.forceKg,
          armSupported: false,
          shoulderAbducted: false,
          shoulderRaised: false,
          neckTwisted: false,
          neckSideBending: false,
          trunkTwisted: false,
          trunkSideBending: false,
          wristTwist: 1,
          legsSupported: true
        }, dhmProfileId);

      case 'REBA':
        return REBAEngine.assess({
          pose,
          loadKg: taskInputs.forceKg,
          coupling: 0,
          legSupport: 1,
          kneeFlexionDeg: 0,
          activity: {
            staticPosture: taskInputs.isStatic,
            repeatedAction: taskInputs.repetitionCountPerMin > 4,
            rapidChange: false
          }
        }, dhmProfileId);

      case 'OWAS':
        return OWASEngine.assess({
          pose,
          loadKg: taskInputs.forceKg,
          legPosture: 2 // Standing both straight (default)
        }, dhmProfileId);

      default:
        throw new Error(`Unsupported ergonomic methodology for posture evaluation: ${methodology}`);
    }
  }

  /**
   * Batch assessment for multiple methodologies
   */
  public static assessAll(
    inputs: {
      rula?: RULAInput;
      reba?: REBAInput;
      owas?: OWASInput;
      niosh?: NIOSHInput;
    },
    dhmProfileId?: string
  ): Record<string, ErgonomicEvidence> {
    const results: Record<string, ErgonomicEvidence> = {};
    if (inputs.rula) results[ErgonomicMethodology.RULA] = this.assessRULA(inputs.rula, dhmProfileId);
    if (inputs.reba) results[ErgonomicMethodology.REBA] = this.assessREBA(inputs.reba, dhmProfileId);
    if (inputs.owas) results[ErgonomicMethodology.OWAS] = this.assessOWAS(inputs.owas, dhmProfileId);
    if (inputs.niosh) results[ErgonomicMethodology.NIOSH] = this.assessNIOSH(inputs.niosh, dhmProfileId);
    return results;
  }
}
