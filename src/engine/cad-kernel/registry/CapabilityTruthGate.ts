/**
 * SECP CAD Kernel — Capability Truth Gate
 * Phase 2 (PROMPT-003)
 *
 * ARCHITECTURAL CONTRACT:
 * - Layers protection between UI Representation and Engineering Truth.
 * - Prevents the front-end from manufacturing artificial "Success" notifications.
 * - Evaluates a tool's current state strictly from its contract definition and verification evidence.
 */

import { DesignToolContractRegistry, ToolContract } from './DesignToolContractRegistry';

export type CapabilityTruthState =
  | 'AVAILABLE'
  | 'IMPLEMENTED'
  | 'CONNECTED'
  | 'VERIFIED'
  | 'UNAVAILABLE'
  | 'NOT_SUPPORTED';

export interface ToolTruthEvaluation {
  toolId: string;
  truthState: CapabilityTruthState;
  explanation: string;
  uiExists: boolean;
  hasBackend: boolean;
  hasCanonicalConnection: boolean;
  hasKernelCapability: boolean;
  hasVerificationEvidence: boolean;
  evidenceSource?: string;
}

export class CapabilityTruthGate {
  /**
   * Resolves the authoritative engineering truth status of a tool.
   * Enforces the hierarchical rule of precedence:
   * NOT_SUPPORTED -> UNAVAILABLE -> AVAILABLE -> IMPLEMENTED -> CONNECTED -> VERIFIED
   */
  public static resolve(toolId: string): ToolTruthEvaluation {
    const contract = DesignToolContractRegistry.get(toolId);

    // If the tool is completely missing from the contract registry, it is NOT_SUPPORTED by definition.
    if (!contract) {
      return {
        toolId,
        truthState: 'NOT_SUPPORTED',
        explanation: 'This capability is not supported by the current engineering backend.',
        uiExists: false,
        hasBackend: false,
        hasCanonicalConnection: false,
        hasKernelCapability: false,
        hasVerificationEvidence: false
      };
    }

    const uiExists = contract.status.ui;
    const hasBackend = contract.status.implemented;
    const hasCanonicalConnection = contract.status.canonical && contract.canonicalAction.status === 'IMPLEMENTED';
    const hasKernelCapability = contract.kernel.status === 'EXISTS_AND_VERIFIED';
    const hasVerificationEvidence = contract.status.verified && !!contract.validation.testFile;

    // 1. Check if the tool capability is entirely un-implemented in the system
    if (contract.featureType === 'MISSING' && contract.kernel.status === 'NOT_EXISTS') {
      return {
        toolId,
        truthState: 'NOT_SUPPORTED',
        explanation: 'Not supported by the current engineering backend.',
        uiExists,
        hasBackend: false,
        hasCanonicalConnection: false,
        hasKernelCapability: false,
        hasVerificationEvidence: false
      };
    }

    // 2. Check if known but currently disconnected or bypassed
    if (contract.canonicalAction.status === 'BYPASS' || contract.evaluator.status === 'NOT_CONNECTED') {
      return {
        toolId,
        truthState: 'UNAVAILABLE',
        explanation: 'Currently unavailable — kernel evaluator not connected to canonical UI path.',
        uiExists,
        hasBackend,
        hasCanonicalConnection: false,
        hasKernelCapability,
        hasVerificationEvidence: false
      };
    }

    // 3. Resolve verified state if all contract requirements and validation evidence exist
    if (hasBackend && hasCanonicalConnection && hasKernelCapability && hasVerificationEvidence) {
      return {
        toolId,
        truthState: 'VERIFIED',
        explanation: 'Verified — full engineering pipeline and evidence validated.',
        uiExists,
        hasBackend,
        hasCanonicalConnection,
        hasKernelCapability,
        hasVerificationEvidence,
        evidenceSource: contract.validation.testFile
      };
    }

    // 4. Resolve connected state (connected but pending formal verification evidence)
    if (hasBackend && hasCanonicalConnection && hasKernelCapability) {
      return {
        toolId,
        truthState: 'CONNECTED',
        explanation: 'Connected — verification pending.',
        uiExists,
        hasBackend,
        hasCanonicalConnection,
        hasKernelCapability,
        hasVerificationEvidence: false
      };
    }

    // 5. Resolve implemented state (implemented in backend but not yet connected to the canonical UI path)
    if (hasBackend && !hasCanonicalConnection) {
      return {
        toolId,
        truthState: 'IMPLEMENTED',
        explanation: 'Implemented — not yet connected to the canonical UI path.',
        uiExists,
        hasBackend,
        hasCanonicalConnection: false,
        hasKernelCapability,
        hasVerificationEvidence: false
      };
    }

    // 6. Default to available as baseline
    return {
      toolId,
      truthState: 'AVAILABLE',
      explanation: 'Available — backend capability defined.',
      uiExists,
      hasBackend,
      hasCanonicalConnection,
      hasKernelCapability: false,
      hasVerificationEvidence: false
    };
  }

  /**
   * Evaluates if a runtime operation is allowed to declare a successful transaction.
   * Strictly bans any "artificial" successes by checking the actual B-Rep mutation and evidence logs.
   */
  public static verifyExecution(
    toolId: string,
    beforeHash: string | undefined,
    afterHash: string | undefined,
    evidenceRecorded: boolean
  ): { success: boolean; diagnostic: string } {
    const truth = this.resolve(toolId);

    if (truth.truthState === 'NOT_SUPPORTED') {
      return { success: false, diagnostic: 'Operation rejected: Not supported by backend.' };
    }

    if (truth.truthState === 'UNAVAILABLE') {
      return { success: false, diagnostic: 'Operation rejected: Tool is currently unavailable (no active connection).' };
    }

    // If the tool is a verified geometry-mutating tool, we must prove B-Rep hash difference
    if (truth.truthState === 'VERIFIED' && toolId !== 'SKETCH_LINE' && toolId !== 'SKETCH_CIRCLE') {
      if (!beforeHash || !afterHash || beforeHash === afterHash) {
        return { success: false, diagnostic: 'Operation failed: No real B-Rep geometry mutation detected.' };
      }
    }

    if (!evidenceRecorded) {
      return { success: false, diagnostic: 'Operation failed: Missing cryptographic evidence log.' };
    }

    return { success: true, diagnostic: 'Operation successfully executed and verified.' };
  }
}
