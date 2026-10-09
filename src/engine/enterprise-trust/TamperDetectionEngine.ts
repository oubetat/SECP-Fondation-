/**
 * PATCH-SECP-070: Tamper Detection Engine
 * Detects mutations or substitutions in artifacts and provenance.
 */

export class TamperDetectionEngine {
  public static detectMutation(originalHash: string, currentHash: string): boolean {
    return originalHash !== currentHash;
  }

  public static detectReplay(timestamp: string, lastUsedTimestamp: string): boolean {
    return new Date(timestamp).getTime() <= new Date(lastUsedTimestamp).getTime();
  }
}
