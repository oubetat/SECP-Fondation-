/**
 * SECP Industrial OS — EPC-005: Product Configuration Serializer
 * Provides canonical, deterministic JSON serialization and cryptographic SHA-256 hashing
 * for Product Configurations, Assemblies, BOMs, and Configuration Snapshots.
 */

import { pureSha256 } from '../../polyfills/crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import {
  AssemblyReference,
  BOMReference,
  ConfigurationSnapshot,
  ProductConfigurationData
} from './ProductConfigurationTypes';

function cleanObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = typeof val === 'object' && val !== null ? cleanObject(val) : val;
    }
  }
  return result as T;
}

export class ProductConfigurationSerializer {
  /**
   * Computes a deterministic SHA-256 hash for an AssemblyReference.
   */
  public static computeAssemblyHash(assembly: Omit<AssemblyReference, 'assemblyHash'>): string {
    const clean = cleanObject({
      assemblyId: assembly.assemblyId,
      assemblyRevision: assembly.assemblyRevision,
      rootComponentId: assembly.rootComponentId,
      componentReferences: [...assembly.componentReferences].sort((a, b) =>
        a.componentId.localeCompare(b.componentId)
      )
    });
    const canonicalResult = CanonicalSerializer.serialize(clean);
    return pureSha256(canonicalResult.canonicalString);
  }

  /**
   * Computes a deterministic SHA-256 hash for a BOMReference.
   */
  public static computeBOMHash(bom: Omit<BOMReference, 'bomHash'>): string {
    const clean = cleanObject({
      bomId: bom.bomId,
      bomRevision: bom.bomRevision,
      entries: [...bom.entries].sort((a, b) => a.entryId.localeCompare(b.entryId))
    });
    const canonicalResult = CanonicalSerializer.serialize(clean);
    return pureSha256(canonicalResult.canonicalString);
  }

  /**
   * Computes a deterministic SHA-256 hash for a ProductConfigurationData.
   * Excludes contentHash and provenance.contentHash to prevent self-referential hash instability.
   */
  public static computeConfigurationHash(config: ProductConfigurationData): string {
    const cleanConfig = cleanObject({
      configurationId: config.configurationId,
      productId: config.productId,
      revisionId: config.revisionId,
      variantId: config.variantId,
      configurationCode: config.configurationCode,
      status: config.status,
      assembly: {
        assemblyId: config.assembly.assemblyId,
        assemblyRevision: config.assembly.assemblyRevision,
        rootComponentId: config.assembly.rootComponentId,
        componentReferences: [...config.assembly.componentReferences].sort((a, b) =>
          a.componentId.localeCompare(b.componentId)
        ),
        assemblyHash: config.assembly.assemblyHash
      },
      bom: {
        bomId: config.bom.bomId,
        bomRevision: config.bom.bomRevision,
        entries: [...config.bom.entries].sort((a, b) => a.entryId.localeCompare(b.entryId)),
        bomHash: config.bom.bomHash
      },
      baselineId: config.baselineId ?? null,
      baselineContentHash: config.baseline?.contentHash ?? null,
      requirementTraceabilityRef: config.requirementTraceabilityRef ?? null,
      effectiveFrom: config.effectiveFrom ?? null,
      effectiveTo: config.effectiveTo ?? null,
      isFrozen: config.isFrozen ?? false,
      provenance: {
        creator: config.provenance.creator,
        createdAt: config.provenance.createdAt,
        productId: config.provenance.productId,
        revisionId: config.provenance.revisionId,
        variantId: config.provenance.variantId,
        configurationId: config.provenance.configurationId,
        assemblyId: config.provenance.assemblyId,
        assemblyRevision: config.provenance.assemblyRevision,
        bomId: config.provenance.bomId,
        bomRevision: config.provenance.bomRevision,
        baselineId: config.provenance.baselineId ?? null,
        sourceRevisions: config.provenance.sourceRevisions
      }
    });

    const canonicalResult = CanonicalSerializer.serialize(cleanConfig);
    return pureSha256(canonicalResult.canonicalString);
  }

  /**
   * Computes deterministic SHA-256 hash for a complete ConfigurationSnapshot.
   */
  public static computeSnapshotHash(
    snapshot: Omit<ConfigurationSnapshot, 'snapshotHash'>
  ): string {
    const cleanSnapshot = cleanObject({
      product: {
        productId: snapshot.product.productId,
        name: snapshot.product.name,
        productType: snapshot.product.productType,
        lifecycleStatus: snapshot.product.lifecycleStatus,
        currentRevisionId: snapshot.product.currentRevisionId
      },
      revision: {
        revisionId: snapshot.revision.revisionId,
        revisionCode: snapshot.revision.revisionCode,
        revisionNumber: snapshot.revision.revisionNumber,
        status: snapshot.revision.status,
        parentRevisionId: snapshot.revision.parentRevisionId ?? null
      },
      variant: {
        variantId: snapshot.variant.variantId,
        variantCode: snapshot.variant.variantCode,
        name: snapshot.variant.name,
        status: snapshot.variant.status
      },
      configuration: {
        configurationId: snapshot.configuration.configurationId,
        configurationCode: snapshot.configuration.configurationCode,
        status: snapshot.configuration.status,
        contentHash: snapshot.configuration.contentHash ?? null
      },
      assembly: {
        assemblyId: snapshot.assembly.assemblyId,
        assemblyRevision: snapshot.assembly.assemblyRevision,
        assemblyHash: snapshot.assembly.assemblyHash
      },
      bom: {
        bomId: snapshot.bom.bomId,
        bomRevision: snapshot.bom.bomRevision,
        bomHash: snapshot.bom.bomHash
      },
      baselineContentHash: snapshot.baseline?.contentHash ?? null
    });

    const canonicalResult = CanonicalSerializer.serialize(cleanSnapshot);
    return pureSha256(canonicalResult.canonicalString);
  }

  /**
   * Serializes a snapshot into canonical JSON string.
   */
  public static serializeSnapshot(snapshot: ConfigurationSnapshot): string {
    const clean = cleanObject(snapshot);
    return CanonicalSerializer.serialize(clean).canonicalString;
  }
}
