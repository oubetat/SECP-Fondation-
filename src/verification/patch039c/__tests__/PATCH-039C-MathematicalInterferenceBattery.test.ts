import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringDocument,
  InMemoryDocumentResolver,
  AssemblyInterferenceAnalyzer,
  DEFAULT_UNIT_SYSTEM_MM
} from '../../../engine/cad-kernel/document';
import { TopoShapeEnum, Orientation } from '../../../engine/cad-kernel/topology/TopologyContracts';

describe('PATCH-039C: Mathematical Interference Battery (Explicit 4-State Proof)', () => {
  let resolver: InMemoryDocumentResolver;

  function createBoxDocument(docId: string, minCorner: { x: number; y: number; z: number }, maxCorner: { x: number; y: number; z: number }): EngineeringDocument {
    return {
      documentId: docId,
      revision: 1,
      type: 'PART',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: [],
      evaluatedShape: {
        id: `SOLID_${docId}`,
        shapeType: TopoShapeEnum.SOLID,
        innerShells: [],
        outerShell: {
          id: `SHELL_${docId}`,
          shapeType: TopoShapeEnum.SHELL,
          orientedFaces: [
            {
              orientation: Orientation.FORWARD,
              face: {
                id: `FACE_${docId}_MIN`,
                shapeType: TopoShapeEnum.FACE,
                outerLoop: { id: `LOOP_${docId}`, shapeType: TopoShapeEnum.LOOP, orientedEdges: [] },
                innerLoops: [],
                persistentId: `FACE_${docId}_MIN`,
                geometry: {
                  type: 'PLANAR',
                  origin: minCorner,
                  normal: { x: 0, y: 0, z: -1 }
                } as any
              }
            },
            {
              orientation: Orientation.FORWARD,
              face: {
                id: `FACE_${docId}_MAX`,
                shapeType: TopoShapeEnum.FACE,
                outerLoop: { id: `LOOP_${docId}_2`, shapeType: TopoShapeEnum.LOOP, orientedEdges: [] },
                innerLoops: [],
                persistentId: `FACE_${docId}_MAX`,
                geometry: {
                  type: 'PLANAR',
                  origin: maxCorner,
                  normal: { x: 0, y: 0, z: 1 }
                } as any
              }
            }
          ]
        }
      }
    };
  }

  beforeEach(() => {
    resolver = new InMemoryDocumentResolver();
  });

  it('Case 1: HARD_COLLISION — Overlap volume V_overlap > 0', () => {
    // Box A: [0, 10] x [0, 10] x [0, 10]
    // Box B: [5, 15] x [0, 10] x [0, 10] -> Overlap in X from [5, 10], V_overlap = 5 * 10 * 10 = 500 mm3
    const docA = createBoxDocument('DOC_BOX_A', { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    const docB = createBoxDocument('DOC_BOX_B', { x: 5, y: 0, z: 0 }, { x: 15, y: 10, z: 10 });

    const rootDoc: EngineeringDocument = {
      documentId: 'DOC_ROOT_HARD',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [], constraints: [], features: [], parameters: [],
      topologyMap: { version: 1 }, derived: {}, evidence: [],
      assembly: {
        instances: [
          { instanceId: 'InstA', documentId: 'DOC_BOX_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'InstB', documentId: 'DOC_BOX_B', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ]
      }
    };

    resolver.register(docA);
    resolver.register(docB);
    resolver.register(rootDoc);

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      rootDoc, 'InstA', 'InstB', resolver, 1.0
    );

    expect(result.status).toBe('HARD_COLLISION');
    expect(result.overlapVolume).toBeGreaterThan(0);
  });

  it('Case 2: CLEARANCE_VIOLATION — Gap d_min = 0.2mm < required 0.5mm', () => {
    // Box A: [0, 10] x [0, 10] x [0, 10]
    // Box B: [10.2, 20.2] x [0, 10] x [0, 10] -> Gap d_min = 0.2mm
    const docA = createBoxDocument('DOC_BOX_A2', { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    const docB = createBoxDocument('DOC_BOX_B2', { x: 10.2, y: 0, z: 0 }, { x: 20.2, y: 10, z: 10 });

    const rootDoc: EngineeringDocument = {
      documentId: 'DOC_ROOT_CLEARANCE',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [], constraints: [], features: [], parameters: [],
      topologyMap: { version: 1 }, derived: {}, evidence: [],
      assembly: {
        instances: [
          { instanceId: 'InstA', documentId: 'DOC_BOX_A2', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'InstB', documentId: 'DOC_BOX_B2', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ]
      }
    };

    resolver.register(docA);
    resolver.register(docB);
    resolver.register(rootDoc);

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      rootDoc, 'InstA', 'InstB', resolver, 0.5
    );

    expect(result.status).toBe('CLEARANCE_VIOLATION');
    expect(result.minimumDistance).toBeCloseTo(0.2, 3);
    expect(result.clearanceThreshold).toBe(0.5);
  });

  it('Case 3: NO_INTERFERENCE — Gap d_min = 10mm >= required 0.5mm', () => {
    // Box A: [0, 10] x [0, 10] x [0, 10]
    // Box B: [20, 30] x [0, 10] x [0, 10] -> Gap d_min = 10mm
    const docA = createBoxDocument('DOC_BOX_A3', { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
    const docB = createBoxDocument('DOC_BOX_B3', { x: 20, y: 0, z: 0 }, { x: 30, y: 10, z: 10 });

    const rootDoc: EngineeringDocument = {
      documentId: 'DOC_ROOT_NO_INT',
      revision: 1,
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [], constraints: [], features: [], parameters: [],
      topologyMap: { version: 1 }, derived: {}, evidence: [],
      assembly: {
        instances: [
          { instanceId: 'InstA', documentId: 'DOC_BOX_A3', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'InstB', documentId: 'DOC_BOX_B3', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ]
      }
    };

    resolver.register(docA);
    resolver.register(docB);
    resolver.register(rootDoc);

    const result = AssemblyInterferenceAnalyzer.analyzePairwiseInterference(
      rootDoc, 'InstA', 'InstB', resolver, 0.5
    );

    expect(result.status).toBe('NO_INTERFERENCE');
    expect(result.minimumDistance).toBeCloseTo(10.0, 3);
  });
});
