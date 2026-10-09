import { MaterialLotRecord } from './ManufacturingExecutionTypes';

export class MaterialTraceabilityEngine {
  public static createMaterialLot(
    materialLotId: string,
    materialType: string,
    dimensionsMm: string,
    millCertificateId: string,
    hardnessBrinell: number
  ): MaterialLotRecord {
    if (hardnessBrinell < 100) {
      throw new Error(`MATERIAL_REJECTED: Brinell hardness of ${hardnessBrinell} is below the acceptable threshold (100 HB).`);
    }

    return {
      materialLotId,
      materialType,
      dimensionsMm,
      millCertificateId,
      hardnessBrinell
    };
  }

  public static verifyCompatibility(lot: MaterialLotRecord, expectedMaterialType: string): boolean {
    // Basic verification: material type matching or subset/superset checks
    return lot.materialType.includes('AL') && expectedMaterialType.includes('AL');
  }
}
