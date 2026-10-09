/**
 * PATCH-113: Assembly Engineering BOM Engine
 * Deterministic, configuration-aware Bill of Materials generation
 */

import { AssemblyGraph } from "./AssemblyGraph";
import {
  AssemblyEngineeringBOM,
  AssemblyBOMItem,
  OccurrenceConfigurationState,
  AssemblyNodeType
} from "./types";

export class AssemblyBOMEngine {
  /**
   * Generate Engineering BOM for an assembly graph under a specific configuration
   */
  public static generateBOM(
    graph: AssemblyGraph,
    configurationId?: string
  ): AssemblyEngineeringBOM {
    const configId = configurationId || graph.activeConfigurationId || "DEFAULT";
    const config = graph.configurations.get(configId);

    // Map: Key = `${partId}:${partRevision}`
    const groupedParts = new Map<string, {
      partId: string;
      partRevision: string;
      partName: string;
      nodeType: AssemblyNodeType;
      occurrenceIds: string[];
      unit: string;
      materialName?: string;
      unitMassKg: number;
      isSubassembly: boolean;
      isSuppressed: boolean;
    }>();

    // Iterate all occurrences except root container
    for (const [occId, occ] of graph.occurrences) {
      if (occId === graph.rootOccurrenceId) continue;

      // Determine configuration state
      const occState = config?.occurrenceStates[occId] || occ.configurationState;
      const isSuppressed = occState === OccurrenceConfigurationState.SUPPRESSED || occState === OccurrenceConfigurationState.EXCLUDED;

      // Part key
      const key = `${occ.partId}:${occ.partRevision}`;
      const partDef = graph.partDefinitions.get(key);

      const partName = partDef?.name || occ.name;
      const unitMassKg = partDef?.massKg || 0;
      const materialName = partDef?.materialName || "GENERIC_METAL";
      const isSubassembly = occ.nodeType === AssemblyNodeType.SUBASSEMBLY;

      let entry = groupedParts.get(key);
      if (!entry) {
        entry = {
          partId: occ.partId,
          partRevision: occ.partRevision,
          partName,
          nodeType: occ.nodeType,
          occurrenceIds: [],
          unit: graph.unitSystem.lengthUnit,
          materialName,
          unitMassKg,
          isSubassembly,
          isSuppressed
        };
        groupedParts.set(key, entry);
      }

      entry.occurrenceIds.push(occId);
      // If at least one instance is active, the BOM row is marked active
      if (!isSuppressed) {
        entry.isSuppressed = false;
      }
    }

    // Sort grouped parts deterministically by partId then partRevision
    const sortedKeys = Array.from(groupedParts.keys()).sort();

    const items: AssemblyBOMItem[] = [];
    let itemNumber = 1;
    let totalQuantity = 0;
    let totalMassKg = 0;

    for (const key of sortedKeys) {
      const entry = groupedParts.get(key)!;
      const quantity = entry.occurrenceIds.length;
      const totalItemMass = entry.isSuppressed ? 0 : entry.unitMassKg * quantity;

      items.push({
        itemNumber: itemNumber++,
        partId: entry.partId,
        partRevision: entry.partRevision,
        partName: entry.partName,
        nodeType: entry.nodeType,
        quantity,
        occurrenceIds: entry.occurrenceIds.sort(),
        unit: entry.unit,
        materialName: entry.materialName,
        unitMassKg: entry.unitMassKg,
        totalMassKg: Number(totalItemMass.toFixed(4)),
        isSubassembly: entry.isSubassembly,
        isSuppressed: entry.isSuppressed
      });

      if (!entry.isSuppressed) {
        totalQuantity += quantity;
        totalMassKg += totalItemMass;
      }
    }

    return {
      assemblyId: graph.assemblyId,
      assemblyRevision: graph.assemblyRevision,
      configurationId: configId,
      generatedAt: Date.now(),
      totalUniqueParts: items.length,
      totalQuantity,
      totalMassKg: Number(totalMassKg.toFixed(4)),
      items
    };
  }
}
