/**
 * SECP-098 — CAM Forensic Provenance Engine
 * Maintains the cryptographic digital thread from B-Rep to Toolpath.
 */

import { generateDeterministicHash } from '../../lib/hash';
import { 
  MachiningOperationConfig, 
  VerifiedToolpathTrajectory,
  StockModel,
  CAMStructuralFingerprint
} from './ToolpathTypes';

export class CAMProvenanceEngine {
  /**
   * Generates a structural fingerprint for a machining operation.
   */
  public static async generateStructuralFingerprint(
    op: MachiningOperationConfig,
    verifiedTrajectory: VerifiedToolpathTrajectory,
    stock: StockModel
  ): Promise<CAMStructuralFingerprint> {
    const inputHash = await generateDeterministicHash({
      topologyId: op.topologyId,
      stockFingerprint: stock.fingerprint,
      opFingerprint: op.fingerprint,
      toolFingerprint: op.toolAssembly.fingerprint
    });

    const outputHash = verifiedTrajectory.verificationReport.provenanceHash;

    return {
      operationId: op.operationId,
      inputHash,
      outputHash,
      timestamp: new Date().toISOString(),
      validatorVersion: 'SECP-098-V1'
    };
  }

  /**
   * Verifies that a toolpath is a deterministic replay of the inputs.
   */
  public static async verifyDeterministicReplay(
    originalFingerprint: CAMStructuralFingerprint,
    replayFingerprint: CAMStructuralFingerprint
  ): Promise<boolean> {
    return (
      originalFingerprint.inputHash === replayFingerprint.inputHash &&
      originalFingerprint.outputHash === replayFingerprint.outputHash
    );
  }
}
