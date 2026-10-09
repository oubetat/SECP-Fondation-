import { MaterialIdentity, MaterialProperty, MaterialState } from "./types";
import { MaterialIdentityManager } from "./MaterialIdentityManager";

export interface RegistryMaterialRecord {
  identity: MaterialIdentity;
  properties: MaterialProperty[];
  state: MaterialState;
  fingerprint: string;
}

export class MaterialRegistry {
  private static records: Map<string, RegistryMaterialRecord[]> = new Map();

  /**
   * Registers a new material or a new revision of an existing material.
   */
  public static register(identity: MaterialIdentity, properties: MaterialProperty[], state: MaterialState): string {
    const fingerprint = MaterialIdentityManager.generateFingerprint(identity, properties, state);
    const record: RegistryMaterialRecord = { identity, properties, state, fingerprint };

    const existing = this.records.get(identity.materialId) || [];
    existing.push(record);
    this.records.set(identity.materialId, existing);

    return fingerprint;
  }

  /**
   * Finds a material by various criteria.
   */
  public static query(criteria: Partial<MaterialIdentity>): RegistryMaterialRecord[] {
    const results: RegistryMaterialRecord[] = [];
    this.records.forEach(revisions => {
      revisions.forEach(record => {
        let match = true;
        if (criteria.canonicalName && record.identity.canonicalName !== criteria.canonicalName) match = false;
        if (criteria.family && record.identity.family !== criteria.family) match = false;
        if (criteria.grade && record.identity.grade !== criteria.grade) match = false;
        if (match) results.push(record);
      });
    });
    return results;
  }

  /**
   * Retrieves the full lineage of a material (all its revisions).
   */
  public static getLineage(materialId: string): RegistryMaterialRecord[] {
    return this.records.get(materialId) || [];
  }
}
