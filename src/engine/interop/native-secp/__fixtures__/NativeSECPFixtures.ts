/**
 * SECP Industrial OS v2 — Native SECP Test Fixtures
 * PATCH-039: Native SECP Engineering File Format
 */

import { NativeSECPDocument, NativeSECPDocumentInput } from '../NativeSECPTypes';
import { NativeSECPWriter } from '../NativeSECPWriter';
import { EngineeringIdentityFactory } from '../../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../../identity/CanonicalEngineeringIdentity';

export class NativeSECPFixtures {

  /**
   * Generates a fully valid standard B-Rep cube Native SECP document.
   */
  public static createValidCubeDocument(): NativeSECPDocument {
    const objectId = 'SECP-PART-CUBE-001';
    const revisionId = 'REV-A';

    const identity = {
      engineeringObjectId: objectId,
      revisionId,
      canonicalIdentity: EngineeringIdentityFactory.createIdentity({ 
        objectType: EngineeringObjectType.GEOMETRY,
        projectId: objectId,
        revisionId,
        createdBy: "system",
        seed: "seed" 
      }, {})
    };

    // 8 points for a 10x10x10 cube
    const points = [
      { id: 'p0', x: 0, y: 0, z: 0 },
      { id: 'p1', x: 10, y: 0, z: 0 },
      { id: 'p2', x: 10, y: 10, z: 0 },
      { id: 'p3', x: 0, y: 10, z: 0 },
      { id: 'p4', x: 0, y: 0, z: 10 },
      { id: 'p5', x: 10, y: 0, z: 10 },
      { id: 'p6', x: 10, y: 10, z: 10 },
      { id: 'p7', x: 0, y: 10, z: 10 }
    ];

    const vertices = points.map(p => ({
      id: `v_${p.id}`,
      pointId: p.id,
      tolerance: 1e-6
    }));

    // 12 edges
    const edgeDefs: [string, string, string][] = [
      ['e0', 'v_p0', 'v_p1'], ['e1', 'v_p1', 'v_p2'], ['e2', 'v_p2', 'v_p3'], ['e3', 'v_p3', 'v_p0'],
      ['e4', 'v_p4', 'v_p5'], ['e5', 'v_p5', 'v_p6'], ['e6', 'v_p6', 'v_p7'], ['e7', 'v_p7', 'v_p4'],
      ['e8', 'v_p0', 'v_p4'], ['e9', 'v_p1', 'v_p5'], ['e10', 'v_p2', 'v_p6'], ['e11', 'v_p3', 'v_p7']
    ];

    const analyticCurves = edgeDefs.map(([id]) => ({
      id: `crv_${id}`,
      type: 'LINE' as const,
      origin: { id: `pt_crv_${id}`, x: 0, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 }
    }));

    const edges = edgeDefs.map(([id, startVertexId, endVertexId]) => ({
      id,
      startVertexId,
      endVertexId,
      curveId: `crv_${id}`,
      parameterRange: [0, 10] as const,
      orientation: 'FORWARD' as const,
      tolerance: 1e-6
    }));

    // 6 loops & 6 faces
    const faceDefs: [string, string[]][] = [
      ['f_bottom', ['e0', 'e1', 'e2', 'e3']],
      ['f_top', ['e4', 'e5', 'e6', 'e7']],
      ['f_front', ['e0', 'e9', 'e4', 'e8']],
      ['f_back', ['e2', 'e10', 'e6', 'e11']],
      ['f_left', ['e3', 'e8', 'e7', 'e11']],
      ['f_right', ['e1', 'e9', 'e5', 'e10']]
    ];

    const analyticSurfaces = faceDefs.map(([fId]) => ({
      id: `surf_${fId}`,
      type: 'PLANE' as const,
      origin: { id: `pt_surf_${fId}`, x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
    }));

    const loops = faceDefs.map(([fId, edgeIds]) => ({
      id: `loop_${fId}`,
      edgeIds,
      isOuter: true
    }));

    const faces = faceDefs.map(([fId]) => ({
      id: fId,
      surfaceId: `surf_${fId}`,
      outerLoopId: `loop_${fId}`,
      innerLoopIds: [],
      orientation: 'FORWARD' as const,
      tolerance: 1e-6
    }));

    const shells = [{
      id: 'shell_cube',
      faceIds: faces.map(f => f.id),
      isClosed: true
    }];

    const solids = [{
      id: 'solid_cube',
      name: 'Standard Cube',
      outerShellId: 'shell_cube',
      voidShellIds: [],
      boundingBox: {
        min: { id: 'bb_min', x: 0, y: 0, z: 0 },
        max: { id: 'bb_max', x: 10, y: 10, z: 10 }
      },
      volumeMm3: 1000,
      surfaceAreaMm2: 600
    }];

    // Features
    const featureNode = {
      featureId: 'feat_extrude_01',
      name: 'Base Extrude',
      featureType: 'EXTRUDE',
      creationOrder: 1,
      inputs: [
        { name: 'depth', type: 'NUMBER' as const, value: 10 },
        { name: 'direction', type: 'VECTOR' as const, value: [0, 0, 1] }
      ],
      outputs: [
        { topologyId: 'solid_cube', role: 'MAIN_BODY' }
      ],
      dependencies: [],
      suppressionState: 'ACTIVE' as const
    };

    // NURBS Surface sample
    const nurbsCurve = {
      id: 'nurbs_crv_01',
      degree: 3,
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      controlPoints: [
        { id: 'cp0', x: 0, y: 0, z: 0, w: 1 },
        { id: 'cp1', x: 3, y: 5, z: 0, w: 1 },
        { id: 'cp2', x: 7, y: 5, z: 0, w: 1 },
        { id: 'cp3', x: 10, y: 0, z: 0, w: 1 }
      ],
      parameterRange: [0, 1] as const,
      isPeriodic: false,
      isRational: false
    };

    const writeResult = NativeSECPWriter.write({
      header: {
        formatId: 'SECP-NATIVE',
        formatVersion: '1.0.0',
        schemaVersion: '1.0.0',
        applicationVersion: 'SECP-INDUSTRIAL-OS-v2.0',
        generator: 'SECP Native Test Suite',
        createdAt: '1970-01-01T00:00:00.000Z',
        modifiedAt: '1970-01-01T00:00:00.000Z',
        units: {
          length: 'MILLIMETRE',
          angle: 'RADIAN',
          mass: 'KILOGRAM',
          time: 'SECOND',
          scaleFactorToMm: 1.0
        },
        coordinateConvention: {
          handedness: 'RIGHT_HANDED',
          upVector: [0, 0, 1],
          forwardVector: [0, 1, 0]
        },
        tolerance: {
          linear: 1e-6,
          angular: 1e-6,
          nurbsDeviation: 1e-5,
          booleanTolerance: 1e-5
        }
      },
      identity,
      model: {
        geometry: {
          points,
          analyticCurves,
          nurbsCurves: [nurbsCurve],
          analyticSurfaces,
          nurbsSurfaces: []
        },
        topology: {
          vertices,
          edges,
          loops,
          faces,
          shells,
          solids
        },
        features: {
          features: [featureNode],
          executionOrder: ['feat_extrude_01'],
          isValid: true
        },
        sketches: [],
        assemblies: {
          nodes: [{
            id: 'asm_root',
            name: 'Root Assembly',
            isRoot: true,
            childInstanceIds: ['inst_cube_01'],
            subassemblyIds: [],
            revision: 1
          }],
          instances: [{
            id: 'inst_cube_01',
            name: 'Cube Instance 1',
            componentType: 'PART',
            partDefinitionId: objectId,
            parentAssemblyId: 'asm_root',
            transform: {
              matrix: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
              ]
            },
            isFixed: true,
            suppressionState: 'ACTIVE'
          }],
          mates: []
        }
      },
      manufacturing: {
        features: [{
          id: 'mfg_feat_01',
          featureType: 'POCKET',
          targetTopologyIds: ['f_top'],
          parameters: { depth: 5, tolerance: 0.05 }
        }],
        toolpaths: [{
          id: 'tp_01',
          operationName: 'Rough Pocket 3D',
          toolId: 'ENDMILL_10MM',
          strategy: 'ADAPTIVE_CLEARING',
          targetFeatureIds: ['mfg_feat_01'],
          toolpathHash: 'abcdef123456'
        }],
        metadata: {
          machiningAllowanceMm: 0.5,
          surfaceFinishRa: 1.6
        }
      },
      provenance: {
        source: 'SECP_PARAMETRIC_DESIGNER',
        operations: [{
          operationId: 'OP_01',
          operationType: 'EXTRUDE_SKETCH',
          timestamp: '1970-01-01T00:00:00.000Z',
          author: 'SECP Engineer',
          identityRef: objectId,
          parameters: { depth: 10 }
        }],
        revisions: [{
          revisionId,
          createdAt: '1970-01-01T00:00:00.000Z',
          author: 'SECP Engineer',
          changeSummary: 'Initial base cube model',
          canonicalHash: ''
        }],
        graphNodes: [],
        graphEdges: []
      },
      integrity: {
        evidenceReferences: ['EVIDENCE_REF_001']
      }
    });

    if (!writeResult.success) {
      throw new Error(`Failed to create valid cube fixture: ${writeResult.diagnostics.map(d => d.message).join('; ')}`);
    }

    return writeResult.document;
  }
}
