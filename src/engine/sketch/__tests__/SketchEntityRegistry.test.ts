import { describe, it, expect } from 'vitest';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { SketchEntityRegistry } from '../SketchEntityRegistry';
import { SketchEntity } from '../SketchEntity';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';

describe('SketchEntityRegistry', () => {
  const sketchId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
    projectId: 'sketch-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

  const mockProvenance: ProvenanceNode = {
    id: 'prov-001',
    type: 'DESIGN',
    engineeringIdentityId: 'SECP:GEOMETRY:sketch-001',
    canonicalHash: 'abc',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    evidenceRefs: [],
  };

  const createEntity = (id: string, sId = sketchId): SketchEntity => ({
    id: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    type: 'POINT',
    sketchId: sId,
    construction: false,
    geometry: { type: 'POINT', x: 0, y: 0 },
    metadata: {},
    provenance: mockProvenance
  });

  it('TEST 09: Duplicate entity ID rejection', () => {
    const registry = new SketchEntityRegistry(sketchId);
    registry.add(createEntity('P1'));
    expect(() => registry.add(createEntity('P1'))).toThrow('already exists');
  });

  it('TEST 10: Entity from another sketch rejection', () => {
    const otherSketchId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
      projectId: 'sketch-999',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});
    const registry = new SketchEntityRegistry(sketchId);
    const rogueEntity = createEntity('P1', otherSketchId);
    expect(() => registry.add(rogueEntity)).toThrow('mismatch with registry sketchId');
  });
});
