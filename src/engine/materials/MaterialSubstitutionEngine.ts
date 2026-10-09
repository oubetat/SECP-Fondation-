import { RegistryMaterialRecord } from "./MaterialRegistry";

export enum EquivalenceLevel {
  EXACT = 'EXACT',
  SPECIFICATION_MATCH = 'SPECIFICATION_MATCH',
  PROPERTY_MATCH = 'PROPERTY_MATCH',
  APPROXIMATE = 'APPROXIMATE',
  NOT_EQUIVALENT = 'NOT_EQUIVALENT'
}

export class MaterialSubstitutionEngine {
  /**
   * Assesses the substitution level between two material records.
   */
  public static assessEquivalence(m1: RegistryMaterialRecord, m2: RegistryMaterialRecord): EquivalenceLevel {
    if (m1.fingerprint === m2.fingerprint) return EquivalenceLevel.EXACT;

    const id1 = m1.identity;
    const id2 = m2.identity;

    if (id1.specification === id2.specification && id1.grade === id2.grade && id1.standard === id2.standard) {
      return EquivalenceLevel.SPECIFICATION_MATCH;
    }

    // Property-based comparison (Simplified for Patch-089)
    const e1 = m1.properties.find(p => p.name === 'YOUNGS_MODULUS')?.value;
    const e2 = m2.properties.find(p => p.name === 'YOUNGS_MODULUS')?.value;

    if (e1 && e2) {
      const diff = Math.abs(e1 - e2) / e1;
      if (diff < 0.01) return EquivalenceLevel.PROPERTY_MATCH;
      if (diff < 0.05) return EquivalenceLevel.APPROXIMATE;
    }

    return EquivalenceLevel.NOT_EQUIVALENT;
  }
}
