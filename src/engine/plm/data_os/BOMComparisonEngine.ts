/**
 * SECP Industrial OS v3 — PATCH-181: BOM Comparison Engine
 * Computes deep structural and attribute differences between BOM Revisions/Configurations.
 */

import { BillOfMaterials, BOMDiffResult, BOMDiffChange, BOMItem } from './EngineeringDataOSTypes';

export class BOMComparisonEngine {
  /**
   * Compares two Bill of Materials revisions or configurations.
   */
  public static compareBOMs(bomA: BillOfMaterials, bomB: BillOfMaterials): BOMDiffResult {
    const changes: BOMDiffChange[] = [];
    const itemsA = new Map<string, BOMItem>();
    const itemsB = new Map<string, BOMItem>();

    bomA.items.forEach(i => itemsA.set(i.partNumber, i));
    bomB.items.forEach(i => itemsB.set(i.partNumber, i));

    let totalAdded = 0;
    let totalRemoved = 0;
    let totalModified = 0;
    let netCostDeltaUSD = 0;
    const engineeringImpactSummary: string[] = [];

    // Check additions and modifications in B compared to A
    for (const [partNumber, itemB] of itemsB.entries()) {
      if (!itemsA.has(partNumber)) {
        totalAdded++;
        const costDelta = itemB.quantity * itemB.unitCostUSD;
        netCostDeltaUSD += costDelta;
        changes.push({
          changeType: 'ADDED',
          partNumber,
          partName: itemB.partName,
          newValue: { qty: itemB.quantity, rev: itemB.revision, mat: itemB.materialSpec },
          costDeltaUSD: costDelta,
          weightDeltaKg: 0.85 * itemB.quantity,
          severity: 'MODERATE'
        });
        engineeringImpactSummary.push(`Added new component ${partNumber} (${itemB.partName}) at rev ${itemB.revision}`);
      } else {
        const itemA = itemsA.get(partNumber)!;
        let isModified = false;

        // Quantity check
        if (itemA.quantity !== itemB.quantity) {
          isModified = true;
          const costDelta = (itemB.quantity - itemA.quantity) * itemB.unitCostUSD;
          netCostDeltaUSD += costDelta;
          changes.push({
            changeType: 'QTY_MODIFIED',
            partNumber,
            partName: itemB.partName,
            oldValue: itemA.quantity,
            newValue: itemB.quantity,
            costDeltaUSD: costDelta,
            weightDeltaKg: (itemB.quantity - itemA.quantity) * 0.5,
            severity: 'MODERATE'
          });
          engineeringImpactSummary.push(`Quantity change for ${partNumber}: ${itemA.quantity} -> ${itemB.quantity}`);
        }

        // Revision check
        if (itemA.revision !== itemB.revision) {
          isModified = true;
          changes.push({
            changeType: 'REV_CHANGED',
            partNumber,
            partName: itemB.partName,
            oldValue: itemA.revision,
            newValue: itemB.revision,
            costDeltaUSD: 0,
            weightDeltaKg: 0,
            severity: 'CRITICAL'
          });
          engineeringImpactSummary.push(`Component revision upgrade on ${partNumber}: ${itemA.revision} -> ${itemB.revision} (requires fit check)`);
        }

        // Material check
        if (itemA.materialSpec !== itemB.materialSpec) {
          isModified = true;
          changes.push({
            changeType: 'MATERIAL_CHANGED',
            partNumber,
            partName: itemB.partName,
            oldValue: itemA.materialSpec,
            newValue: itemB.materialSpec,
            costDeltaUSD: 15.0 * itemB.quantity,
            weightDeltaKg: -0.2 * itemB.quantity,
            severity: 'CRITICAL'
          });
          engineeringImpactSummary.push(`Material specification change on ${partNumber}: ${itemA.materialSpec} -> ${itemB.materialSpec} (requires FEM re-validation)`);
        }

        // Supplier check
        if (itemA.supplierCode !== itemB.supplierCode) {
          isModified = true;
          changes.push({
            changeType: 'SUPPLIER_CHANGED',
            partNumber,
            partName: itemB.partName,
            oldValue: itemA.supplierCode,
            newValue: itemB.supplierCode,
            costDeltaUSD: 0,
            weightDeltaKg: 0,
            severity: 'INFO'
          });
          engineeringImpactSummary.push(`Supply chain vendor change for ${partNumber}: ${itemA.supplierCode} -> ${itemB.supplierCode}`);
        }

        if (isModified) totalModified++;
      }
    }

    // Check removals
    for (const [partNumber, itemA] of itemsA.entries()) {
      if (!itemsB.has(partNumber)) {
        totalRemoved++;
        const costDelta = -(itemA.quantity * itemA.unitCostUSD);
        netCostDeltaUSD += costDelta;
        changes.push({
          changeType: 'REMOVED',
          partNumber,
          partName: itemA.partName,
          oldValue: { qty: itemA.quantity, rev: itemA.revision, mat: itemA.materialSpec },
          costDeltaUSD: costDelta,
          weightDeltaKg: -0.85 * itemA.quantity,
          severity: 'MODERATE'
        });
        engineeringImpactSummary.push(`Removed obsolete component ${partNumber} (${itemA.partName})`);
      }
    }

    return {
      sourceRevision: bomA.revision,
      targetRevision: bomB.revision,
      sourceConfig: bomA.configurationId,
      targetConfig: bomB.configurationId,
      changes,
      totalAdded,
      totalRemoved,
      totalModified,
      netCostDeltaUSD,
      engineeringImpactSummary
    };
  }
}
