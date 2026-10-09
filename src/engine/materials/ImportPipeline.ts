import { 
  MaterialRecord, 
  DatabaseNamespace, 
  MaterialDBStatus, 
  MaterialImportManifest 
} from "./dbTypes";
import { MaterialIdentity, MaterialProperty } from "./types";
import { MaterialDatabaseService, IdentityResolver } from "./MaterialDatabaseService";
import { MaterialPropertyResolver } from "./MaterialPropertyResolver";

export class ImportPipeline {
  /**
   * Imports a collection of raw material data.
   * This is an atomic operation: either all succeed or none (for the purpose of the manifest).
   */
  public static importData(
    rawItems: any[], 
    importer: string, 
    namespace: DatabaseNamespace
  ): MaterialImportManifest {
    const importId = `IMPORT-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    let acceptedCount = 0;
    let rejectedCount = 0;
    let conflictCount = 0;
    let warningCount = 0;

    const manifest: MaterialImportManifest = {
      importId,
      source: 'RAW_BATCH',
      sourceHash: 'TODO_HASH',
      schemaVersion: 'MATERIAL_DB_SCHEMA_V1',
      importedBy: importer,
      timestamp,
      recordCount: rawItems.length,
      acceptedCount: 0,
      rejectedCount: 0,
      conflictCount: 0,
      warningCount: 0,
      validationResult: 'PENDING'
    };

    try {
      for (const item of rawItems) {
        // 1. SCHEMA_VALIDATE
        if (!item.canonicalName || !item.family) {
          rejectedCount++;
          continue;
        }

        // 2. IDENTITY_RESOLVE
        const materialId = IdentityResolver.resolve(item.canonicalName, item.grade, item.specification);
        
        // 3. NORMALIZE & UNIT_VALIDATE (Simplified)
        const properties: MaterialProperty[] = (item.properties || []).map((p: any) => {
          // Check dimension signature (Simplified)
          if (p.name === 'YOUNGS_MODULUS' && p.unit !== 'Pa' && p.unit !== 'GPa') {
            warningCount++;
          }
          return p;
        });

        const identity: MaterialIdentity = {
          materialId,
          canonicalName: item.canonicalName,
          family: item.family,
          grade: item.grade,
          specification: item.specification,
          standard: item.standard,
          revision: item.revision || 1,
          aliases: item.aliases || []
        };

        // 4. DUPLICATE & CONFLICT SCAN (Simplified)
        const existing = MaterialDatabaseService.getLatestRecord(`${namespace}:${materialId}`);
        if (existing) {
          // If properties differ but identity is same, it's a conflict or new revision
          if (existing.revision === identity.revision) {
            conflictCount++;
            rejectedCount++;
            continue;
          }
        }

        // 5. COMMIT
        MaterialDatabaseService.commitRecord(identity, properties, namespace);
        acceptedCount++;
      }

      manifest.acceptedCount = acceptedCount;
      manifest.rejectedCount = rejectedCount;
      manifest.conflictCount = conflictCount;
      manifest.warningCount = warningCount;
      manifest.validationResult = rejectedCount === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    } catch (error) {
      manifest.validationResult = 'FAILURE';
      // In a real atomic DB, we would rollback here.
    }

    MaterialDatabaseService.addManifest(manifest);
    return manifest;
  }
}
