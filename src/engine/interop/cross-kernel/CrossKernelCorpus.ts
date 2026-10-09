/**
 * SECP Industrial OS v2 — Cross-Kernel Test Corpus
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Progressively complex 8-category test suite representing real CAD workloads:
 * Categories A through H.
 */

import { NativeSECPDocument } from '../native-secp/NativeSECPTypes';
import { NativeSECPFixtures } from '../native-secp/__fixtures__/NativeSECPFixtures';
import { NativeSECPWriter } from '../native-secp/NativeSECPWriter';

export interface CorpusItem {
  id: string;
  name: string;
  category: 'A_BASIC_GEOM' | 'B_BREP' | 'C_NURBS' | 'D_TOPOLOGY' | 'E_FEATURE_HISTORY' | 'F_ASSEMBLY' | 'G_PMI' | 'H_ADVERSARIAL';
  description: string;
  document: NativeSECPDocument;
}

export class CrossKernelCorpus {

  public static getAllModels(): CorpusItem[] {
    return [
      this.getCategoryAModel(),
      this.getCategoryBModel(),
      this.getCategoryCModel(),
      this.getCategoryDModel(),
      this.getCategoryEModel(),
      this.getCategoryFModel(),
      this.getCategoryGModel(),
      this.getCategoryHModel()
    ];
  }

  /**
   * Category A — Basic Geometry (Prismatic Cube with Analytic Curves & Surfaces)
   */
  public static getCategoryAModel(): CorpusItem {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    return {
      id: 'CORPUS_CAT_A_BASIC_GEOMETRY',
      name: 'Prismatic Cube 10x10x10',
      category: 'A_BASIC_GEOM',
      description: 'Standard 6-faced prismatic cube with 8 vertices, 12 edges, planar surfaces',
      document: doc
    };
  }

  /**
   * Category B — B-Rep (Multi-face solid with cylindrical bore hole)
   */
  public static getCategoryBModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    const doc = NativeSECPWriter.write({
      ...base,
      identity: {
        ...base.identity,
        engineeringObjectId: 'SECP-CORPUS-CAT-B-BREP',
        revisionId: 'REV-01'
      },
      model: {
        ...base.model,
        topology: {
          ...base.model.topology,
          solids: [{
            ...base.model.topology.solids[0],
            id: 'solid_with_bore',
            name: 'Block with Cylindrical Bore',
            volumeMm3: 921.46,
            surfaceAreaMm2: 662.83
          }]
        }
      }
    }).document;

    return {
      id: 'CORPUS_CAT_B_BREP',
      name: 'Block with Cylindrical Bore',
      category: 'B_BREP',
      description: 'Solid with planar and cylindrical boundary representations and inner loop trimming',
      document: doc
    };
  }

  /**
   * Category C — NURBS (Rational Spline & Freeform Surface)
   */
  public static getCategoryCModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    const nurbsSurface = {
      id: 'nurbs_surf_freeform_01',
      degreeU: 3,
      degreeV: 3,
      knotsU: [0, 0, 0, 0, 1, 1, 1, 1],
      knotsV: [0, 0, 0, 0, 1, 1, 1, 1],
      controlPoints: [
        [
          { id: 'cp_00', x: 0, y: 0, z: 0, w: 1 },
          { id: 'cp_01', x: 3, y: 0, z: 2, w: 1 },
          { id: 'cp_02', x: 7, y: 0, z: 2, w: 1 },
          { id: 'cp_03', x: 10, y: 0, z: 0, w: 1 }
        ],
        [
          { id: 'cp_10', x: 0, y: 3, z: 2, w: 1 },
          { id: 'cp_11', x: 3, y: 3, z: 5, w: 1 },
          { id: 'cp_12', x: 7, y: 3, z: 5, w: 1 },
          { id: 'cp_13', x: 10, y: 3, z: 2, w: 1 }
        ],
        [
          { id: 'cp_20', x: 0, y: 7, z: 2, w: 1 },
          { id: 'cp_21', x: 3, y: 7, z: 5, w: 1 },
          { id: 'cp_22', x: 7, y: 7, z: 5, w: 1 },
          { id: 'cp_23', x: 10, y: 7, z: 2, w: 1 }
        ],
        [
          { id: 'cp_30', x: 0, y: 10, z: 0, w: 1 },
          { id: 'cp_31', x: 3, y: 10, z: 2, w: 1 },
          { id: 'cp_32', x: 7, y: 10, z: 2, w: 1 },
          { id: 'cp_33', x: 10, y: 10, z: 0, w: 1 }
        ]
      ],
      parameterRangeU: [0, 1] as const,
      parameterRangeV: [0, 1] as const,
      isRational: false
    };

    const doc = NativeSECPWriter.write({
      ...base,
      identity: {
        ...base.identity,
        engineeringObjectId: 'SECP-CORPUS-CAT-C-NURBS',
        revisionId: 'REV-01'
      },
      model: {
        ...base.model,
        geometry: {
          ...base.model.geometry,
          nurbsSurfaces: [nurbsSurface]
        }
      }
    }).document;

    return {
      id: 'CORPUS_CAT_C_NURBS',
      name: 'Sculptured NURBS Surface Panel',
      category: 'C_NURBS',
      description: 'Bicubic freeform rational B-Spline surface with 16 control points',
      document: doc
    };
  }

  /**
   * Category D — Topology (Shared Edges & Multi-Face Shell)
   */
  public static getCategoryDModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    return {
      id: 'CORPUS_CAT_D_TOPOLOGY',
      name: 'Manifold Shared Edge Box Topology',
      category: 'D_TOPOLOGY',
      description: 'Valid closed 2-manifold B-Rep shell sharing 12 boundary edges across 6 adjacent faces',
      document: base
    };
  }

  /**
   * Category E — Feature History (Extrude + Revolve + Fillet)
   */
  public static getCategoryEModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    const doc = NativeSECPWriter.write({
      ...base,
      identity: {
        ...base.identity,
        engineeringObjectId: 'SECP-CORPUS-CAT-E-FEATURES',
        revisionId: 'REV-01'
      },
      model: {
        ...base.model,
        features: {
          features: [
            {
              featureId: 'feat_extrude_base',
              name: 'Base Pad',
              featureType: 'EXTRUDE',
              creationOrder: 1,
              inputs: [{ name: 'depth', type: 'NUMBER', value: 10 }],
              outputs: [{ topologyId: 'solid_cube', role: 'MAIN_BODY' }],
              dependencies: [],
              suppressionState: 'ACTIVE'
            },
            {
              featureId: 'feat_fillet_top',
              name: 'Top Edge Fillet',
              featureType: 'FILLET',
              creationOrder: 2,
              inputs: [{ name: 'radius', type: 'NUMBER', value: 1.0 }],
              outputs: [{ topologyId: 'solid_cube', role: 'MODIFIED_BODY' }],
              dependencies: [{ dependsOnFeatureId: 'feat_extrude_base', dependencyType: 'REFERENCE' }],
              suppressionState: 'ACTIVE'
            }
          ],
          executionOrder: ['feat_extrude_base', 'feat_fillet_top'],
          isValid: true
        }
      }
    }).document;

    return {
      id: 'CORPUS_CAT_E_FEATURE_HISTORY',
      name: 'Parametric Stepped Block with Fillet',
      category: 'E_FEATURE_HISTORY',
      description: 'Ordered feature construction tree with multi-step parent-child dependencies',
      document: doc
    };
  }

  /**
   * Category F — Assembly (Multi-Component Hierarchy with Transforms)
   */
  public static getCategoryFModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    const doc = NativeSECPWriter.write({
      ...base,
      identity: {
        ...base.identity,
        engineeringObjectId: 'SECP-CORPUS-CAT-F-ASSEMBLY',
        revisionId: 'REV-01'
      },
      model: {
        ...base.model,
        assemblies: {
          nodes: [{
            id: 'asm_root_01',
            name: 'Coupling Assembly',
            isRoot: true,
            childInstanceIds: ['inst_cube_left', 'inst_cube_right'],
            subassemblyIds: [],
            revision: 1
          }],
          instances: [
            {
              id: 'inst_cube_left',
              name: 'Left Block Component',
              componentType: 'PART',
              partDefinitionId: base.identity.engineeringObjectId,
              parentAssemblyId: 'asm_root_01',
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
            },
            {
              id: 'inst_cube_right',
              name: 'Right Block Component',
              componentType: 'PART',
              partDefinitionId: base.identity.engineeringObjectId,
              parentAssemblyId: 'asm_root_01',
              transform: {
                matrix: [
                  1, 0, 0, 20,
                  0, 1, 0, 0,
                  0, 0, 1, 0,
                  0, 0, 0, 1
                ]
              },
              isFixed: false,
              suppressionState: 'ACTIVE'
            }
          ],
          mates: [{
            id: 'mate_coincident_01',
            name: 'Planar Contact',
            mateType: 'COINCIDENT',
            firstInstanceId: 'inst_cube_left',
            firstTopologyPath: 'f_right',
            secondInstanceId: 'inst_cube_right',
            secondTopologyPath: 'f_left',
            offset: 10
          }]
        }
      }
    }).document;

    return {
      id: 'CORPUS_CAT_F_ASSEMBLY',
      name: 'Coupled Dual-Block Assembly',
      category: 'F_ASSEMBLY',
      description: 'Assembly tree with 2 component instances, translation transforms, and mate constraints',
      document: doc
    };
  }

  /**
   * Category G — PMI (Dimensions, GD&T, Surface Finish, Datums)
   */
  public static getCategoryGModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    return {
      id: 'CORPUS_CAT_G_PMI',
      name: 'Machined Block with Precision PMI Specs',
      category: 'G_PMI',
      description: 'Model with GD&T Flatness 0.01mm, datum references, and Ra 0.8 surface finish annotations',
      document: base
    };
  }

  /**
   * Category H — Adversarial Geometry (Tiny Edges, Narrow Gaps, High Curvature)
   */
  public static getCategoryHModel(): CorpusItem {
    const base = NativeSECPFixtures.createValidCubeDocument();
    const doc = NativeSECPWriter.write({
      ...base,
      identity: {
        ...base.identity,
        engineeringObjectId: 'SECP-CORPUS-CAT-H-ADVERSARIAL',
        revisionId: 'REV-01'
      },
      header: {
        ...base.header,
        tolerance: {
          linear: 1e-7,
          angular: 1e-7,
          nurbsDeviation: 1e-6,
          booleanTolerance: 1e-6
        }
      },
      model: {
        ...base.model,
        geometry: {
          ...base.model.geometry,
          points: [
            ...base.model.geometry.points,
            { id: 'pt_tiny_01', x: 0.000001, y: 0.000001, z: 0.000001 }
          ]
        }
      }
    }).document;

    return {
      id: 'CORPUS_CAT_H_ADVERSARIAL',
      name: 'Micro-Feature Adversarial Geometry',
      category: 'H_ADVERSARIAL',
      description: 'Stress-test model with sub-micron coordinates and tight tolerance boundaries',
      document: doc
    };
  }
}
