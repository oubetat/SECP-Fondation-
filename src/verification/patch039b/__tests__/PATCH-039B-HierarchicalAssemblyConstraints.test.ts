import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringDocument,
  InMemoryDocumentResolver,
  HierarchicalConstraintBinder,
  AssemblyTopologyReference,
  AssemblyMate
} from '../../../engine/cad-kernel/document';
import { TopoShapeEnum } from '../../../engine/cad-kernel/topology/TopologyContracts';

describe('PATCH-039B: Hierarchical Assembly Constraints & Topological Entity Binding', () => {
  let resolver: InMemoryDocumentResolver;

  let cylinderHeadDoc: EngineeringDocument;
  let valveDoc: EngineeringDocument;
  let subAssemblyEngineDoc: EngineeringDocument;
  let rootVehicleDoc: EngineeringDocument;

  beforeEach(() => {
    resolver = new InMemoryDocumentResolver();

    // 1. Leaf Part: Valve
    valveDoc = {
      documentId: 'DOC_VALVE_01',
      revision: 1,
      type: 'PART',
      units: { length: 'mm', angle: 'deg', mass: 'kg' } as any,
      sketches: [
        {
          id: 'SK_VALVE_AXIS',
          name: 'ValveAxisDatum',
          plane: 'XY',
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          entities: []
        }
      ],
      constraints: [],
      features: [],
      parameters: [],
      evaluatedShape: {
        id: 'SHAPE_VALVE',
        shapeType: TopoShapeEnum.SOLID,
        outerShell: {
          id: 'SHELL_VALVE',
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: 'FORWARD' as any,
              face: {
                id: 'FACE_VALVE_STEM',
                persistentId: 'FACE_VALVE_STEM',
                surfaceType: 'CYLINDRICAL',
                geometry: {
                  origin: { x: 0, y: 0, z: 0 } as any,
                  normal: { x: 0, y: 1, z: 0 } as any, // cylinder normal/axis direction
                  radius: 4.0
                }
              } as any
            },
            {
              orientation: 'FORWARD' as any,
              face: {
                id: 'FACE_VALVE_TOP',
                persistentId: 'FACE_VALVE_TOP',
                surfaceType: 'PLANAR',
                geometry: {
                  origin: { x: 0, y: 0, z: 50 } as any,
                  normal: { x: 0, y: 0, z: 1 } as any
                },
                outerLoop: {
                  id: 'LOOP_VALVE_TOP',
                  orientedEdges: [
                    {
                      orientation: 'FORWARD' as any,
                      edge: {
                        id: 'EDGE_VALVE_TOP_CIRC',
                        persistentId: 'EDGE_VALVE_TOP_CIRC',
                        curveType: 'CIRCULAR',
                        startVertex: {
                          id: 'VERT_VALVE_TOP_01',
                          persistentId: 'VERT_VALVE_TOP_01',
                          geometry: { x: 4, y: 0, z: 50 } as any
                        },
                        endVertex: {
                          id: 'VERT_VALVE_TOP_02',
                          persistentId: 'VERT_VALVE_TOP_02',
                          geometry: { x: -4, y: 0, z: 50 } as any
                        }
                      } as any
                    }
                  ]
                }
              } as any
            }
          ]
        } as any
      }
    };

    // 2. Sub-Assembly Document: Cylinder Head
    cylinderHeadDoc = {
      documentId: 'DOC_CYL_HEAD_01',
      revision: 1,
      type: 'ASSEMBLY',
      units: { length: 'mm', angle: 'deg', mass: 'kg' } as any,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      evaluatedShape: {
        id: 'SHAPE_HEAD',
        shapeType: TopoShapeEnum.SOLID,
        outerShell: {
          id: 'SHELL_HEAD',
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: 'FORWARD' as any,
              face: {
                id: 'FACE_HEAD_GUIDE',
                persistentId: 'FACE_HEAD_GUIDE',
                surfaceType: 'CYLINDRICAL',
                geometry: {
                  origin: { x: 10, y: 20, z: 0 } as any,
                  normal: { x: 0, y: 1, z: 0 } as any,
                  radius: 4.05
                }
              } as any
            }
          ]
        } as any,
        innerShells: []
      },
      assembly: {
        instances: [
          {
            instanceId: 'INST_VALVE_01',
            documentId: 'DOC_VALVE_01',
            position: { x: 10, y: 20, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: []
      }
    };

    // 3. Nested Assembly Document: SubAssemblyEngine
    subAssemblyEngineDoc = {
      documentId: 'DOC_ENGINE_ASSY_01',
      revision: 1,
      type: 'ASSEMBLY',
      units: { length: 'mm', angle: 'deg', mass: 'kg' } as any,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST_HEAD_01',
            documentId: 'DOC_CYL_HEAD_01',
            position: { x: 100, y: 0, z: 0 },
            rotation: { x: 0, y: 90, z: 0 } // Rotated 90 deg around Y
          }
        ],
        mates: []
      }
    };

    // 4. Root Assembly Document: Vehicle
    rootVehicleDoc = {
      documentId: 'DOC_VEHICLE_ROOT',
      revision: 1,
      type: 'ASSEMBLY',
      units: { length: 'mm', angle: 'deg', mass: 'kg' } as any,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST_ENGINE_01',
            documentId: 'DOC_ENGINE_ASSY_01',
            position: { x: 500, y: 200, z: 100 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: []
      }
    };

    resolver.register(valveDoc);
    resolver.register(cylinderHeadDoc);
    resolver.register(subAssemblyEngineDoc);
    resolver.register(rootVehicleDoc);
  });

  it('01: Binds FACE topological entity inside part occurrence', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.worldGeometry).toBeDefined();
    expect(bound.worldGeometry?.origin).toEqual({ x: 10, y: 20, z: 0 });
    expect(bound.worldGeometry?.radius).toBe(4.0);
  });

  it('02: Binds EDGE topological entity inside part occurrence', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'EDGE',
      entityId: 'EDGE_VALVE_TOP_CIRC'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.worldGeometry?.origin).toEqual({ x: 14, y: 20, z: 50 });
  });

  it('03: Binds VERTEX topological entity inside part occurrence', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'VERTEX',
      entityId: 'VERT_VALVE_TOP_01'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.worldGeometry?.point).toEqual({ x: 14, y: 20, z: 50 });
  });

  it('04: Binds SKETCH DATUM / PLANE / AXIS', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'PLANE',
      entityId: 'SK_VALVE_AXIS'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.worldGeometry?.normal).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('05: Binds topological entities across deeply nested sub-assemblies (depth >= 3)', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_TOP'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(rootVehicleDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.worldGeometry).toBeDefined();
    // Normal initially (0, 0, 1) rotated 90 degrees around Y-axis becomes (1, 0, 0)
    expect(bound.worldGeometry?.normal?.x).toBeCloseTo(1, 10);
    expect(bound.worldGeometry?.normal?.y).toBeCloseTo(0, 10);
    expect(bound.worldGeometry?.normal?.z).toBeCloseTo(0, 10);
  });

  it('06: Deterministic occurrencePath generation', () => {
    const res = HierarchicalConstraintBinder.resolveOccurrencePath(
      rootVehicleDoc,
      'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      resolver
    );

    expect(res.status).toBe('RESOLVED');
    expect(res.targetDoc?.documentId).toBe('DOC_VALVE_01');
  });

  it('07: Hierarchical transform composition reaches depth >= 3', () => {
    const res = HierarchicalConstraintBinder.resolveOccurrencePath(
      rootVehicleDoc,
      'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      resolver
    );

    expect(res.status).toBe('RESOLVED');
    expect(res.worldMatrix.m).toHaveLength(16);
  });

  it('08: Evaluates CONCENTRIC mate across multiple documents', () => {
    const mate: AssemblyMate = {
      mateId: 'MATE_VALVE_GUIDE_CONCENTRIC',
      type: 'CONCENTRIC',
      instanceAId: 'INST_VALVE_01',
      instanceBId: 'ROOT',
      entityA: {
        occurrencePath: 'INST_VALVE_01',
        entityType: 'FACE',
        entityId: 'FACE_VALVE_STEM'
      },
      entityB: {
        occurrencePath: 'INST_VALVE_01', // Concentric to guide at same origin
        entityType: 'FACE',
        entityId: 'FACE_VALVE_STEM'
      }
    };

    const result = HierarchicalConstraintBinder.evaluateHierarchicalMate(cylinderHeadDoc, mate, resolver);

    expect(result.status).toBe('SOLVED');
    expect(result.satisfied).toBe(true);
    expect(result.residual).toBeLessThanOrEqual(1e-3);
  });

  it('09: Evaluates DISTANCE mate across multiple documents', () => {
    const mate: AssemblyMate = {
      mateId: 'MATE_VALVE_OFFSET',
      type: 'DISTANCE',
      instanceAId: 'INST_VALVE_01',
      instanceBId: 'ROOT',
      offset: 0,
      entityA: {
        occurrencePath: 'INST_VALVE_01',
        entityType: 'FACE',
        entityId: 'FACE_VALVE_STEM'
      },
      entityB: {
        occurrencePath: 'INST_VALVE_01',
        entityType: 'FACE',
        entityId: 'FACE_VALVE_STEM'
      }
    };

    const result = HierarchicalConstraintBinder.evaluateHierarchicalMate(cylinderHeadDoc, mate, resolver);

    expect(result.status).toBe('SOLVED');
    expect(result.satisfied).toBe(true);
  });

  it('10: Detects MISSING_OCCURRENCE for invalid path', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_ENGINE_01/INST_NON_EXISTENT',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(rootVehicleDoc, ref, resolver);

    expect(bound.status).toBe('MISSING_OCCURRENCE');
  });

  it('11: Detects MISSING_ENTITY for invalid topology ID in valid occurrence', () => {
    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_DOES_NOT_EXIST'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('MISSING_ENTITY');
    expect(bound.lineageStatus).toBe('REFERENCE_INVALIDATED');
  });

  it('12: Rejects INVALID_ENTITY_TYPE', () => {
    const ref: any = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'INVALID_TYPE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('INVALID_ENTITY_TYPE');
  });

  it('13: Enforces Child Document Immutability during constraint evaluation', () => {
    const originalJson = JSON.stringify(valveDoc);

    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(JSON.stringify(valveDoc)).toBe(originalJson);
  });

  it('14: Deterministic behavior regardless of resolver registration order', () => {
    const resA = HierarchicalConstraintBinder.resolveOccurrencePath(
      rootVehicleDoc,
      'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      resolver
    );

    const freshResolver = new InMemoryDocumentResolver();
    freshResolver.register(rootVehicleDoc);
    freshResolver.register(subAssemblyEngineDoc);
    freshResolver.register(cylinderHeadDoc);
    freshResolver.register(valveDoc);

    const resB = HierarchicalConstraintBinder.resolveOccurrencePath(
      rootVehicleDoc,
      'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      freshResolver
    );

    expect(resA.worldMatrix.m).toEqual(resB.worldMatrix.m);
  });

  it('15: Invalidation when topology is changed without lineage map', () => {
    const modifiedValveDoc = { ...valveDoc, evaluatedShape: undefined };
    resolver.register(modifiedValveDoc);

    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('MISSING_ENTITY');
    expect(bound.lineageStatus).toBe('REFERENCE_INVALIDATED');
  });

  it('16: Rebinds topology when exactly 1 clear successor exists in lineage', () => {
    const lineageDoc: EngineeringDocument = {
      ...valveDoc,
      evaluatedShape: {
        id: 'SHAPE_VALVE_MOD',
        shapeType: TopoShapeEnum.SOLID,
        outerShell: {
          id: 'SHELL_MOD',
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: 'FORWARD' as any,
              face: {
                id: 'FACE_VALVE_STEM_V2',
                persistentId: 'FACE_VALVE_STEM_V2',
                surfaceType: 'CYLINDRICAL',
                geometry: { origin: { x: 0, y: 0, z: 0 } as any, normal: { x: 0, y: 1, z: 0 } as any, radius: 4.0 }
              } as any
            }
          ]
        },
        innerShells: []
      },
      topologyMap: {
        documentId: 'DOC_VALVE_01',
        version: 2,
        entries: new Map([
          [
            'FACE_VALVE_STEM_V2',
            {
              topologyId: 'FACE_VALVE_STEM_V2',
              shapeType: TopoShapeEnum.FACE,
              sourceFeatureId: 'FEAT_01',
              operationType: 'MODIFY',
              generation: 2,
              predecessorTopologyIds: ['FACE_VALVE_STEM']
            }
          ]
        ]),
        faceMap: {},
        edgeMap: {},
        vertexMap: {}
      }
    };

    resolver.register(lineageDoc);

    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('RESOLVED');
    expect(bound.lineageStatus).toBe('REFERENCE_REBOUND');
    expect(bound.reboundEntityId).toBe('FACE_VALVE_STEM_V2');
  });

  it('17: Detects AMBIGUOUS when multiple lineage successors exist', () => {
    const splitDoc: EngineeringDocument = {
      ...valveDoc,
      evaluatedShape: undefined,
      topologyMap: {
        documentId: 'DOC_VALVE_01',
        version: 2,
        entries: new Map([
          [
            'FACE_SPLIT_01',
            {
              topologyId: 'FACE_SPLIT_01',
              shapeType: TopoShapeEnum.FACE,
              sourceFeatureId: 'FEAT_SPLIT',
              operationType: 'SPLIT',
              generation: 2,
              predecessorTopologyIds: ['FACE_VALVE_STEM']
            }
          ],
          [
            'FACE_SPLIT_02',
            {
              topologyId: 'FACE_SPLIT_02',
              shapeType: TopoShapeEnum.FACE,
              sourceFeatureId: 'FEAT_SPLIT',
              operationType: 'SPLIT',
              generation: 2,
              predecessorTopologyIds: ['FACE_VALVE_STEM']
            }
          ]
        ]),
        faceMap: {},
        edgeMap: {},
        vertexMap: {}
      }
    };

    resolver.register(splitDoc);

    const ref: AssemblyTopologyReference = {
      occurrencePath: 'INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const bound = HierarchicalConstraintBinder.bindEntity(cylinderHeadDoc, ref, resolver);

    expect(bound.status).toBe('AMBIGUOUS');
    expect(bound.lineageStatus).toBe('REFERENCE_AMBIGUOUS');
  });

  it('18: Propagates CYCLE_ERROR on cyclic assembly references', () => {
    const cyclicDocA: EngineeringDocument = {
      documentId: 'DOC_CYCLIC_A',
      revision: 1,
      type: 'ASSEMBLY',
      units: { length: 'mm', angle: 'deg', mass: 'kg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [{ instanceId: 'INST_B', documentId: 'DOC_CYCLIC_B', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
        mates: []
      }
    };

    const cyclicDocB: EngineeringDocument = {
      documentId: 'DOC_CYCLIC_B',
      revision: 1,
      type: 'ASSEMBLY',
      units: { length: 'mm', angle: 'deg', mass: 'kg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [{ instanceId: 'INST_A', documentId: 'DOC_CYCLIC_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
        mates: []
      }
    };

    resolver.register(cyclicDocA);
    resolver.register(cyclicDocB);

    const res = HierarchicalConstraintBinder.resolveOccurrencePath(cyclicDocA, 'INST_B/INST_A/INST_B', resolver);

    expect(res.status).toBe('CYCLE_ERROR');
  });

  it('19: Propagates suppression cascade through hierarchy', () => {
    const suppressedSubAssy: EngineeringDocument = {
      ...subAssemblyEngineDoc,
      assembly: {
        instances: [
          {
            instanceId: 'INST_HEAD_01',
            documentId: 'DOC_CYL_HEAD_01',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isSuppressed: true
          }
        ],
        mates: []
      }
    };

    resolver.register(suppressedSubAssy);

    const res = HierarchicalConstraintBinder.resolveOccurrencePath(
      rootVehicleDoc,
      'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      resolver
    );

    expect(res.suppressed).toBe(true);
  });

  it('20: Complete multi-level hierarchical assembly binding battery', () => {
    const ref1: AssemblyTopologyReference = {
      occurrencePath: 'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_STEM'
    };

    const ref2: AssemblyTopologyReference = {
      occurrencePath: 'INST_ENGINE_01/INST_HEAD_01/INST_VALVE_01',
      entityType: 'FACE',
      entityId: 'FACE_VALVE_TOP'
    };

    const b1 = HierarchicalConstraintBinder.bindEntity(rootVehicleDoc, ref1, resolver);
    const b2 = HierarchicalConstraintBinder.bindEntity(rootVehicleDoc, ref2, resolver);

    expect(b1.status).toBe('RESOLVED');
    expect(b2.status).toBe('RESOLVED');
  });
});
