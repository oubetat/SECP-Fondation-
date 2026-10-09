/**
 * PATCH-SECP-063: Nonconformance Logging Engine
 * Spawns and manages life-cycles of Nonconformance Records (NCR) with strict
 * digital-thread linking to part serials, operations, and metrology points.
 */

import { NonconformanceRecord, NCRType, NCRSeverity } from './NCRTypes';

export class NonconformanceEngine {
  /**
   * Initializes a nonconformance record with strict linkages
   */
  public static logNonconformance(params: {
    type: NCRType;
    severity: NCRSeverity;
    title: string;
    description: string;
    partSerial?: string;
    jobId?: string;
    operationId?: string;
    machineId?: string;
    toolId?: string;
    materialLotId?: string;
    measurementSessionId?: string;
    spcObservationId?: string;
    loggedBy: string;
  }): NonconformanceRecord {
    const timestamp = new Date().toISOString();
    const uniqueId = `ncr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ncrNumber = `NCR-2026-${randomSuffix}`;

    // Validations: If type is PART_DEFECT, a part serial must be supplied
    if (params.type === 'PART_DEFECT' && !params.partSerial) {
      throw new Error('Validation Error: PART_DEFECT nonconformance requires an associated part serial.');
    }

    // If type is MATERIAL_NONCONFORMANCE, a material lot must be supplied
    if (params.type === 'MATERIAL_NONCONFORMANCE' && !params.materialLotId) {
      throw new Error('Validation Error: MATERIAL_NONCONFORMANCE requires an associated Material Lot ID.');
    }

    return {
      ncrId: uniqueId,
      ncrNumber,
      type: params.type,
      severity: params.severity,
      status: 'OPEN',
      title: params.title,
      description: params.description,
      timestamp,
      partSerial: params.partSerial,
      jobId: params.jobId,
      operationId: params.operationId,
      machineId: params.machineId,
      toolId: params.toolId,
      materialLotId: params.materialLotId,
      measurementSessionId: params.measurementSessionId,
      spcObservationId: params.spcObservationId,
      loggedBy: params.loggedBy
    };
  }

  /**
   * Transition NCR status
   */
  public static updateStatus(
    ncr: NonconformanceRecord,
    nextStatus: NonconformanceRecord['status']
  ): NonconformanceRecord {
    // Basic state machine rules
    if (ncr.status === 'CLOSED' && nextStatus !== 'CLOSED') {
      throw new Error('Closed nonconformances cannot be re-opened without official MRB escalation.');
    }

    return {
      ...ncr,
      status: nextStatus
    };
  }
}
