import { MaterialIdentity, MaterialProperty, MaterialState, MaterialEvidence } from "./types";
import { MaterialPropertyResolver } from "./MaterialPropertyResolver";
import { MaterialIdentityManager } from "./MaterialIdentityManager";

export class IndependentMaterialAuditor {
  /**
   * Audits a material for engineering truth.
   */
  public static auditMaterial(
    identity: MaterialIdentity,
    properties: MaterialProperty[],
    state: MaterialState
  ): MaterialEvidence {
    const issues: string[] = [];
    
    // 1. Provenance Check
    for (const prop of properties) {
      if (!prop.provenance || !prop.provenance.sourceId) {
        issues.push(`Property ${prop.name} missing provenance`);
      }
      if (!MaterialPropertyResolver.verifyUnit(prop)) {
        issues.push(`Property ${prop.name} has invalid or missing unit`);
      }
      if (!MaterialPropertyResolver.validateRange(prop)) {
        issues.push(`Property ${prop.name} value ${prop.value} is outside physical bounds`);
      }
    }

    // 2. Identity Completeness
    if (!identity.canonicalName) issues.push("Missing canonical name");
    if (!identity.family) issues.push("Missing material family taxonomy");

    const verdict = issues.length === 0 ? "VALID" : `INVALID: ${issues.join("; ")}`;
    
    return {
      materialId: identity.materialId,
      revision: identity.revision,
      fingerprint: MaterialIdentityManager.generateFingerprint(identity, properties, state),
      stateHash: issues.length === 0 ? "HASH_OK" : "HASH_CORRUPT",
      verdict,
      timestamp: new Date().toISOString()
    };
  }
}
