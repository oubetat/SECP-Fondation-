import { AP242SemanticModel } from './AP242Types';

export interface CmmInspectionPlanBridgeResult {
  fullyAssociated: boolean;
  requirements: Array<{
    id: string;
    characteristicType: string;
    nominal: number;
    upperTolerance: number;
    lowerTolerance: number;
    associatedGeometryIds: string[];
  }>;
  traceabilityHash: string;
}

export class AP242InspectionBridge {
  public static generateInspectionPlan(model: AP242SemanticModel, partNumber: string): CmmInspectionPlanBridgeResult {
    const requirements: any[] = [];

    // Map dimensions into inspection requirements
    for (const dim of model.dimensions) {
      requirements.push({
        id: `INSP-DIM-${dim.id}`,
        characteristicType: dim.dimensionType,
        nominal: dim.nominalValue,
        upperTolerance: dim.tolerance?.upperDeviationMm ?? 0.1,
        lowerTolerance: dim.tolerance?.lowerDeviationMm ?? -0.1,
        associatedGeometryIds: dim.referencedGeometryIds
      });
    }

    // Map GD&T into inspection requirements
    for (const gdt of model.geometricTolerances) {
      requirements.push({
        id: `INSP-GDT-${gdt.id}`,
        characteristicType: gdt.characteristic,
        nominal: gdt.toleranceValue,
        upperTolerance: gdt.toleranceValue,
        lowerTolerance: 0,
        associatedGeometryIds: gdt.referencedGeometryIds
      });
    }

    // Calculate traceability hash deterministically based on part number and requirements
    let hash = 0;
    const payload = partNumber + JSON.stringify(requirements);
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }

    return {
      fullyAssociated: requirements.every(req => req.associatedGeometryIds.length > 0),
      requirements,
      traceabilityHash: '0x' + Math.abs(hash).toString(16).padStart(8, '0')
    };
  }
}
