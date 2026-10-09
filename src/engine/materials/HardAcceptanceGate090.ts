import { MaterialDatabaseService } from "./MaterialDatabaseService";
import { ImportPipeline } from "./ImportPipeline";
import { MaterialSearchEngine } from "./MaterialSearchEngine";
import { MaterialResolver } from "./MaterialResolver";
import { IndependentMaterialDatabaseAuditor } from "./IndependentMaterialDatabaseAuditor";
import { DatabaseNamespace, MaterialDBStatus } from "./dbTypes";
import { MaterialFamily, PropertySourceType } from "./types";

export interface Gate090Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate090 {
  public static evaluateGate(): Gate090Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. ATOMIC_IMPORT_CHECK
    const rawData = [
      {
        canonicalName: 'Titanium Ti-6Al-4V',
        family: MaterialFamily.METAL,
        grade: 'Grade 5',
        properties: [
          { 
            name: 'YOUNGS_MODULUS', value: 114e9, unit: 'Pa', dimension: 'P', 
            provenance: { reference: 'ASTM B265', sourceType: PropertySourceType.STANDARD } 
          }
        ]
      }
    ];
    const manifest = ImportPipeline.importData(rawData, 'GATE_TESTER', DatabaseNamespace.SECP_NATIVE);
    checks.push({ 
      id: "ATOMIC_IMPORT_CHECK", 
      passed: manifest.acceptedCount === 1 && manifest.validationResult === 'SUCCESS', 
      details: "Verified atomic import pipeline with manifest generation" 
    });

    // 2. SEARCH_QUERY_CHECK
    const searchResults = MaterialSearchEngine.search({ canonicalName: 'Titanium' });
    checks.push({ 
      id: "SEARCH_QUERY_CHECK", 
      passed: searchResults.length > 0, 
      details: "Verified material search engine functionality" 
    });

    // 3. SOLVER_RESOLUTION_CHECK
    const dbId = searchResults[0].dbId;
    try {
      const simPackage = MaterialResolver.resolveForSimulation(dbId, ['YOUNGS_MODULUS'], 'LINEAR_ELASTIC');
      checks.push({ 
        id: "SOLVER_RESOLUTION_CHECK", 
        passed: simPackage.packageId.startsWith('SIM-PKG'), 
        details: "Verified solver material resolution and simulation package generation" 
      });
    } catch (e) {
      checks.push({ id: "SOLVER_RESOLUTION_CHECK", passed: false, details: `Resolution failed: ${e}` });
    }

    // 4. INDEPENDENT_DB_AUDIT
    const audit = IndependentMaterialDatabaseAuditor.auditDatabase();
    checks.push({ 
      id: "INDEPENDENT_DB_AUDIT", 
      passed: audit.verdict === "VALID", 
      details: "Verified independent database integrity audit" 
    });

    // 5. REVISION_IMMUTABILITY_CHECK
    try {
      MaterialDatabaseService.commitRecord(searchResults[0].identity, searchResults[0].properties, searchResults[0].namespace);
      checks.push({ id: "REVISION_IMMUTABILITY_CHECK", passed: false, details: "Duplicate revision commit was not blocked" });
    } catch (e) {
      checks.push({ id: "REVISION_IMMUTABILITY_CHECK", passed: true, details: "Verified prevention of revision overwrites" });
    }

    const passedChecks = checks.filter(c => c.passed).length;
    const verdict = passedChecks === checks.length ? "PASS" : "FAIL";

    return {
      verdict,
      totalChecks: checks.length,
      passedChecks,
      checks
    };
  }
}
