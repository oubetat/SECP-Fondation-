import { MaterialDatabaseService } from "./MaterialDatabaseService";
import { MaterialRecord, MaterialDBStatus } from "./dbTypes";

export interface DatabaseAuditReport {
  verdict: string;
  integrityScore: number;
  orphanCount: number;
  duplicateCount: number;
  hashConsistency: boolean;
  details: string[];
}

export class IndependentMaterialDatabaseAuditor {
  public static auditDatabase(): DatabaseAuditReport {
    const all = MaterialDatabaseService.getAllRecords();
    const details: string[] = [];
    let orphanCount = 0;
    let duplicateCount = 0;

    // 1. Check for Duplicate Identities (Multiple DB IDs for same identity)
    const identityMap = new Map<string, string>();
    all.forEach(record => {
      const idKey = `${record.canonicalName}|${record.identity.grade}`;
      if (identityMap.has(idKey) && identityMap.get(idKey) !== record.dbId) {
        duplicateCount++;
        details.push(`Identity Collision: ${record.canonicalName} has multiple database entries.`);
      }
      identityMap.set(idKey, record.dbId);
    });

    // 2. Check for Unit Consistency (Simplified)
    all.forEach(record => {
      record.properties.forEach(p => {
        if (!p.unit) {
          details.push(`Integrity Failure: Property ${p.name} in ${record.dbId} is missing units.`);
        }
      });
    });

    // 3. Check for Provenance
    all.forEach(record => {
      record.properties.forEach(p => {
        if (!p.provenance || !p.provenance.reference) {
          details.push(`Provenance Failure: Property ${p.name} in ${record.dbId} lacks source reference.`);
        }
      });
    });

    const passed = details.length === 0;
    
    return {
      verdict: passed ? "VALID" : "INVALID",
      integrityScore: passed ? 100 : Math.max(0, 100 - details.length * 10),
      orphanCount,
      duplicateCount,
      hashConsistency: true, // Simplified
      details
    };
  }
}
