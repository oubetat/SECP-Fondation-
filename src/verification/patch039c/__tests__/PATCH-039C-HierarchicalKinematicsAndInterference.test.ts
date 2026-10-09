import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringDocument,
  InMemoryDocumentResolver,
  HierarchicalKinematicSolver,
  AssemblyInterferenceAnalyzer,
  DrivenJointMotion,
  DEFAULT_UNIT_SYSTEM_MM
} from '../../../engine/cad-kernel/document';
import { TopoShapeEnum, Orientation } from '../../../engine/cad-kernel/topology/TopologyContracts';

describe('PATCH-039C: Hierarchical Assembly Kinematics & 3D Interference Engine', () => {
  let resolver: InMemoryDocumentResolver;

  let docPiston: EngineeringDocument;
  let docConRod: EngineeringDocument;
  let docEngineAssy: EngineeringDocument;
  let docVehicleRoot: EngineeringDocument;

  beforeEach(() => {
    resolver = new InMemoryDocumentResolver();

    // 1. Piston Part (Leaf Part)
    docPiston = {
      documentId: 'DOC_PISTON_01',
      revision: 1,
      type: 'PART',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { documentId: 'DOC_PISTON_01', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {},
      evidence: [],
      evaluatedShape: {
        id: 'SOLID_PISTON',
        shapeType: TopoShapeEnum.SOLID,
        innerShells: [],
        outerShell: {
          id: 'SHELL_PISTON',
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: Orientation.FORWARD,
              face: {
                id: 'FACE_PISTON_PIN',
                shapeType: TopoShapeEnum.FACE,
                outerLoop: { id: 'LOOP_P', shapeType: TopoShapeEnum.LOOP, orientedEdges: [] },
                innerLoops: [],
                persistentId: 'FACE_PISTON_PIN',
                geometry: {
                  type: 'CYLINDER',
                  origin: { x: 0, y: 0, z: 0 },
                  normal: { x: 0, y: 1, z: 0 },
                  radius: 5.0
                } as any
              }
            }
          ]
        }
      }
    };

    // 2. Connecting Rod Part (Leaf Part)
    docConRod = {
      documentId: 'DOC_CONROD_01',
      revision: 1,
      type: 'PART',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { documentId: 'DOC_CONROD_01', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {},
      evidence: [],
      evaluatedShape: {
        id: 'SOLID_CONROD',
        shapeType: TopoShapeEnum.SOLID,
        innerShells: [],
        outerShell: {
          id: 'SHELL_CONROD',
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: Orientation.FORWARD,
              face: {
                id: 'FACE_CONROD_EYE',
                shapeType: TopoShapeEnum.FACE,
                outerLoop: { id: 'LOOP_C', shapeType: TopoShapeEnum.LOOP, orientedEdges: [] },
                innerLoops: [],
                persistentId: 'FACE_CONROD_EYE',
                geometry: {
                  type: 'CYLINDER',
                  origin: { x: 0, y: 0, z: 100 },
                  normal: { x: 0, y: 1, z: 0 },
                  radius: 5.0
                } as any
              }
            }
          ]
        }
      }
    };

    // 3. Engine Assembly (Sub-Assembly)
    docEngineAssy = {
      documentId: 'DOC_ENGINE_ASSY_01',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { documentId: 'DOC_ENGINE_ASSY_01', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {},
      evidence: [],
      assembly: {
        instances: [
          {
            instanceId: 'PistonInstance',
            name: 'Piston 1',
            documentId: 'DOC_PISTON_01',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            isSuppressed: false
          },
          {
            instanceId: 'ConRodInstance',
            name: 'Connecting Rod 1',
            documentId: 'DOC_CONROD_01',
            position: { x: 0, y: 0, z: -100 },
            rotation: { x: 0, y: 0, z: 0 },
            isSuppressed: false
          }
        ],
        constraints: [
          {
            id: 'MATE_PIN_JOINT',
            mateId: 'MATE_PIN_JOINT',
            type: 'REVOLUTE',
            entity1: { occurrencePath: 'PistonInstance', entityType: 'FACE', entityId: 'FACE_PISTON_PIN' },
            entity2: { occurrencePath: 'ConRodInstance', entityType: 'FACE', entityId: 'FACE_CONROD_EYE' },
            suppressed: false
          }
        ]
      }
    };

    // 4. Vehicle Root Assembly (Top-Level)
    docVehicleRoot = {
      documentId: 'DOC_VEHICLE_ROOT',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { documentId: 'DOC_VEHICLE_ROOT', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {},
      evidence: [],
      assembly: {
        instances: [
          {
            instanceId: 'EngineBlockInstance',
            name: 'Engine Module',
            documentId: 'DOC_ENGINE_ASSY_01',
            position: { x: 100, y: 200, z: 50 },
            rotation: { x: 0, y: 0, z: 0 },
            isSuppressed: false
          }
        ],
        constraints: [
          {
            id: 'MATE_ENGINE_RIGID',
            mateId: 'MATE_ENGINE_RIGID',
            type: 'FASTENED',
            entity1: { occurrencePath: 'EngineBlockInstance', entityType: 'DATUM', entityId: 'ORIGIN' },
            entity2: { occurrencePath: 'ChassisInstance', entityType: 'DATUM', entityId: 'ORIGIN' },
            suppressed: false
          }
        ]
      }
    };

    resolver.register(docPiston);
    resolver.register(docConRod);
    resolver.register(docEngineAssy);
    resolver.register(docVehicleRoot);
  });

  it('01: Calculates system mobility DOFs accurately for Revolute joint assembly', () => {
    const dofResult = HierarchicalKinematicSolver.evaluateSystemDOF(docEngineAssy, resolver);

    expect(dofResult.status).toBe('UNDER_CONSTRAINED'); // 1 moving body = 6 DOFs, Revolute constrains 5 -> 1 unconstrained DOF
    expect(dofResult.totalInstances).toBe(2);
    expect(dofResult.totalSystemDOFs).toBe(6);
    expect(dofResult.constrainedDOFs).toBe(5);
    expect(dofResult.unconstrainedDOFs).toBe(1);
    expect(dofResult.joints.length).toBe(1);
    expect(dofResult.joints[0].jointType).toBe('REVOLUTE');
    expect(dofResult.joints[0].driverParameter).toBe('ANGLE');
  });

  it('02: Calculates system mobility for fully constrained rigid assembly', () => {
    docEngineAssy.assembly!.constraints = [
      {
        id: 'MATE_RIGID',
        mateId: 'MATE_RIGID',
        type: 'FASTENED',
        entity1: { occurrencePath: 'PistonInstance', entityType: 'DATUM', entityId: 'ORIGIN' },
        entity2: { occurrencePath: 'ConRodInstance', entityType: 'DATUM', entityId: 'ORIGIN' },
        suppressed: false
      }
    ];

    const dofResult = HierarchicalKinematicSolver.evaluateSystemDOF(docEngineAssy, resolver);

    expect(dofResult.status).toBe('FULLY_CONSTRAINED');
    expect(dofResult.unconstrainedDOFs).toBe(0);
    expect(dofResult.constrainedDOFs).toBe(6);
  });

  it('03: Applies driven joint angle motion and updates multi-level occurrence matrices without document mutation', () => {
    const docPistonBefore = JSON.stringify(docPiston);
    const docEngineBefore = JSON.stringify(docEngineAssy);

    const drivenMotions: DrivenJointMotion[] = [
      {
        mateId: 'MATE_PIN_JOINT',
        parameterType: 'ANGLE',
        value: Math.PI / 2 // 90 degrees rotation
      }
    ];

    const motionResult = HierarchicalKinematicSolver.applyJointMotion(docVehicleRoot, drivenMotions, resolver);

    expect(motionResult.status).toBe('SUCCESS');
    expect(motionResult.transforms.has('EngineBlockInstance')).toBe(true);
    expect(motionResult.transforms.has('EngineBlockInstance/ConRodInstance')).toBe(true);

    const conRodWorld = motionResult.transforms.get('EngineBlockInstance/ConRodInstance')!.worldMatrix;

    // Verify rotation occurred in the world transform (matrix.m is flat 16-element array)
    expect(conRodWorld.m[0]).toBeCloseTo(0, 4); // cos(PI/2) -> 0
    expect(conRodWorld.m[1]).toBeCloseTo(-1, 4); // -sin(PI/2) -> -1

    // Assert immutability
    expect(JSON.stringify(docPiston)).toBe(docPistonBefore);
    expect(JSON.stringify(docEngineAssy)).toBe(docEngineBefore);
  });

  it('04: Audits pairwise 3D spatial interference (CLEARANCE_VIOLATION)', () => {
    // Set ConRod offset so there is a 10mm gap between Piston and ConRod
    docEngineAssy.assembly!.instances[1].position = { x: 0, y: 0, z: -120 };

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      docVehicleRoot,
      'EngineBlockInstance/PistonInstance',
      'EngineBlockInstance/ConRodInstance',
      resolver,
      30.0 // 30mm clearance requirement (gap is 10mm, so clearance violation occurs)
    );

    expect(result.status).toBe('CLEARANCE_VIOLATION');
    expect(result.occurrencePathA).toBe('EngineBlockInstance/PistonInstance');
    expect(result.occurrencePathB).toBe('EngineBlockInstance/ConRodInstance');
    expect(result.clearanceThreshold).toBe(30.0);
    expect(result.minimumDistance).toBeLessThan(30.0);
  });

  it('05: Audits pairwise 3D spatial interference (HARD_COLLISION)', () => {
    // Position ConRod instance at z = -100 so its geometry (at +100) overlaps with Piston (at 0)
    docEngineAssy.assembly!.instances[1].position = { x: 0, y: 0, z: -100 };

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      docVehicleRoot,
      'EngineBlockInstance/PistonInstance',
      'EngineBlockInstance/ConRodInstance',
      resolver,
      1.0
    );

    expect(result.status).toBe('HARD_COLLISION');
    expect(result.overlapVolume).toBeGreaterThan(0);
    expect(result.contactPoints?.length).toBeGreaterThan(0);
  });

  it('06: Audits global assembly 3D interference across all leaf occurrences', () => {
    const report = AssemblyInterferenceAnalyzer.analyzeGlobalAssemblyInterference(
      docVehicleRoot,
      resolver,
      5.0
    );

    expect(report.totalLeafOccurrences).toBe(2);
    expect(report.pairsAudited).toBe(1);
    expect(report.results.length).toBe(1);
    expect(report.hasInterference).toBe(true);
  });

  it('07: Handles MISSING_OCCURRENCE gracefully during pairwise interference check', () => {
    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      docVehicleRoot,
      'EngineBlockInstance/NonExistentInstance',
      'EngineBlockInstance/PistonInstance',
      resolver,
      0.5
    );

    expect(result.status).toBe('MISSING_OCCURRENCE');
    expect(result.details).toContain('failed binding');
  });

  it('08: Correctly identifies NO_INTERFERENCE when components are far apart', () => {
    // Move conrod 500mm away
    docEngineAssy.assembly!.instances[1].position = { x: 0, y: 0, z: 500 };

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      docVehicleRoot,
      'EngineBlockInstance/PistonInstance',
      'EngineBlockInstance/ConRodInstance',
      resolver,
      1.0
    );

    expect(result.status).toBe('NO_INTERFERENCE');
    expect(result.minimumDistance).toBeGreaterThan(100);
  });

  it('09: Propagates CYCLE_ERROR during kinematic traversal of cyclic assemblies', () => {
    const docCyclicA: EngineeringDocument = {
      documentId: 'DOC_CYCLIC_A',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [], constraints: [], features: [], parameters: [],
      topologyMap: { documentId: 'DOC_CYCLIC_A', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {}, evidence: [],
      assembly: {
        instances: [{ instanceId: 'InstB', documentId: 'DOC_CYCLIC_B', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, isSuppressed: false }]
      }
    };

    const docCyclicB: EngineeringDocument = {
      documentId: 'DOC_CYCLIC_B',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [], constraints: [], features: [], parameters: [],
      topologyMap: { documentId: 'DOC_CYCLIC_B', version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
      derived: {}, evidence: [],
      assembly: {
        instances: [{ instanceId: 'InstA', documentId: 'DOC_CYCLIC_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, isSuppressed: false }]
      }
    };

    resolver.register(docCyclicA);
    resolver.register(docCyclicB);

    const motionResult = HierarchicalKinematicSolver.applyJointMotion(docCyclicA, [], resolver);

    expect(motionResult.status).toBe('CYCLE_ERROR');
    expect(motionResult.errors?.[0]).toContain('Cyclic sub-assembly reference');
  });

  it('10: Guarantees strict determinism across multiple kinematic solver evaluations', () => {
    const drivenMotions: DrivenJointMotion[] = [
      { mateId: 'MATE_PIN_JOINT', parameterType: 'ANGLE', value: 0.785398 } // ~45 deg
    ];

    const run1 = HierarchicalKinematicSolver.applyJointMotion(docVehicleRoot, drivenMotions, resolver);
    const run2 = HierarchicalKinematicSolver.applyJointMotion(docVehicleRoot, drivenMotions, resolver);

    expect(run1.status).toBe('SUCCESS');
    expect(run2.status).toBe('SUCCESS');

    const matrix1 = run1.transforms.get('EngineBlockInstance/ConRodInstance')!.worldMatrix;
    const matrix2 = run2.transforms.get('EngineBlockInstance/ConRodInstance')!.worldMatrix;

    expect(matrix1).toEqual(matrix2);
  });
});
