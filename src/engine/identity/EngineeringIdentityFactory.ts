import * as crypto from 'crypto';
import {
  EngineeringIdentity,
  EngineeringObjectType,
  IdentityClassification
} from './CanonicalEngineeringIdentity';

export interface CreateIdentityParams {
  readonly objectType: EngineeringObjectType | string;
  readonly projectId: string;
  readonly revisionId: string;
  readonly createdBy: string;
  readonly parentIdentityId?: string;
  readonly parentId?: string;
  readonly artifactId?: string;
  readonly sourceSystem?: string;
  readonly objectVersion?: number;
  readonly seed: string;
  readonly classification?: IdentityClassification;
  readonly tags?: readonly string[];
  readonly timestamp?: string;
  readonly namespace?: string;
  readonly schemaVersion?: string;
}

export class EngineeringIdentityFactory {
  /**
   * Formats an identity into a stable string representation
   */
  public static formatCanonicalIdentity(identity: any): string {
    if (!identity) return '';
    if (typeof identity === 'string') return identity;
    const ns = identity.namespace || 'SECP';
    const type = identity.objectType || identity.artifactType || 'ENTITY';
    const id = identity.projectId || identity.artifactId || '';
    return `${ns}:${type}:${id}`;
  }
  /**
   * Create an immutable, deterministic EngineeringIdentity.
   */
  public static createIdentity(params: CreateIdentityParams, content: any): EngineeringIdentity {
    const contentHash = this.computeContentHash(content);
    const timestamp = params.timestamp || new Date().toISOString();
    const objectVersion = params.objectVersion || 1;
    const classification = params.classification || IdentityClassification.INTERNAL;
    const tags = params.tags || [];

    // Deterministic identityId generation: SHA-256 of canonical fields
    // Including createdBy ensures that identities are bound to their original author context
    const identityId = crypto
      .createHash('sha256')
      .update(`${params.projectId}:${params.objectType}:${params.seed}:${params.createdBy}`)
      .digest('hex');

    const identity: EngineeringIdentity = {
      identityId,
      objectType: params.objectType as EngineeringObjectType,
      projectId: params.projectId,
      revisionId: params.revisionId,
      objectVersion,
      parentIdentityId: params.parentIdentityId,
      contentHash,
      timestamp,
      createdBy: params.createdBy,
      classification,
      tags,
      artifactId: params.artifactId || params.projectId,
      artifactType: params.sourceSystem,
      namespace: params.namespace || 'SECP',
      schemaVersion: params.schemaVersion || '1.0'
    };

    return Object.freeze(identity);
  }

  /**
   * Computes deterministic SHA-256 hash of object content.
   */
  public static computeContentHash(content: any): string {
    const canonical = this.canonicalJsonStringify(content);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Validates that the identity object has all required fields.
   */
  public static validateIdentity(identity: EngineeringIdentity): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!identity.identityId) errors.push('Missing identityId');
    if (!identity.projectId) errors.push('Missing projectId');
    if (!identity.objectType) errors.push('Missing objectType');
    if (!identity.revisionId) errors.push('Missing revisionId');
    if (!identity.createdBy) errors.push('Missing createdBy');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Deterministically stringifies JSON with recursively sorted object keys.
   */
  private static canonicalJsonStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalJsonStringify(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const keyValues = sortedKeys.map(k => `"${k}":${this.canonicalJsonStringify((obj as any)[k])}`);
    return '{' + keyValues.join(',') + '}';
  }

  /**
   * Verifies if the identity's contentHash matches the current metadata.
   */
  public static verifyIntegrity(identity: EngineeringIdentity, content: any): boolean {
    const currentHash = this.computeContentHash(content);
    return identity.contentHash === currentHash;
  }

  /**
   * Verifies that the identityId was deterministically generated from its canonical fields.
   */
  public static verifyIdentityId(identity: EngineeringIdentity, seed: string): boolean {
    const expectedId = crypto
      .createHash('sha256')
      .update(`${identity.projectId}:${identity.objectType}:${seed}:${identity.createdBy}`)
      .digest('hex');
    return identity.identityId === expectedId;
  }
}
