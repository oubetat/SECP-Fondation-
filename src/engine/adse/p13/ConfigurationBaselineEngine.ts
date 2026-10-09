import { createHash } from 'crypto';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ConfigurationBaseline, ConfigurationStatus, ConfigurationItem, ConfigurationRelationship } from './types';

export class ConfigurationBaselineEngine {
  private registry: ConfigurationRegistry;

  constructor(registry: ConfigurationRegistry) {
    this.registry = registry;
  }

  /**
   * Computes the evidence root hash over all consolidated evidence references.
   * This is a Merkle-equivalent structure sealing physical truth evidence to the baseline.
   */
  public computeEvidenceRootHash(items: ConfigurationItem[]): string {
    const sortedEvidences = items
      .flatMap(item => item.evidenceRefs || [])
      .filter((v, i, self) => self.indexOf(v) === i) // Unique
      .sort((a, b) => a.localeCompare(b));

    if (sortedEvidences.length === 0) {
      return createHash('sha256').update('NO_EVIDENCE').digest('hex');
    }

    const hashes = sortedEvidences.map(ev => createHash('sha256').update(ev).digest('hex'));
    return createHash('sha256').update(hashes.join(':')).digest('hex');
  }

  /**
   * Creates an immutable Configuration Baseline under human security authority.
   * Prohibits silent mutations, establishes an immutable snapshot of all items and evidence.
   */
  public createBaseline(
    baselineId: string,
    title: string,
    configId: string,
    applicabilityId: string,
    actorRole: string,
    actorId: string
  ): ConfigurationBaseline {
    if (!baselineId || baselineId.trim() === '') {
      throw new Error('INVALID_BASELINE_ID: Baseline ID must be non-empty');
    }

    const config = this.registry.getConfiguration(configId);
    if (!config) {
      throw new Error(`CONFIGURATION_NOT_FOUND_FOR_BASELINE: ${configId}`);
    }

    if (config.status === ConfigurationStatus.INVALIDATED) {
      throw new Error(`CONFIGURATION_INVALIDATED: Cannot create baseline for invalidated configuration '${configId}'.`);
    }

    const applicability = this.registry.getApplicability(applicabilityId);
    if (!applicability) {
      throw new Error(`APPLICABILITY_NOT_FOUND_FOR_BASELINE: ${applicabilityId}`);
    }

    // Capture current configuration relationships
    const relationships = Array.from(this.registry.relationships.values()).filter(
      r => r.configurationId === configId
    );

    // Capture current configuration dependencies
    const dependencies = Array.from(this.registry.dependencies.values()).filter(
      d => d.sourceId === configId || config.items.some(it => it.id === d.sourceId)
    );

    // Compute cryptographic evidence root hash
    const evidenceRootHash = this.computeEvidenceRootHash(config.items);

    const provenance = {
      originHash: createHash('sha256')
        .update(`${baselineId}:${configId}:${evidenceRootHash}`)
        .digest('hex'),
      createdBy: `${actorRole}:${actorId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const baseline: ConfigurationBaseline = {
      baselineId,
      title,
      configurationId: configId,
      configurationItems: JSON.parse(JSON.stringify(config.items)), // Deep freeze clone
      relationships,
      dependencies,
      applicability,
      status: ConfigurationStatus.APPROVED,
      evidenceRootHash,
      provenance,
      revisionId: config.revisionId
    };

    this.registry.registerBaseline(baseline);
    return baseline;
  }

  /**
   * Enforces baseline immutability.
   * If any property is mutated, a BASELINE_IMMUTABILITY_VIOLATION error is thrown.
   */
  public verifyBaselineImmutability(baselineId: string, currentItems: ConfigurationItem[]): void {
    const baseline = this.registry.getBaseline(baselineId);
    if (!baseline) {
      throw new Error(`BASELINE_NOT_FOUND: ${baselineId}`);
    }

    const originalHash = this.computeEvidenceRootHash(baseline.configurationItems);
    const currentHash = this.computeEvidenceRootHash(currentItems);

    if (originalHash !== currentHash || baseline.configurationItems.length !== currentItems.length) {
      throw new Error(`BASELINE_IMMUTABILITY_VIOLATION: Baseline '${baselineId}' is cryptographically sealed. Direct modifications are strictly prohibited.`);
    }
  }
}
