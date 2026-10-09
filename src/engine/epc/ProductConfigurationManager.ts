/**
 * SECP Industrial OS — EPC-005: Product Configuration Manager
 * Domain-neutral, production-grade manager establishing and maintaining the authoritative chain:
 * Product → Revision → Variant → Configuration → Assembly → BOM → Engineering Baseline.
 */

import { EngineeringConfigurationBaselineData } from './ConfigurationBaselineTypes';
import { ProductConfigurationSerializer } from './ProductConfigurationSerializer';
import { ProductConfigurationValidator } from './ProductConfigurationValidator';
import {
  AssemblyReference,
  BOMReference,
  ConfigurationComparisonResult,
  ConfigurationDiffEntry,
  ConfigurationDriftDetail,
  ConfigurationDriftReport,
  ConfigurationProvenance,
  ConfigurationSnapshot,
  ProductConfigurationData,
  ProductConfigurationValidationError,
  ProductData,
  ProductRevisionData,
  ProductVariantData
} from './ProductConfigurationTypes';

export class ProductConfigurationManager {
  private products = new Map<string, ProductData>();
  private revisions = new Map<string, ProductRevisionData>();
  private variants = new Map<string, ProductVariantData>();
  private assemblies = new Map<string, AssemblyReference>();
  private boms = new Map<string, BOMReference>();
  private configurations = new Map<string, ProductConfigurationData>();
  private snapshots = new Map<string, ConfigurationSnapshot>();

  /**
   * Registers or creates a new Product along with its initial ProductRevision.
   */
  public createProduct(params: {
    productId: string;
    name: string;
    description: string;
    productType: string;
    initialRevisionCode?: string;
    creator?: string;
  }): { product: ProductData; revision: ProductRevisionData } {
    if (this.products.has(params.productId)) {
      throw new ProductConfigurationValidationError(
        `Product with ID ${params.productId} already exists`,
        'DUPLICATE_PRODUCT'
      );
    }

    const revisionId = `${params.productId}-REV-1`;
    const revisionCode = params.initialRevisionCode ?? 'A';
    const now = new Date().toISOString();
    const creator = params.creator ?? 'SYSTEM';

    const product: ProductData = {
      productId: params.productId,
      name: params.name,
      description: params.description,
      productType: params.productType,
      lifecycleStatus: 'DRAFT',
      currentRevisionId: revisionId,
      createdAt: now,
      createdBy: creator
    };

    const revision: ProductRevisionData = {
      revisionId,
      productId: params.productId,
      revisionCode,
      revisionNumber: 1,
      status: 'DRAFT',
      configurationIds: [],
      createdAt: now,
      createdBy: creator
    };

    ProductConfigurationValidator.validateProduct(product);
    ProductConfigurationValidator.validateRevision(revision, product);

    this.products.set(product.productId, product);
    this.revisions.set(revision.revisionId, revision);

    return { product, revision };
  }

  /**
   * Creates a new ProductRevision derived from a parent revision.
   */
  public createRevision(params: {
    productId: string;
    revisionCode: string;
    parentRevisionId: string;
    creator?: string;
  }): ProductRevisionData {
    const product = this.getProduct(params.productId);
    const parentRevision = this.getRevision(params.parentRevisionId);

    if (parentRevision.productId !== params.productId) {
      throw new ProductConfigurationValidationError(
        `Parent revision ${params.parentRevisionId} does not belong to product ${params.productId}`,
        'PARENT_REVISION_MISMATCH'
      );
    }

    const nextRevNum = parentRevision.revisionNumber + 1;
    const revisionId = `${params.productId}-REV-${nextRevNum}`;
    const now = new Date().toISOString();
    const creator = params.creator ?? 'SYSTEM';

    if (this.revisions.has(revisionId)) {
      throw new ProductConfigurationValidationError(
        `Revision ${revisionId} already exists`,
        'DUPLICATE_REVISION'
      );
    }

    const revision: ProductRevisionData = {
      revisionId,
      productId: params.productId,
      revisionCode: params.revisionCode,
      revisionNumber: nextRevNum,
      status: 'DRAFT',
      parentRevisionId: parentRevision.revisionId,
      configurationIds: [],
      createdAt: now,
      createdBy: creator
    };

    ProductConfigurationValidator.validateRevision(revision, product);

    this.revisions.set(revision.revisionId, revision);
    // Update product current revision
    const updatedProduct: ProductData = {
      ...product,
      currentRevisionId: revisionId
    };
    this.products.set(product.productId, updatedProduct);

    return revision;
  }

  /**
   * Releases a ProductRevision, locking it into RELEASED state.
   */
  public releaseRevision(revisionId: string): ProductRevisionData {
    const revision = this.getRevision(revisionId);
    if (revision.status === 'RELEASED') {
      return revision;
    }

    const released: ProductRevisionData = {
      ...revision,
      status: 'RELEASED'
    };

    this.revisions.set(revisionId, released);
    return released;
  }

  /**
   * Creates a ProductVariant attached to a Product.
   */
  public createVariant(params: {
    variantId: string;
    productId: string;
    variantCode: string;
    name: string;
    description: string;
  }): ProductVariantData {
    const product = this.getProduct(params.productId);
    if (this.variants.has(params.variantId)) {
      throw new ProductConfigurationValidationError(
        `Variant ${params.variantId} already exists`,
        'DUPLICATE_VARIANT'
      );
    }

    const variant: ProductVariantData = {
      variantId: params.variantId,
      productId: params.productId,
      variantCode: params.variantCode,
      name: params.name,
      description: params.description,
      status: 'ACTIVE'
    };

    ProductConfigurationValidator.validateVariant(variant, product);
    this.variants.set(variant.variantId, variant);
    return variant;
  }

  /**
   * Registers an AssemblyReference and computes its assemblyHash.
   */
  public registerAssembly(assembly: Omit<AssemblyReference, 'assemblyHash'> & { assemblyHash?: string }): AssemblyReference {
    const calculatedHash = ProductConfigurationSerializer.computeAssemblyHash(assembly);
    const fullAssembly: AssemblyReference = {
      ...assembly,
      assemblyHash: calculatedHash
    };

    ProductConfigurationValidator.validateAssembly(fullAssembly);
    this.assemblies.set(fullAssembly.assemblyId, fullAssembly);
    return fullAssembly;
  }

  /**
   * Registers a BOMReference and computes its bomHash.
   */
  public registerBOM(bom: Omit<BOMReference, 'bomHash'> & { bomHash?: string }): BOMReference {
    const calculatedHash = ProductConfigurationSerializer.computeBOMHash(bom);
    const fullBOM: BOMReference = {
      ...bom,
      bomHash: calculatedHash
    };

    ProductConfigurationValidator.validateBOM(fullBOM);
    this.boms.set(fullBOM.bomId, fullBOM);
    return fullBOM;
  }

  /**
   * Creates a ProductConfiguration linking Product + Revision + Variant + Assembly + BOM + Baseline.
   */
  public createConfiguration(params: {
    configurationId: string;
    productId: string;
    revisionId: string;
    variantId: string;
    configurationCode: string;
    assemblyId: string;
    bomId: string;
    baseline?: EngineeringConfigurationBaselineData;
    requirementTraceabilityRef?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    creator?: string;
  }): ProductConfigurationData {
    if (this.configurations.has(params.configurationId)) {
      throw new ProductConfigurationValidationError(
        `Configuration ${params.configurationId} already exists`,
        'DUPLICATE_CONFIGURATION'
      );
    }

    const product = this.getProduct(params.productId);
    const revision = this.getRevision(params.revisionId);
    const variant = this.getVariant(params.variantId);
    const assembly = this.getAssembly(params.assemblyId);
    const bom = this.getBOM(params.bomId);

    const now = new Date().toISOString();
    const creator = params.creator ?? 'SYSTEM';

    const sourceRevisions: Record<string, string> = {
      product: product.productId,
      revision: revision.revisionCode,
      variant: variant.variantCode,
      assembly: assembly.assemblyRevision,
      bom: bom.bomRevision
    };

    if (params.baseline) {
      sourceRevisions['baseline'] = params.baseline.revision;
    }

    const provenance: ConfigurationProvenance = {
      creator,
      createdAt: now,
      productId: product.productId,
      revisionId: revision.revisionId,
      variantId: variant.variantId,
      configurationId: params.configurationId,
      assemblyId: assembly.assemblyId,
      assemblyRevision: assembly.assemblyRevision,
      bomId: bom.bomId,
      bomRevision: bom.bomRevision,
      baselineId: params.baseline?.baselineId,
      sourceRevisions
    };

    const config: ProductConfigurationData = {
      configurationId: params.configurationId,
      productId: params.productId,
      revisionId: params.revisionId,
      variantId: params.variantId,
      configurationCode: params.configurationCode,
      status: 'DRAFT',
      assembly,
      bom,
      baselineId: params.baseline?.baselineId,
      baseline: params.baseline,
      requirementTraceabilityRef: params.requirementTraceabilityRef,
      effectiveFrom: params.effectiveFrom,
      effectiveTo: params.effectiveTo,
      isFrozen: false,
      createdAt: now,
      createdBy: creator,
      provenance
    };

    ProductConfigurationValidator.validateConfiguration(config, product, revision, variant);

    this.configurations.set(config.configurationId, config);

    // Link configurationId to revision
    const updatedRev: ProductRevisionData = {
      ...revision,
      configurationIds: [...new Set([...revision.configurationIds, config.configurationId])]
    };
    this.revisions.set(revision.revisionId, updatedRev);

    return config;
  }

  /**
   * Freezes and qualifies a ProductConfiguration, rendering it immutable and computing its contentHash.
   */
  public qualifyConfiguration(configurationId: string): ProductConfigurationData {
    const config = this.getConfiguration(configurationId);
    if (config.isFrozen || config.status === 'QUALIFIED') {
      return config;
    }

    const product = this.getProduct(config.productId);
    const revision = this.getRevision(config.revisionId);
    const variant = this.getVariant(config.variantId);

    // Preliminary frozen object to compute deterministic hash
    const candidateToHash: ProductConfigurationData = {
      ...config,
      status: 'QUALIFIED',
      isFrozen: true
    };

    const contentHash = ProductConfigurationSerializer.computeConfigurationHash(candidateToHash);

    const qualifiedConfig: ProductConfigurationData = {
      ...candidateToHash,
      contentHash,
      provenance: {
        ...candidateToHash.provenance,
        contentHash
      }
    };

    ProductConfigurationValidator.validateConfiguration(qualifiedConfig, product, revision, variant);

    this.configurations.set(configurationId, qualifiedConfig);

    // Save historical snapshot
    const snapshot = this.createSnapshot(qualifiedConfig);
    this.snapshots.set(configurationId, snapshot);

    // Set product status to ACTIVE if it was DRAFT
    if (product.lifecycleStatus === 'DRAFT') {
      this.products.set(product.productId, {
        ...product,
        lifecycleStatus: 'ACTIVE'
      });
    }

    return qualifiedConfig;
  }

  /**
   * Asserts that a configuration is not frozen before allowing modifications.
   */
  private assertMutableConfiguration(configurationId: string): void {
    const config = this.getConfiguration(configurationId);
    if (config.isFrozen || config.status === 'QUALIFIED') {
      throw new ProductConfigurationValidationError(
        `Configuration ${configurationId} is qualified and immutable. Modifications are prohibited.`,
        'IMMUTABILITY_VIOLATION'
      );
    }
  }

  /**
   * Updates a draft configuration. Throws IMMUTABILITY_VIOLATION if already qualified/frozen.
   */
  public updateDraftConfiguration(
    configurationId: string,
    updates: Partial<Pick<ProductConfigurationData, 'configurationCode' | 'effectiveFrom' | 'effectiveTo' | 'requirementTraceabilityRef'>>
  ): ProductConfigurationData {
    this.assertMutableConfiguration(configurationId);
    const existing = this.getConfiguration(configurationId);

    const updated: ProductConfigurationData = {
      ...existing,
      ...updates
    };

    ProductConfigurationValidator.validateConfiguration(updated);
    this.configurations.set(configurationId, updated);
    return updated;
  }

  /**
   * Generates a complete deterministic ConfigurationSnapshot for a configuration.
   */
  public createSnapshot(config: ProductConfigurationData): ConfigurationSnapshot {
    const product = this.getProduct(config.productId);
    const revision = this.getRevision(config.revisionId);
    const variant = this.getVariant(config.variantId);

    const snapshotPayload = {
      product,
      revision,
      variant,
      configuration: config,
      assembly: config.assembly,
      bom: config.bom,
      baseline: config.baseline,
      timestamp: new Date().toISOString()
    };

    const snapshotHash = ProductConfigurationSerializer.computeSnapshotHash(snapshotPayload);

    const snapshot: ConfigurationSnapshot = {
      ...snapshotPayload,
      snapshotHash
    };

    return snapshot;
  }

  /**
   * Retrieves a saved historical snapshot for a configuration.
   */
  public getSnapshot(configurationId: string): ConfigurationSnapshot {
    const snapshot = this.snapshots.get(configurationId);
    if (!snapshot) {
      const config = this.getConfiguration(configurationId);
      return this.createSnapshot(config);
    }
    return snapshot;
  }

  /**
   * Historical reconstruction of exact configuration state at a historical point.
   */
  public reconstructHistoricalConfiguration(configurationId: string): ConfigurationSnapshot {
    return this.getSnapshot(configurationId);
  }

  /**
   * Detects configuration drift between frozen configuration and current referenced components.
   */
  public detectDrift(
    configurationId: string,
    currentAssembly?: AssemblyReference,
    currentBOM?: BOMReference,
    currentBaseline?: EngineeringConfigurationBaselineData
  ): ConfigurationDriftReport {
    const config = this.getConfiguration(configurationId);
    const details: ConfigurationDriftDetail[] = [];
    const driftedItems: string[] = [];

    // Compare Assembly
    const targetAssembly = currentAssembly ?? this.assemblies.get(config.assembly.assemblyId);
    if (targetAssembly) {
      if (targetAssembly.assemblyRevision !== config.assembly.assemblyRevision) {
        driftedItems.push('assemblyRevision');
        details.push({
          component: 'Assembly',
          field: 'assemblyRevision',
          expected: config.assembly.assemblyRevision,
          actual: targetAssembly.assemblyRevision,
          message: `Assembly revision changed from ${config.assembly.assemblyRevision} to ${targetAssembly.assemblyRevision}`
        });
      }
      if (targetAssembly.assemblyHash !== config.assembly.assemblyHash) {
        driftedItems.push('assemblyHash');
        details.push({
          component: 'Assembly',
          field: 'assemblyHash',
          expected: config.assembly.assemblyHash,
          actual: targetAssembly.assemblyHash,
          message: 'Assembly component structure or hashes have drifted'
        });
      }
    }

    // Compare BOM
    const targetBOM = currentBOM ?? this.boms.get(config.bom.bomId);
    if (targetBOM) {
      if (targetBOM.bomRevision !== config.bom.bomRevision) {
        driftedItems.push('bomRevision');
        details.push({
          component: 'BOM',
          field: 'bomRevision',
          expected: config.bom.bomRevision,
          actual: targetBOM.bomRevision,
          message: `BOM revision changed from ${config.bom.bomRevision} to ${targetBOM.bomRevision}`
        });
      }
      if (targetBOM.bomHash !== config.bom.bomHash) {
        driftedItems.push('bomHash');
        details.push({
          component: 'BOM',
          field: 'bomHash',
          expected: config.bom.bomHash,
          actual: targetBOM.bomHash,
          message: 'BOM entries or component hashes have drifted'
        });
      }
    }

    // Compare Baseline
    if (config.baseline && currentBaseline) {
      if (currentBaseline.revision !== config.baseline.revision) {
        driftedItems.push('baselineRevision');
        details.push({
          component: 'Baseline',
          field: 'revision',
          expected: config.baseline.revision,
          actual: currentBaseline.revision,
          message: `Baseline revision changed from ${config.baseline.revision} to ${currentBaseline.revision}`
        });
      }
      if (currentBaseline.contentHash !== config.baseline.contentHash) {
        driftedItems.push('baselineContentHash');
        details.push({
          component: 'Baseline',
          field: 'contentHash',
          expected: config.baseline.contentHash,
          actual: currentBaseline.contentHash,
          message: 'Engineering Baseline content hash has drifted'
        });
      }
    }

    return {
      configurationId,
      isDriftDetected: driftedItems.length > 0,
      driftedItems,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Performs deep structural comparison between two ProductConfigurations.
   */
  public compareConfigurations(configIdA: string, configIdB: string): ConfigurationComparisonResult {
    const configA = this.getConfiguration(configIdA);
    const configB = this.getConfiguration(configIdB);
    const diffs: ConfigurationDiffEntry[] = [];

    // Product & Revision diffs
    if (configA.productId !== configB.productId) {
      diffs.push({
        path: 'productId',
        changeType: 'MODIFIED',
        oldValue: configA.productId,
        newValue: configB.productId,
        description: `Product ID changed from ${configA.productId} to ${configB.productId}`
      });
    }
    if (configA.revisionId !== configB.revisionId) {
      diffs.push({
        path: 'revisionId',
        changeType: 'MODIFIED',
        oldValue: configA.revisionId,
        newValue: configB.revisionId,
        description: `Product Revision changed from ${configA.revisionId} to ${configB.revisionId}`
      });
    }
    if (configA.variantId !== configB.variantId) {
      diffs.push({
        path: 'variantId',
        changeType: 'MODIFIED',
        oldValue: configA.variantId,
        newValue: configB.variantId,
        description: `Variant changed from ${configA.variantId} to ${configB.variantId}`
      });
    }

    // Assembly Diffs
    if (configA.assembly.assemblyRevision !== configB.assembly.assemblyRevision) {
      diffs.push({
        path: 'assembly.assemblyRevision',
        changeType: 'MODIFIED',
        oldValue: configA.assembly.assemblyRevision,
        newValue: configB.assembly.assemblyRevision,
        description: `Assembly revision changed from ${configA.assembly.assemblyRevision} to ${configB.assembly.assemblyRevision}`
      });
    }

    const compMapA = new Map(configA.assembly.componentReferences.map(c => [c.componentId, c]));
    const compMapB = new Map(configB.assembly.componentReferences.map(c => [c.componentId, c]));

    for (const [id, compA] of compMapA.entries()) {
      const compB = compMapB.get(id);
      if (!compB) {
        diffs.push({
          path: `assembly.components.${id}`,
          changeType: 'REMOVED',
          oldValue: compA,
          description: `Assembly component ${id} removed`
        });
      } else {
        if (compA.revision !== compB.revision || compA.quantity !== compB.quantity) {
          diffs.push({
            path: `assembly.components.${id}`,
            changeType: 'MODIFIED',
            oldValue: compA,
            newValue: compB,
            description: `Assembly component ${id} modified (Rev: ${compA.revision} -> ${compB.revision}, Qty: ${compA.quantity} -> ${compB.quantity})`
          });
        }
      }
    }

    for (const [id, compB] of compMapB.entries()) {
      if (!compMapA.has(id)) {
        diffs.push({
          path: `assembly.components.${id}`,
          changeType: 'ADDED',
          newValue: compB,
          description: `Assembly component ${id} added`
        });
      }
    }

    // BOM Diffs
    if (configA.bom.bomRevision !== configB.bom.bomRevision) {
      diffs.push({
        path: 'bom.bomRevision',
        changeType: 'MODIFIED',
        oldValue: configA.bom.bomRevision,
        newValue: configB.bom.bomRevision,
        description: `BOM revision changed from ${configA.bom.bomRevision} to ${configB.bom.bomRevision}`
      });
    }

    const bomMapA = new Map(configA.bom.entries.map(e => [e.componentId, e]));
    const bomMapB = new Map(configB.bom.entries.map(e => [e.componentId, e]));

    for (const [id, entryA] of bomMapA.entries()) {
      const entryB = bomMapB.get(id);
      if (!entryB) {
        diffs.push({
          path: `bom.entries.${id}`,
          changeType: 'REMOVED',
          oldValue: entryA,
          description: `BOM entry ${id} removed`
        });
      } else {
        if (entryA.revision !== entryB.revision || entryA.quantity !== entryB.quantity || entryA.unit !== entryB.unit) {
          diffs.push({
            path: `bom.entries.${id}`,
            changeType: 'MODIFIED',
            oldValue: entryA,
            newValue: entryB,
            description: `BOM entry ${id} modified`
          });
        }
      }
    }

    for (const [id, entryB] of bomMapB.entries()) {
      if (!bomMapA.has(id)) {
        diffs.push({
          path: `bom.entries.${id}`,
          changeType: 'ADDED',
          newValue: entryB,
          description: `BOM entry ${id} added`
        });
      }
    }

    // Baseline Diffs
    if (configA.baseline?.contentHash !== configB.baseline?.contentHash) {
      diffs.push({
        path: 'baseline.contentHash',
        changeType: 'MODIFIED',
        oldValue: configA.baseline?.contentHash,
        newValue: configB.baseline?.contentHash,
        description: 'Engineering Baseline changed'
      });
    }

    return {
      configIdA,
      configIdB,
      isIdentical: diffs.length === 0,
      diffs,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verifies the cryptographic contentHash integrity of a qualified configuration.
   */
  public verifyIntegrity(configurationId: string): boolean {
    const config = this.getConfiguration(configurationId);
    if (!config.isFrozen || !config.contentHash) {
      return false;
    }
    const expectedHash = ProductConfigurationSerializer.computeConfigurationHash(config);
    return config.contentHash === expectedHash;
  }

  // Getters
  public getProduct(productId: string): ProductData {
    const p = this.products.get(productId);
    if (!p) throw new ProductConfigurationValidationError(`Product ${productId} not found`, 'PRODUCT_NOT_FOUND');
    return p;
  }

  public getRevision(revisionId: string): ProductRevisionData {
    const r = this.revisions.get(revisionId);
    if (!r) throw new ProductConfigurationValidationError(`Revision ${revisionId} not found`, 'REVISION_NOT_FOUND');
    return r;
  }

  public getVariant(variantId: string): ProductVariantData {
    const v = this.variants.get(variantId);
    if (!v) throw new ProductConfigurationValidationError(`Variant ${variantId} not found`, 'VARIANT_NOT_FOUND');
    return v;
  }

  public getAssembly(assemblyId: string): AssemblyReference {
    const a = this.assemblies.get(assemblyId);
    if (!a) throw new ProductConfigurationValidationError(`Assembly ${assemblyId} not found`, 'ASSEMBLY_NOT_FOUND');
    return a;
  }

  public getBOM(bomId: string): BOMReference {
    const b = this.boms.get(bomId);
    if (!b) throw new ProductConfigurationValidationError(`BOM ${bomId} not found`, 'BOM_NOT_FOUND');
    return b;
  }

  public getConfiguration(configurationId: string): ProductConfigurationData {
    const c = this.configurations.get(configurationId);
    if (!c) throw new ProductConfigurationValidationError(`Configuration ${configurationId} not found`, 'CONFIGURATION_NOT_FOUND');
    return c;
  }
}
