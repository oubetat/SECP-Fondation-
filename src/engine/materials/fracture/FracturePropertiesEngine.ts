import { 
  FractureDataset, 
  FracturePropertyModel, 
  FractureVerdict, 
  FracturePropertyType,
  FractureMode
} from "./types";
import { FractureUtils } from "./FractureUtils";

export class FracturePropertiesEngine {
  /**
   * Normalizes and validates a fracture property from a dataset.
   */
  public static processProperty(dataset: FractureDataset): FracturePropertyModel {
    if (!dataset.provenance || !dataset.provenance.sourceId) {
      throw new Error("Invalid provenance for fracture dataset.");
    }

    return {
      propertyId: `fracture-${dataset.datasetId}`,
      type: dataset.fractureProperty,
      materialId: dataset.materialId,
      materialRevision: dataset.materialRevision,
      value: dataset.measuredValue,
      units: dataset.units,
      loadingMode: dataset.loadingMode,
      temperature: dataset.temperature,
      environment: dataset.environment,
      validityDomain: {
        minThickness: dataset.thickness * 0.8, // Simplified
        maxThickness: dataset.thickness * 1.2,
        minTemperature: dataset.temperature - 50,
        maxTemperature: dataset.temperature + 50
      },
      provenance: dataset.provenance,
      revision: 1
    };
  }

  /**
   * Performs a fracture assessment (LEFM Mode I).
   */
  public static assessLEFM(
    nominalStress: number,
    crackLength: number,
    geometryFactor: number,
    property: FracturePropertyModel
  ): { status: FractureVerdict; KI: number; ratio: number } {
    
    if (property.type !== FracturePropertyType.KIC && property.type !== FracturePropertyType.KC) {
      throw new Error("LEFM assessment requires KIc or Kc property.");
    }

    const KI = FractureUtils.calculateKI(nominalStress, crackLength, geometryFactor);
    const ratio = KI / property.value;

    let status = FractureVerdict.SUBCRITICAL;
    if (ratio >= 1.0) status = FractureVerdict.CRITICAL;
    if (ratio >= 1.2) status = FractureVerdict.SUPERCRITICAL;

    return { status, KI, ratio };
  }
}
