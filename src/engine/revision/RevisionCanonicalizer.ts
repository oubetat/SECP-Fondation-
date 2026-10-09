import { createHash } from 'crypto';
import { Revision, DependencySnapshot, Effectivity } from './types';

export class RevisionCanonicalizer {
  
  public static computeContentHash(content: any): string {
    const canonical = this.canonicalizeObject(content);
    return createHash('sha256').update(canonical).digest('hex');
  }

  public static computeDependencyHash(dependencies: DependencySnapshot[]): string {
    const sortedDeps = [...dependencies].sort((a, b) => {
      const cmp = a.entityId.localeCompare(b.entityId);
      if (cmp !== 0) return cmp;
      return a.revisionId.localeCompare(b.revisionId);
    });
    
    const canonical = JSON.stringify(sortedDeps.map(d => ({ entityId: d.entityId, revisionId: d.revisionId })));
    return createHash('sha256').update(canonical).digest('hex');
  }

  public static computeRevisionHash(revision: Revision): string {
    const sortedEffectivity = [...revision.effectivity].sort((a, b) => a.type.localeCompare(b.type));
    const sortedScope = [...revision.configurationScope].sort();
    
    const canonical = JSON.stringify({
      entityId: revision.entityId,
      entityType: revision.entityType,
      revisionId: revision.revisionId,
      revisionCode: revision.revisionCode,
      revisionNumber: revision.revisionNumber,
      contentHash: revision.contentHash,
      dependencyHash: revision.dependencyHash,
      effectivity: sortedEffectivity,
      configurationScope: sortedScope
    });
    
    return createHash('sha256').update(canonical).digest('hex');
  }

  private static canonicalizeObject(obj: any): string {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (isNaN(obj)) return 'NaN';
        if (!isFinite(obj)) return obj > 0 ? 'Infinity' : '-Infinity';
        return Number(obj.toFixed(6)).toString(); // Fixed precision
      }
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(o => this.canonicalizeObject(o)).join(',') + ']';
    }
    
    const keys = Object.keys(obj).sort();
    let result = '{';
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      result += JSON.stringify(key) + ':' + this.canonicalizeObject(obj[key]);
      if (i < keys.length - 1) result += ',';
    }
    result += '}';
    return result;
  }
}
