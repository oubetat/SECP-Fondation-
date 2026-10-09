/**
 * PATCH-SECP-066: Spare Part Traceability Engine
 * Ensures only authorized and valid parts enter the maintenance loop.
 */

export interface SparePartBatch {
  partNumber: string;
  lotNumber: string;
  revision: string;
  expiryDate: string;
  isApproved: boolean;
}

export class SparePartTraceabilityEngine {
  public static validatePart(partNumber: string, batch: SparePartBatch): boolean {
    if (!batch.isApproved) return false;
    
    const expiry = new Date(batch.expiryDate);
    if (expiry < new Date()) return false;
    
    if (batch.partNumber !== partNumber) return false;
    
    return true;
  }
}
