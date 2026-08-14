/**
 * PATCH-SECP-060 — Material Traceability Engine
 * Enforces mill certificates, hardness validation, and inventory traceability.
 */

import { MaterialLotRecord } from './ManufacturingExecutionTypes';

export class MaterialTraceabilityEngine {
  /**
   * 060-E: Instantiates a material certificate and lot identification block
   */
  public static createMaterialLot(
    materialLotId: string,
    materialType: string,
    dimensionsMm: string,
    millCertificateId: string,
    hardnessBrinell: number
  ): MaterialLotRecord {
    // Basic compliance logic
    if (hardnessBrinell < 50) {
      throw new Error(`Material lot raw hardness too low (${hardnessBrinell} HB). Rejected raw feedstock material.`);
    }

    return {
      materialLotId,
      materialType,
      dimensionsMm,
      millCertificateId,
      hardnessBrinell
    };
  }

  /**
   * Asserts material lot compatibility with planned design requirements
   */
  public static verifyCompatibility(lot: MaterialLotRecord, requiredMaterial: string): boolean {
    return lot.materialType.toUpperCase() === requiredMaterial.toUpperCase();
  }
}
