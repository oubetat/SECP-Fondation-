import {
  EngineeringIdentity,
  EngineeringObjectType,
  IdentityClassification
} from './CanonicalEngineeringIdentity';
import { EngineeringIdentityFactory } from './EngineeringIdentityFactory';

export interface LegacyArtifactDescriptor {
  id?: string;
  uuid?: string;
  name?: string;
  type?: string;
  domain?: string;
  projectId?: string;
  parentId?: string;
  revision?: string;
  author?: string;
}

export class LegacyEngineeringIdentityAdapter {
  /**
   * Infer EngineeringObjectType from legacy type / domain string.
   */
  public static inferObjectType(legacyType?: string, domain?: string): EngineeringObjectType {
    const combined = `${legacyType ?? ''}_${domain ?? ''}`.toUpperCase();

    if (combined.includes('MAT') || combined.includes('ALLOY')) return EngineeringObjectType.MATERIAL;
    if (combined.includes('MESH') || combined.includes('GRID')) return EngineeringObjectType.MESH;
    if (combined.includes('SIM') || combined.includes('FEM')) return EngineeringObjectType.SIMULATION;
    if (combined.includes('TOOL') || combined.includes('CAM')) return EngineeringObjectType.TOOLPATH;
    if (combined.includes('RES') || combined.includes('OUTPUT')) return EngineeringObjectType.RESULT;
    if (combined.includes('EVID')) return EngineeringObjectType.EVIDENCE;
    if (combined.includes('REV')) return EngineeringObjectType.REVISION;
    if (combined.includes('DESIGN') || combined.includes('PART')) return EngineeringObjectType.DESIGN;

    return EngineeringObjectType.GEOMETRY;
  }

  /**
   * Convert legacy artifact descriptor to modern EngineeringIdentity.
   */
  public static toEngineeringIdentity(descriptor: LegacyArtifactDescriptor, metadata: any = {}): EngineeringIdentity {
    const seed = descriptor.id || descriptor.uuid || descriptor.name || 'unnamed-artifact';
    const objectType = this.inferObjectType(descriptor.type, descriptor.domain);

    return EngineeringIdentityFactory.createIdentity({
      objectType,
      projectId: descriptor.projectId || 'LEGACY_IMPORT',
      revisionId: descriptor.revision || '1',
      createdBy: descriptor.author || 'LEGACY_SYSTEM',
      seed,
      parentIdentityId: descriptor.parentId
    }, metadata);
  }
}
