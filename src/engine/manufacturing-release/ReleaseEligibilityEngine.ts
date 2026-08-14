/**
 * PATCH-SECP-064: Release Eligibility Engine
 * Formally evaluates the compliance state of upstream production and quality metrics.
 * Operates purely as a high-level aggregator of certified baseline results,
 * without re-calculating or modifying original baseline data.
 */

import { SerialReleaseRecord } from './ManufacturingReleaseTypes';

export class ReleaseEligibilityEngine {
  /**
   * Assesses eligibility of a physical serialized workpiece
   */
  public static evaluateSerialEligibility(params: {
    serialNumber: string;
    partId: string;
    executionStatus: 'VERIFIED' | 'FAILED' | 'UNKNOWN';
    metrologyStatus: 'ACCEPTED' | 'REJECTED' | 'INCONCLUSIVE';
    spcStatus: 'IN_CONTROL' | 'OUT_OF_CONTROL' | 'STABLE';
    ncrStatus: 'CLOSED' | 'OPEN' | 'NONE';
    capaStatus: 'EFFECTIVE' | 'PENDING' | 'NONE';
  }): SerialReleaseRecord {
    // Determine eligibility based on formal, deterministic evaluation logic
    const executionVerified = params.executionStatus === 'VERIFIED';
    const metrologyVerified = params.metrologyStatus === 'ACCEPTED';
    const spcVerified = params.spcStatus === 'IN_CONTROL' || params.spcStatus === 'STABLE';
    
    // Nonconformance records must be closed or non-existent
    const ncrCleared = params.ncrStatus === 'CLOSED' || params.ncrStatus === 'NONE';

    // Parts must pass all core categories to be eligible
    const isEligible = executionVerified && metrologyVerified && spcVerified && ncrCleared;

    return {
      serialNumber: params.serialNumber,
      partId: params.partId,
      executionVerified,
      metrologyVerified,
      spcVerified,
      ncrCleared,
      eligibilityStatus: isEligible ? 'ELIGIBLE' : 'BLOCKED'
    };
  }
}
