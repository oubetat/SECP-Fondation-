/**
 * PATCH-SECP-064: Batch Release Engine
 * Directs macro release logistics on entire manufacturing batch run structures.
 * Segregates out-of-spec products and logs batch statistics cleanly.
 */

import { BatchReleaseOrder, SerialReleaseRecord } from './ManufacturingReleaseTypes';

export class BatchReleaseEngine {
  /**
   * Initializes a batch release order tracking physical parts
   */
  public static compileBatchRelease(params: {
    batchId: string;
    productTypeId: string;
    serialReleaseList: SerialReleaseRecord[];
  }): BatchReleaseOrder {
    if (params.serialReleaseList.length === 0) {
      throw new Error('Batch Release Error: Cannot process an empty batch release order.');
    }

    let releasedQuantity = 0;
    let blockedQuantity = 0;

    for (const serial of params.serialReleaseList) {
      if (serial.eligibilityStatus === 'ELIGIBLE') {
        releasedQuantity++;
      } else {
        blockedQuantity++;
      }
    }

    // A batch is compliant only if ALL constituent serials are completely eligible
    const overallStatus = blockedQuantity === 0 ? 'COMPLIANT' : 'NON_COMPLIANT';

    return {
      batchId: params.batchId,
      productTypeId: params.productTypeId,
      quantity: params.serialReleaseList.length,
      serialReleaseList: [...params.serialReleaseList],
      overallStatus,
      releasedQuantity,
      blockedQuantity
    };
  }

  /**
   * Overrides or locks batch release to HOLD state under secure engineering instruction
   */
  public static placeBatchOnHold(batch: BatchReleaseOrder): BatchReleaseOrder {
    return {
      ...batch,
      overallStatus: 'HOLD'
    };
  }
}
