/**
 * SECP Industrial OS — ROOT-1: Canonical Simulation Identity Service
 * 
 * Provides an authoritative source for the "Current Canonical Geometry"
 * to prevent simulation callers from supplying their own truth.
 */

import { RevisionEngine } from '../revision/RevisionEngine';

export class SimulationIdentityService {
  private static revisionEngine: RevisionEngine | null = null;

  public static initialize(engine: RevisionEngine) {
    this.revisionEngine = engine;
  }

  /**
   * Resolves the authoritative current revision hash for a model.
   */
  public static resolveAuthoritativeRevisionHash(modelId: string): string {
    if (!this.revisionEngine) {
      throw new Error('IDENTITY_SERVICE_UNINITIALIZED: RevisionEngine must be registered.');
    }
    const latest = this.revisionEngine.getLatestReleasedRevision(modelId) || this.revisionEngine.getLatestRevision(modelId);
    if (!latest) {
      throw new Error(`IDENTITY_RESOLUTION_FAILED: No revision history for model ${modelId}`);
    }
    return latest.revisionHash;
  }

  /**
   * Resolves the authoritative current geometry hash for a model.
   * This is the "Backend Invariant" that the caller cannot bypass.
   */
  public static resolveAuthoritativeGeometryHash(modelId: string): string {
    if (!this.revisionEngine) {
      throw new Error('IDENTITY_SERVICE_UNINITIALIZED: RevisionEngine must be registered.');
    }

    const latest = this.revisionEngine.getLatestReleasedRevision(modelId) || this.revisionEngine.getLatestRevision(modelId);
    if (!latest) {
      throw new Error(`IDENTITY_RESOLUTION_FAILED: No revision history for model ${modelId}`);
    }

    return latest.snapshot?.geometryState?.geometryHash || latest.revisionHash;
  }

  public static clear(): void {
    this.revisionEngine = null;
  }
}

