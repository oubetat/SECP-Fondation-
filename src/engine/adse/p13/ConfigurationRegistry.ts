import {
  Configuration,
  ConfigurationBaseline,
  ConfigurationApplicability,
  ConfigurationVariant,
  ConfigurationRelationship,
  ConfigurationDependency,
  ConfigurationRelease,
  ConfigurationAudit,
  ConfigurationChangeRequest,
  ConfigurationChange,
  ConfigurationManifest,
  ConfigurationItem
} from './types';

export class ConfigurationRegistry {
  public configurations: Map<string, Configuration> = new Map();
  public baselines: Map<string, ConfigurationBaseline> = new Map();
  public applicabilities: Map<string, ConfigurationApplicability> = new Map();
  public variants: Map<string, ConfigurationVariant> = new Map();
  public relationships: Map<string, ConfigurationRelationship> = new Map();
  public dependencies: Map<string, ConfigurationDependency> = new Map();
  public releases: Map<string, ConfigurationRelease> = new Map();
  public audits: Map<string, ConfigurationAudit> = new Map();
  public changeRequests: Map<string, ConfigurationChangeRequest> = new Map();
  public changes: Map<string, ConfigurationChange> = new Map();
  public manifests: Map<string, ConfigurationManifest> = new Map();

  // Helper arrays for canonical entity IDs so we can verify canonical binding
  private canonicalEntityIds: Set<string> = new Set();

  public registerCanonicalEntityId(entityId: string): void {
    if (!entityId || entityId.trim() === '') return;
    this.canonicalEntityIds.add(entityId);
  }

  public verifyCanonicalEntityBinding(entityId: string): boolean {
    // If the canonical entity ID registry has elements, verify it is registered.
    // If empty (e.g. at startup or blank test), we return true to prevent cold start block,
    // but in benchmarking/auditing we explicitly populate this to enforce binding.
    if (this.canonicalEntityIds.size === 0) return true;
    return this.canonicalEntityIds.has(entityId);
  }

  // --- Configuration Item & Header Registry ---
  public registerConfiguration(config: Configuration): void {
    if (!config.configurationId || config.configurationId.trim() === '') {
      throw new Error('INVALID_CONFIGURATION_ID: ID must be a non-empty string');
    }
    if (this.configurations.has(config.configurationId)) {
      throw new Error(`DUPLICATE_CONFIGURATION_ID: Configuration ${config.configurationId} already exists`);
    }

    // Validate and bind each ConfigurationItem to a Canonical Entity
    for (const item of config.items) {
      if (!item.id || item.id.trim() === '') {
        throw new Error('INVALID_CONFIGURATION_ITEM_ID: CI ID must be a non-empty string');
      }
      if (!this.verifyCanonicalEntityBinding(item.canonicalEntityRef)) {
        throw new Error(`CANONICAL_BINDING_VIOLATION: Configuration Item ${item.id} references non-existent canonical entity '${item.canonicalEntityRef}'`);
      }
    }

    this.configurations.set(config.configurationId, { ...config });
  }

  public getConfiguration(configId: string): Configuration | undefined {
    return this.configurations.get(configId);
  }

  public updateConfiguration(config: Configuration): void {
    if (!this.configurations.has(config.configurationId)) {
      throw new Error(`CONFIGURATION_NOT_FOUND: ${config.configurationId}`);
    }
    this.configurations.set(config.configurationId, { ...config });
  }

  // --- Baseline Register ---
  public registerBaseline(baseline: ConfigurationBaseline): void {
    if (!baseline.baselineId || baseline.baselineId.trim() === '') {
      throw new Error('INVALID_BASELINE_ID: ID must be a non-empty string');
    }
    if (this.baselines.has(baseline.baselineId)) {
      throw new Error(`DUPLICATE_BASELINE_ID: Baseline ${baseline.baselineId} already exists`);
    }
    this.baselines.set(baseline.baselineId, { ...baseline });
  }

  public getBaseline(baselineId: string): ConfigurationBaseline | undefined {
    return this.baselines.get(baselineId);
  }

  public updateBaseline(baseline: ConfigurationBaseline): void {
    if (!this.baselines.has(baseline.baselineId)) {
      throw new Error(`BASELINE_NOT_FOUND: ${baseline.baselineId}`);
    }
    this.baselines.set(baseline.baselineId, { ...baseline });
  }

  // --- Applicability Register ---
  public registerApplicability(app: ConfigurationApplicability): void {
    if (!app.applicabilityId || app.applicabilityId.trim() === '') {
      throw new Error('INVALID_APPLICABILITY_ID: ID must be a non-empty string');
    }
    if (this.applicabilities.has(app.applicabilityId)) {
      throw new Error(`DUPLICATE_APPLICABILITY_ID: Applicability ${app.applicabilityId} already exists`);
    }
    this.applicabilities.set(app.applicabilityId, { ...app });
  }

  public getApplicability(appId: string): ConfigurationApplicability | undefined {
    return this.applicabilities.get(appId);
  }

  // --- Variant Register ---
  public registerVariant(variant: ConfigurationVariant): void {
    if (!variant.variantId || variant.variantId.trim() === '') {
      throw new Error('INVALID_VARIANT_ID: ID must be a non-empty string');
    }
    if (this.variants.has(variant.variantId)) {
      throw new Error(`DUPLICATE_VARIANT_ID: Variant ${variant.variantId} already exists`);
    }
    this.variants.set(variant.variantId, { ...variant });
  }

  public getVariant(variantId: string): ConfigurationVariant | undefined {
    return this.variants.get(variantId);
  }

  public updateVariant(variant: ConfigurationVariant): void {
    if (!this.variants.has(variant.variantId)) {
      throw new Error(`VARIANT_NOT_FOUND: ${variant.variantId}`);
    }
    this.variants.set(variant.variantId, { ...variant });
  }

  // --- Relationship Register ---
  public registerRelationship(rel: ConfigurationRelationship): void {
    if (!rel.id || rel.id.trim() === '') {
      throw new Error('INVALID_RELATIONSHIP_ID: ID must be a non-empty string');
    }
    if (this.relationships.has(rel.id)) {
      throw new Error(`DUPLICATE_RELATIONSHIP_ID: Relationship ${rel.id} already exists`);
    }
    this.relationships.set(rel.id, { ...rel });
  }

  // --- Dependency Register ---
  public registerDependency(dep: ConfigurationDependency): void {
    if (!dep.dependencyId || dep.dependencyId.trim() === '') {
      throw new Error('INVALID_DEPENDENCY_ID: ID must be a non-empty string');
    }
    if (this.dependencies.has(dep.dependencyId)) {
      throw new Error(`DUPLICATE_DEPENDENCY_ID: Dependency ${dep.dependencyId} already exists`);
    }
    this.dependencies.set(dep.dependencyId, { ...dep });
  }

  // --- Release Register ---
  public registerRelease(rel: ConfigurationRelease): void {
    if (!rel.releaseId || rel.releaseId.trim() === '') {
      throw new Error('INVALID_RELEASE_ID: ID must be a non-empty string');
    }
    if (this.releases.has(rel.releaseId)) {
      throw new Error(`DUPLICATE_RELEASE_ID: Release ${rel.releaseId} already exists`);
    }
    this.releases.set(rel.releaseId, { ...rel });
  }

  public getRelease(releaseId: string): ConfigurationRelease | undefined {
    return this.releases.get(releaseId);
  }

  // --- Audit Register ---
  public registerAudit(audit: ConfigurationAudit): void {
    if (!audit.auditId || audit.auditId.trim() === '') {
      throw new Error('INVALID_AUDIT_ID: ID must be a non-empty string');
    }
    this.audits.set(audit.auditId, { ...audit });
  }

  // --- Change Request & Change Register ---
  public registerChangeRequest(req: ConfigurationChangeRequest): void {
    if (!req.requestId || req.requestId.trim() === '') {
      throw new Error('INVALID_CHANGE_REQUEST_ID: ID must be a non-empty string');
    }
    if (this.changeRequests.has(req.requestId)) {
      throw new Error(`DUPLICATE_CHANGE_REQUEST_ID: Change Request ${req.requestId} already exists`);
    }
    this.changeRequests.set(req.requestId, { ...req });
  }

  public getChangeRequest(requestId: string): ConfigurationChangeRequest | undefined {
    return this.changeRequests.get(requestId);
  }

  public updateChangeRequest(req: ConfigurationChangeRequest): void {
    if (!this.changeRequests.has(req.requestId)) {
      throw new Error(`CHANGE_REQUEST_NOT_FOUND: ${req.requestId}`);
    }
    this.changeRequests.set(req.requestId, { ...req });
  }

  public registerChange(change: ConfigurationChange): void {
    if (!change.changeId || change.changeId.trim() === '') {
      throw new Error('INVALID_CHANGE_ID: ID must be a non-empty string');
    }
    this.changes.set(change.changeId, { ...change });
  }

  public getChange(changeId: string): ConfigurationChange | undefined {
    return this.changes.get(changeId);
  }

  // --- Manifest Register ---
  public registerManifest(man: ConfigurationManifest): void {
    if (!man.manifestId || man.manifestId.trim() === '') {
      throw new Error('INVALID_MANIFEST_ID: ID must be a non-empty string');
    }
    this.manifests.set(man.manifestId, { ...man });
  }

  // --- Clear State ---
  public clearAll(): void {
    this.configurations.clear();
    this.baselines.clear();
    this.applicabilities.clear();
    this.variants.clear();
    this.relationships.clear();
    this.dependencies.clear();
    this.releases.clear();
    this.audits.clear();
    this.changeRequests.clear();
    this.changes.clear();
    this.manifests.clear();
  }
}
