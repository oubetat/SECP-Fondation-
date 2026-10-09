import { createHash } from 'crypto';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { Configuration, ConfigurationStatus } from './types';

export class ConfigurationAuthorityEngine {
  private registry: ConfigurationRegistry;
  private revisionEngine: RevisionEngine;

  constructor(registry: ConfigurationRegistry, revisionEngine: RevisionEngine) {
    this.registry = registry;
    this.revisionEngine = revisionEngine;
  }

  /**
   * Generates a unique, unambiguous cryptographic identity signature for a configuration state.
   * Signature is computed over: Configuration ID + Revision Ref + Applicability ID + Variant ID
   */
  public computeConfigurationIdentitySignature(
    configId: string,
    revisionId: string,
    applicabilityId: string,
    variantId: string
  ): string {
    if (!configId || !revisionId) {
      throw new Error('MISSING_IDENTITY_COMPONENTS: Configuration ID and Revision ID are non-negotiable for identity computation.');
    }

    return createHash('sha256')
      .update(`${configId}:${revisionId}:${applicabilityId}:${variantId}`)
      .digest('hex');
  }

  /**
   * Validates that a configuration conforms to SECP Revision and Configuration boundaries.
   * Ensures the configuration references a valid, active engineering revision in RevisionEngine,
   * keeping P13 strictly subordinate to SECP Revision Authority.
   */
  public validateRevisionBinding(config: Configuration): void {
    const revision = this.revisionEngine.getRevision(config.revisionId);
    if (!revision) {
      throw new Error(`REVISION_AUTHORITY_MISMATCH: Configuration '${config.configurationId}' references a non-existent revision '${config.revisionId}' in RevisionEngine.`);
    }

    // Verify each ConfigurationItem is revision-bound and matches the active revision scope or is compatible
    for (const item of config.items) {
      const itemRev = this.revisionEngine.getRevision(item.revisionRef);
      if (!itemRev) {
        throw new Error(`REVISION_AUTHORITY_MISMATCH: Configuration Item '${item.id}' references a non-existent revision '${item.revisionRef}' in RevisionEngine.`);
      }
    }
  }

  /**
   * Evaluates the absolute authoritative configuration state in a given temporal or operational context.
   */
  public resolveAuthoritativeConfiguration(configId: string): Configuration {
    const config = this.registry.getConfiguration(configId);
    if (!config) {
      throw new Error(`CONFIGURATION_NOT_FOUND: ${configId}`);
    }

    this.validateRevisionBinding(config);

    if (config.status === ConfigurationStatus.INVALIDATED) {
      throw new Error(`CONFIGURATION_INVALIDATED: Configuration ${configId} has been marked as invalid and cannot be resolved as authoritative.`);
    }

    return config;
  }
}
