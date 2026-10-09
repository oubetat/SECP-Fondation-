import { 
  MaterialIdentity, 
  MaterialProperty, 
  MaterialFamily, 
  PropertySourceType,
  MaterialState 
} from "./types";
import { MaterialPropertyResolver } from "./MaterialPropertyResolver";
import { IndependentMaterialAuditor } from "./IndependentMaterialAuditor";
import { MaterialRegistry } from "./MaterialRegistry";
import { MaterialSubstitutionEngine, EquivalenceLevel } from "./MaterialSubstitutionEngine";

export interface Gate089Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate089 {
  public static evaluateGate(): Gate089Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. UNIT_INTEGRITY_CHECK
    const prop: MaterialProperty = {
      name: 'YOUNGS_MODULUS',
      value: 210e9,
      unit: 'Pa',
      dimension: 'M/L/T^2',
      provenance: { sourceId: 'S1', sourceType: PropertySourceType.STANDARD, reference: 'ASTM A36', timestamp: '', author: '', hash: '' }
    };
    const unitOk = MaterialPropertyResolver.verifyUnit(prop);
    checks.push({ id: "UNIT_INTEGRITY_CHECK", passed: unitOk, details: "Verified unit presence and dimension metadata" });

    // 2. CONFLICT_RESOLUTION_CHECK
    const pStandard: MaterialProperty = { ...prop, value: 200e9, provenance: { ...prop.provenance, sourceType: PropertySourceType.STANDARD } };
    const pCert: MaterialProperty = { ...prop, value: 205e9, provenance: { ...prop.provenance, sourceType: PropertySourceType.CERTIFICATE } };
    const resolved = MaterialPropertyResolver.resolveConflict(pStandard, pCert);
    checks.push({ id: "CONFLICT_RESOLUTION_CHECK", passed: resolved.value === 205e9, details: "Verified priority-based conflict resolution (Certificate > Standard)" });

    // 3. PHYSICAL_BOUNDS_CHECK
    const invalidProp: MaterialProperty = { ...prop, value: -100 };
    const rangeFail = !MaterialPropertyResolver.validateRange(invalidProp);
    checks.push({ id: "PHYSICAL_BOUNDS_CHECK", passed: rangeFail, details: "Detected physically impossible negative Young's Modulus" });

    // 4. INDEPENDENT_AUDIT_CHECK
    const identity: MaterialIdentity = {
      materialId: 'MAT-STEEL-001',
      canonicalName: 'Structural Steel',
      family: MaterialFamily.METAL,
      grade: 'A36',
      revision: 1,
      aliases: []
    };
    const state: MaterialState = { temperature: 293, pressure: 101325, condition: 'annealed', processingHistory: [] };
    const audit = IndependentMaterialAuditor.auditMaterial(identity, [prop], state);
    checks.push({ id: "INDEPENDENT_AUDIT_CHECK", passed: audit.verdict === "VALID", details: "Verified complete material ontology audit pass" });

    // 5. REGISTRY_LINEAGE_CHECK
    const fp1 = MaterialRegistry.register(identity, [prop], state);
    const identityV2 = { ...identity, revision: 2 };
    const propV2 = { ...prop, value: 211e9 };
    const fp2 = MaterialRegistry.register(identityV2, [propV2], state);
    const lineage = MaterialRegistry.getLineage(identity.materialId);
    checks.push({ id: "REGISTRY_LINEAGE_CHECK", passed: lineage.length === 2 && fp1 !== fp2, details: "Verified multi-revision registration and lineage tracking" });

    // 6. SUBSTITUTION_EQUIVALENCE_CHECK
    const rec1 = lineage[0];
    const rec2 = lineage[1];
    const equiv = MaterialSubstitutionEngine.assessEquivalence(rec1, rec2);
    const validEquiv = [EquivalenceLevel.SPECIFICATION_MATCH, EquivalenceLevel.PROPERTY_MATCH, EquivalenceLevel.APPROXIMATE].includes(equiv);
    checks.push({ id: "SUBSTITUTION_EQUIVALENCE_CHECK", passed: validEquiv, details: `Verified property-based substitution assessment (Result: ${equiv})` });

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
