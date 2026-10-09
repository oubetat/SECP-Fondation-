import { 
  MaterialRecord, 
  DatabaseNamespace, 
  MaterialDBStatus, 
  MaterialImportManifest 
} from "./dbTypes";
import { MaterialIdentity, MaterialProperty } from "./types";
import { MaterialIdentityManager } from "./MaterialIdentityManager";

export class MaterialDatabaseService {
  private static records: Map<string, MaterialRecord[]> = new Map();
  private static manifests: MaterialImportManifest[] = [];

  /**
   * Registers or updates a material record in the database.
   */
  public static commitRecord(
    identity: MaterialIdentity, 
    properties: MaterialProperty[], 
    namespace: DatabaseNamespace = DatabaseNamespace.SECP_NATIVE
  ): string {
    const dbId = `${namespace}:${identity.materialId}`;
    const timestamp = new Date().toISOString();

    const record: MaterialRecord = {
      dbId,
      materialId: identity.materialId,
      canonicalName: identity.canonicalName,
      family: identity.family,
      revision: identity.revision,
      namespace,
      status: MaterialDBStatus.IMPORTED,
      createdAt: timestamp,
      updatedAt: timestamp,
      identity,
      properties
    };

    const existing = this.records.get(dbId) || [];
    
    // Check if revision already exists to prevent overwrite
    const duplicateRevision = existing.find(r => r.revision === identity.revision);
    if (duplicateRevision) {
      throw new Error(`Material revision ${identity.revision} already exists for ${dbId}. Overwrite forbidden.`);
    }

    existing.push(record);
    this.records.set(dbId, existing);

    return dbId;
  }

  public static getRecords(dbId: string): MaterialRecord[] {
    return this.records.get(dbId) || [];
  }

  public static getLatestRecord(dbId: string): MaterialRecord | undefined {
    const records = this.records.get(dbId);
    if (!records || records.length === 0) return undefined;
    return records.sort((a, b) => b.revision - a.revision)[0];
  }

  public static getAllRecords(): MaterialRecord[] {
    const all: MaterialRecord[] = [];
    this.records.forEach(v => all.push(...v));
    return all;
  }

  public static addManifest(manifest: MaterialImportManifest): void {
    this.manifests.push(manifest);
  }

  public static getManifests(): MaterialImportManifest[] {
    return this.manifests;
  }

  public static clear(): void {
    this.records.clear();
    this.manifests = [];
  }
}

export class IdentityResolver {
  public static resolve(canonicalName: string, grade?: string, specification?: string): string {
    // Generate a deterministic ID based on identity traits
    const base = `${canonicalName}|${grade || 'NONE'}|${specification || 'NONE'}`;
    // Simple hash-like string
    return Buffer.from(base).toString('hex').substring(0, 12);
  }
}
