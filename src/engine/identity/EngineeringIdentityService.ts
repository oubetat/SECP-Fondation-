import { EngineeringIdentity, EngineeringObjectType, IdentityClassification } from './CanonicalEngineeringIdentity';
import { EngineeringIdentityFactory, CreateIdentityParams } from './EngineeringIdentityFactory';

export class EngineeringIdentityService {
  private static instance: EngineeringIdentityService;
  private identities = new Map<string, EngineeringIdentity>();
  private history = new Map<string, EngineeringIdentity[]>();

  private constructor() {}

  public static getInstance(): EngineeringIdentityService {
    if (!EngineeringIdentityService.instance) {
      EngineeringIdentityService.instance = new EngineeringIdentityService();
    }
    return EngineeringIdentityService.instance;
  }

  /**
   * Registers a pre-computed identity.
   */
  public registerIdentity(identity: EngineeringIdentity): void {
    // Basic validation
    if (!identity.identityId || !identity.objectType || !identity.contentHash) {
      throw new Error('[EngineeringIdentityService] Cannot register malformed identity');
    }

    if (this.identities.has(identity.identityId)) {
      const existing = this.identities.get(identity.identityId)!;
      if (existing.objectVersion === identity.objectVersion) {
        throw new Error(`[EngineeringIdentityService] Identity already registered: ${identity.identityId} v${identity.objectVersion}`);
      }
    }

    this.identities.set(identity.identityId, identity);
    const chain = this.history.get(identity.identityId) || [];
    chain.push(identity);
    this.history.set(identity.identityId, chain);
  }

  /**
   * Creates and registers a new identity.
   */
  public createIdentity(params: CreateIdentityParams, content: any): EngineeringIdentity {
    const identity = EngineeringIdentityFactory.createIdentity(params, content);
    this.registerIdentity(identity);
    return identity;
  }

  /**
   * Resolves the latest version of an identity.
   */
  public getIdentity(identityId: string): EngineeringIdentity | undefined {
    return this.identities.get(identityId);
  }

  /**
   * Creates a new revision of an existing identity.
   */
  public revisionIdentity(identityId: string, newContent: any, newRevisionId: string, author?: string): EngineeringIdentity {
    const current = this.identities.get(identityId);
    if (!current) {
      throw new Error(`[EngineeringIdentityService] Cannot revision non-existent identity: ${identityId}`);
    }

    const next = EngineeringIdentityFactory.createIdentity({
      objectType: current.objectType,
      projectId: current.projectId,
      revisionId: newRevisionId,
      createdBy: author || current.createdBy,
      seed: identityId, 
      parentIdentityId: identityId,
      objectVersion: current.objectVersion + 1,
      classification: current.classification,
      tags: current.tags
    }, newContent);

    this.registerIdentity(next);
    return next;
  }

  /**
   * Returns the full version history of an identity by traversing parent links.
   */
  public getIdentityHistory(identityId: string): readonly EngineeringIdentity[] {
    const history: EngineeringIdentity[] = [];
    let current = this.identities.get(identityId);
    
    // If identityId is not latest, we might need to find where it sits in a chain.
    // For simplicity, we assume identityId passed is the one we want to trace BACK from.
    
    while (current) {
      history.unshift(current);
      if (current.parentIdentityId) {
        current = this.identities.get(current.parentIdentityId);
      } else {
        current = undefined;
      }
    }
    
    return history;
  }

  /**
   * Internal test helper.
   */
  public clear(): void {
    this.identities.clear();
    this.history.clear();
  }
}
