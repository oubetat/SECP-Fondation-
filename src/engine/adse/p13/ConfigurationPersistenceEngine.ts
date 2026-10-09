import { createHash } from 'crypto';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ConfigurationSnapshot } from './types';

export class ConfigurationPersistenceEngine {
  private registry: ConfigurationRegistry;

  constructor(registry: ConfigurationRegistry) {
    this.registry = registry;
  }

  /**
   * Computes a deterministic SHA-256 Merkle root hash across all sorted collections in the registry.
   */
  public computeMerkleRootHash(snapshot: Omit<ConfigurationSnapshot, 'merkleRootHash' | 'timestamp' | 'authority'>): string {
    const sortedConfigs = [...snapshot.configurations].sort((a, b) => a.configurationId.localeCompare(b.configurationId));
    const sortedBaselines = [...snapshot.baselines].sort((a, b) => a.baselineId.localeCompare(b.baselineId));
    const sortedApps = [...snapshot.applicabilities].sort((a, b) => a.applicabilityId.localeCompare(b.applicabilityId));
    const sortedVariants = [...snapshot.variants].sort((a, b) => a.variantId.localeCompare(b.variantId));
    const sortedRels = [...snapshot.relationships].sort((a, b) => a.id.localeCompare(b.id));
    const sortedDeps = [...snapshot.dependencies].sort((a, b) => a.dependencyId.localeCompare(b.dependencyId));
    const sortedReleases = [...snapshot.releases].sort((a, b) => a.releaseId.localeCompare(b.releaseId));
    const sortedAudits = [...snapshot.audits].sort((a, b) => a.auditId.localeCompare(b.auditId));
    const sortedCRs = [...snapshot.changeRequests].sort((a, b) => a.requestId.localeCompare(b.requestId));
    const sortedChanges = [...snapshot.changes].sort((a, b) => a.changeId.localeCompare(b.changeId));
    const sortedManifests = [...snapshot.manifests].sort((a, b) => a.manifestId.localeCompare(b.manifestId));

    const hashConfig = createHash('sha256').update(JSON.stringify(sortedConfigs)).digest('hex');
    const hashBaseline = createHash('sha256').update(JSON.stringify(sortedBaselines)).digest('hex');
    const hashApp = createHash('sha256').update(JSON.stringify(sortedApps)).digest('hex');
    const hashVariant = createHash('sha256').update(JSON.stringify(sortedVariants)).digest('hex');
    const hashRel = createHash('sha256').update(JSON.stringify(sortedRels)).digest('hex');
    const hashDep = createHash('sha256').update(JSON.stringify(sortedDeps)).digest('hex');
    const hashRelease = createHash('sha256').update(JSON.stringify(sortedReleases)).digest('hex');
    const hashAudit = createHash('sha256').update(JSON.stringify(sortedAudits)).digest('hex');
    const hashCR = createHash('sha256').update(JSON.stringify(sortedCRs)).digest('hex');
    const hashChange = createHash('sha256').update(JSON.stringify(sortedChanges)).digest('hex');
    const hashManifest = createHash('sha256').update(JSON.stringify(sortedManifests)).digest('hex');

    return createHash('sha256')
      .update(`${hashConfig}:${hashBaseline}:${hashApp}:${hashVariant}:${hashRel}:${hashDep}:${hashRelease}:${hashAudit}:${hashCR}:${hashChange}:${hashManifest}`)
      .digest('hex');
  }

  /**
   * Captures an immutable, sealed cryptographic snapshot of the registry's state.
   */
  public createSnapshot(authority: string): ConfigurationSnapshot {
    const configurations = Array.from(this.registry.configurations.values());
    const baselines = Array.from(this.registry.baselines.values());
    const applicabilities = Array.from(this.registry.applicabilities.values());
    const variants = Array.from(this.registry.variants.values());
    const relationships = Array.from(this.registry.relationships.values());
    const dependencies = Array.from(this.registry.dependencies.values());
    const releases = Array.from(this.registry.releases.values());
    const audits = Array.from(this.registry.audits.values());
    const changeRequests = Array.from(this.registry.changeRequests.values());
    const changes = Array.from(this.registry.changes.values());
    const manifests = Array.from(this.registry.manifests.values());

    const snapshotPayload = {
      configurations,
      baselines,
      applicabilities,
      variants,
      relationships,
      dependencies,
      releases,
      audits,
      changeRequests,
      changes,
      manifests
    };

    const merkleRootHash = this.computeMerkleRootHash(snapshotPayload);

    return {
      timestamp: new Date().toISOString(),
      merkleRootHash,
      authority,
      ...snapshotPayload
    };
  }

  /**
   * Rehydrates the registry's state from a snapshot after verifying cryptographic Merkle integrity.
   * Assures "deterministic snapshot integrity + reconstruction parity".
   */
  public restoreFromSnapshot(snapshot: ConfigurationSnapshot): {
    isValid: boolean;
    rehydratedCounts: { configs: number; baselines: number; apps: number; variants: number };
  } {
    const snapshotPayload = {
      configurations: snapshot.configurations,
      baselines: snapshot.baselines,
      applicabilities: snapshot.applicabilities,
      variants: snapshot.variants,
      relationships: snapshot.relationships,
      dependencies: snapshot.dependencies,
      releases: snapshot.releases,
      audits: snapshot.audits,
      changeRequests: snapshot.changeRequests,
      changes: snapshot.changes,
      manifests: snapshot.manifests
    };

    const computedHash = this.computeMerkleRootHash(snapshotPayload);

    if (computedHash !== snapshot.merkleRootHash) {
      throw new Error(`CONFIGURATION_SNAPSHOT_TAMPER_DETECTED: Computed Merkle root hash ${computedHash} does not match snapshot signature ${snapshot.merkleRootHash}`);
    }

    this.registry.clearAll();

    for (const c of snapshot.configurations) this.registry.registerConfiguration(c);
    for (const b of snapshot.baselines) this.registry.registerBaseline(b);
    for (const a of snapshot.applicabilities) this.registry.registerApplicability(a);
    for (const v of snapshot.variants) this.registry.registerVariant(v);
    for (const r of snapshot.relationships) this.registry.registerRelationship(r);
    for (const d of snapshot.dependencies) this.registry.registerDependency(d);
    for (const re of snapshot.releases) this.registry.registerRelease(re);
    for (const au of snapshot.audits) this.registry.registerAudit(au);
    for (const cr of snapshot.changeRequests) this.registry.registerChangeRequest(cr);
    for (const ch of snapshot.changes) this.registry.registerChange(ch);
    for (const m of snapshot.manifests) this.registry.registerManifest(m);

    return {
      isValid: true,
      rehydratedCounts: {
        configs: snapshot.configurations.length,
        baselines: snapshot.baselines.length,
        apps: snapshot.applicabilities.length,
        variants: snapshot.variants.length
      }
    };
  }
}
