import { createHash } from 'crypto';
import { SafetyRegistry } from './SafetyRegistry';
import { P12Snapshot, Hazard, SafetyControl, SafetyClaim, SafetyCase } from './types';

export class SafetyPersistenceEngine {
  private registry: SafetyRegistry;

  constructor(registry: SafetyRegistry) {
    this.registry = registry;
  }

  /**
   * Computes deterministic SHA-256 Merkle root hash over all P12 state elements.
   */
  public computeMerkleRootHash(
    hazards: Hazard[],
    controls: SafetyControl[],
    claims: SafetyClaim[],
    cases: SafetyCase[]
  ): string {
    const sortedHazards = [...hazards].sort((a, b) => a.hazardId.localeCompare(b.hazardId));
    const sortedControls = [...controls].sort((a, b) => a.controlId.localeCompare(b.controlId));
    const sortedClaims = [...claims].sort((a, b) => a.claimId.localeCompare(b.claimId));
    const sortedCases = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));

    const hHash = createHash('sha256').update(JSON.stringify(sortedHazards)).digest('hex');
    const cHash = createHash('sha256').update(JSON.stringify(sortedControls)).digest('hex');
    const clHash = createHash('sha256').update(JSON.stringify(sortedClaims)).digest('hex');
    const csHash = createHash('sha256').update(JSON.stringify(sortedCases)).digest('hex');

    return createHash('sha256')
      .update(`${hHash}:${cHash}:${clHash}:${csHash}`)
      .digest('hex');
  }

  /**
   * Creates a cryptographically sealed Merkle snapshot of current safety truth state.
   */
  public createSnapshot(authority: string): P12Snapshot {
    const hazards = this.registry.getAllHazards();
    const controls = this.registry.getAllSafetyControls();
    const claims = this.registry.getAllSafetyClaims();
    const cases = this.registry.getAllSafetyCases();

    const merkleRootHash = this.computeMerkleRootHash(hazards, controls, claims, cases);

    return {
      timestamp: new Date().toISOString(),
      merkleRootHash,
      authority,
      hazards: JSON.parse(JSON.stringify(hazards)),
      controls: JSON.parse(JSON.stringify(controls)),
      claims: JSON.parse(JSON.stringify(claims)),
      cases: JSON.parse(JSON.stringify(cases))
    };
  }

  /**
   * Rehydrates registry state from a snapshot after verifying cryptographic Merkle integrity.
   */
  public restoreFromSnapshot(snapshot: P12Snapshot): {
    isValid: boolean;
    rehydratedCounts: { hazards: number; controls: number; claims: number; cases: number };
  } {
    const computedHash = this.computeMerkleRootHash(
      snapshot.hazards,
      snapshot.controls,
      snapshot.claims,
      snapshot.cases
    );

    if (computedHash !== snapshot.merkleRootHash) {
      throw new Error(
        `SAFETY_SNAPSHOT_TAMPER_DETECTED: Computed hash ${computedHash} does not match snapshot Merkle root ${snapshot.merkleRootHash}`
      );
    }

    this.registry.clearAll();

    for (const h of snapshot.hazards) {
      this.registry.registerHazard(h);
    }
    for (const ctrl of snapshot.controls) {
      this.registry.registerSafetyControl(ctrl);
    }
    for (const claim of snapshot.claims) {
      this.registry.registerSafetyClaim(claim);
    }
    for (const cs of snapshot.cases) {
      this.registry.registerSafetyCase(cs);
    }

    return {
      isValid: true,
      rehydratedCounts: {
        hazards: snapshot.hazards.length,
        controls: snapshot.controls.length,
        claims: snapshot.claims.length,
        cases: snapshot.cases.length
      }
    };
  }
}
