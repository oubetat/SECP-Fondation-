import { MaterialIdentity, MaterialProperty, MaterialState } from "./types";

export class MaterialIdentityManager {
  /**
   * Generates a unique fingerprint for a material state.
   */
  public static generateFingerprint(
    identity: MaterialIdentity,
    properties: MaterialProperty[],
    state: MaterialState
  ): string {
    const raw = JSON.stringify({
      id: identity.materialId,
      rev: identity.revision,
      props: properties.map(p => ({ n: p.name, v: p.value, u: p.unit })),
      state: { t: state.temperature, c: state.condition }
    });

    let hashVal = 0;
    for (let i = 0; i < raw.length; i++) {
      hashVal = ((hashVal << 5) - hashVal) + raw.charCodeAt(i);
      hashVal |= 0;
    }
    return Math.abs(hashVal).toString(16).padStart(8, '0');
  }

  /**
   * Detects if two material definitions are effectively equivalent.
   */
  public static areEquivalent(m1: MaterialIdentity, m2: MaterialIdentity): boolean {
    if (m1.materialId === m2.materialId) return true;
    if (m1.canonicalName === m2.canonicalName && m1.grade === m2.grade && m1.standard === m2.standard) {
      return true;
    }
    return false;
  }
}
