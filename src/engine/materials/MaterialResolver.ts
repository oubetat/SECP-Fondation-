import { 
  MaterialRecord, 
  MaterialSimulationPackage, 
  MaterialDBStatus 
} from "./dbTypes";
import { MaterialDatabaseService } from "./MaterialDatabaseService";

export class MaterialResolver {
  /**
   * Resolves a material simulation package for a specific solver requirement.
   */
  public static resolveForSimulation(
    materialId: string, 
    requiredProperties: string[], 
    model: string
  ): MaterialSimulationPackage {
    const records = MaterialDatabaseService.getRecords(materialId);
    if (records.length === 0) {
      // Try resolving by database ID if materialId is not found as a direct ID
      // This is a bit loose, but fits the 'Resolver' pattern
      const all = MaterialDatabaseService.getAllRecords();
      const match = all.find(r => r.materialId === materialId || r.dbId === materialId);
      if (!match) throw new Error(`Material ${materialId} not found in database.`);
      return this.createPackage(match, requiredProperties, model);
    }

    // Default to latest record
    const latest = records.sort((a, b) => b.revision - a.revision)[0];
    return this.createPackage(latest, requiredProperties, model);
  }

  private static createPackage(
    record: MaterialRecord, 
    requiredProperties: string[], 
    model: string
  ): MaterialSimulationPackage {
    // Check compatibility: all required properties must be present
    const missing = requiredProperties.filter(req => !record.properties.find(p => p.name === req));
    if (missing.length > 0) {
      throw new Error(`Material ${record.canonicalName} is missing required properties for model ${model}: ${missing.join(', ')}`);
    }

    const packageId = `SIM-PKG-${record.dbId}-${record.revision}-${Date.now()}`;
    const selectedProperties = record.properties.filter(p => requiredProperties.includes(p.name));

    return {
      packageId,
      identity: record.identity,
      revision: record.revision,
      state: {}, // Default state
      requiredProperties,
      properties: selectedProperties,
      units: selectedProperties.reduce((acc, p) => ({ ...acc, [p.name]: p.unit }), {}),
      validityDomains: selectedProperties.map(p => p.validityDomain).filter(Boolean),
      model,
      sourceReferences: selectedProperties.map(p => p.provenance.reference),
      evidenceHashes: [record.identity.materialId], // Simplified
      timestamp: new Date().toISOString()
    };
  }
}
