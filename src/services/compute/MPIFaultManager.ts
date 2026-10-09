export type MPIFailureType = 'PROCESS_FAILURE' | 'NODE_FAILURE' | 'NETWORK_FAILURE' | 'MPI_RUNTIME_FAILURE' | 'RESOURCE_FAILURE';

export interface MPIFaultEvidence {
  faultId: string;
  failureType: MPIFailureType;
  failedRank?: number;
  failedNodeId?: string;
  timestamp: string;
  communicatorState: 'STOPPED' | 'RECOVERED' | 'FAILED';
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
}

export class MPIFaultManager {
  /**
   * Simulates a failure event, captures fault metadata, and attempts roll-back recovery.
   */
  public static handleFailure(
    failureType: MPIFailureType,
    failedRank?: number,
    failedNodeId?: string
  ): MPIFaultEvidence {
    const faultId = `FAULT-HPC-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Recovery logic simulation based on MPI-ULFM (User Level Fault Mitigation) or coordinated checkpoint restart
    let recoverySuccessful = false;
    let communicatorState: 'STOPPED' | 'RECOVERED' | 'FAILED' = 'FAILED';

    if (failureType === 'PROCESS_FAILURE' || failureType === 'NETWORK_FAILURE') {
      // These are recoverable through standard rank replacement or network rerouting/retransmit
      recoverySuccessful = true;
      communicatorState = 'RECOVERED';
    } else {
      // Node failure or entire runtime collapse may require scheduler-level requeuing or complete rollback restarts
      recoverySuccessful = false;
      communicatorState = 'STOPPED';
    }

    return {
      faultId,
      failureType,
      failedRank,
      failedNodeId,
      timestamp,
      communicatorState,
      recoveryAttempted: true,
      recoverySuccessful
    };
  }
}
