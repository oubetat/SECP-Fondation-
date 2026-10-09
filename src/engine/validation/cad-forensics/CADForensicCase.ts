/**
 * SECP Industrial OS v2 — CAD Forensic Case Model
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { CADForensicCase, CADForensicVerdict, CADForensicExecutionMode } from './CADForensicTypes';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';

export abstract class ForensicCaseEvaluator {
  public abstract readonly id: string;
  public abstract readonly capability: string;
  public abstract readonly description: string;
  public abstract readonly executionMode: CADForensicExecutionMode;

  /**
   * Execute the forensic test and return a verdict with result data.
   */
  public abstract evaluate(): Promise<{
    verdict: CADForensicVerdict;
    result: unknown;
    observations: string[];
    limitations: string[];
    evidence?: EngineeringEvidence;
  }>;

  protected generateCaseIdentity(): string {
    return EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.EVIDENCE, 
      projectId: this.id,
      revisionId: "rev-01",
      createdBy: "system",
      seed: "seed"
    }, {}).projectId;
  }
}
