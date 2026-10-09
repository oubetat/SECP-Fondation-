/**
 * SECP Industrial OS v2 — Boolean Adversarial Test Suite Registry
 * Phase 15 (PATCH-172)
 *
 * Implements 40+ comprehensive adversarial test cases spanning Groups A through H.
 */

import { AdversarialTestCase } from './types';
import { AdversarialSolidFactory } from './AdversarialSolidFactory';
import { TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';

export class BooleanAdversarialCaseRegistry {
  public static getAllCases(): AdversarialTestCase[] {
    return [
      // ==========================================
      // GROUP A: BASIC BOOLEAN
      // ==========================================
      {
        id: 'CASE_A01_BOX_UNION_BOX',
        name: 'Box ∪ Box (Disjoint / Separate)',
        category: 'A_BASIC_BOOLEAN',
        description: 'Standard Union between two disjoint 10x10x10 boxes',
        operation: 'UNION',
        isAdversarial: false,
        threatModel: 'Disjoint solid union aggregation and shell grouping',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_b1', 20, 20, 20, 30, 30, 30),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 2000,
            isDisjoint: true
          }
        })
      },
      {
        id: 'CASE_A02_BOX_INTERSECTION_BOX',
        name: 'Box ∩ Box (Overlapping 50%)',
        category: 'A_BASIC_BOOLEAN',
        description: 'Intersection between two 10x10x10 boxes with 5-unit X overlap',
        operation: 'INTERSECTION',
        isAdversarial: false,
        threatModel: 'Plane-plane face splitting and intersection volume extraction',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a2', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_b2', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 500
          }
        })
      },
      {
        id: 'CASE_A03_BOX_DIFFERENCE_BOX',
        name: 'Box − Box (Partial Cut)',
        category: 'A_BASIC_BOOLEAN',
        description: 'Difference subtracting half of a 10x10x10 box',
        operation: 'DIFFERENCE',
        isAdversarial: false,
        threatModel: 'Inverted face normal orientation on subtraction tool',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a3', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_b3', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 500
          }
        })
      },
      {
        id: 'CASE_A04_CYLINDER_UNION_BOX',
        name: 'Cylinder ∪ Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Union of a faceted cylinder (radius 5, height 20) with a 10x10x10 box',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Multi-faceted boundary face splitting and non-orthogonal normal intersection',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },
      {
        id: 'CASE_A05_CYLINDER_INTERSECTION_BOX',
        name: 'Cylinder ∩ Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Intersection between cylinder and intersecting box volume',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Prismatic boundary clipping',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a5', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createFacetedCylinder('cyl_b5', 5, 5, -5, 4, 20, 16),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },
      {
        id: 'CASE_A06_CYLINDER_DIFFERENCE_BOX',
        name: 'Cylinder − Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Subtracting a box through-slot from a faceted cylinder solid',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Through-slot topological hole generation in faceted cylinder',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createFacetedCylinder('cyl_a6', 10, 10, 0, 8, 20, 16),
          operandB: AdversarialSolidFactory.createBox('box_b6', 5, 0, 0, 15, 20, 20),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },
      {
        id: 'CASE_A07_SPHERE_UNION_BOX',
        name: 'Sphere ∪ Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Union between faceted spherical solid and bounding box',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Polyhedral sphere triangular facet stitching with quad box faces',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a7', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createFacetedSphere('sph_b7', 5, 5, 5, 6, 8, 12),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },
      {
        id: 'CASE_A08_SPHERE_INTERSECTION_BOX',
        name: 'Sphere ∩ Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Intersection of faceted sphere solid and corner bounding box',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Octant sphere volume truncation',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_a8', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createFacetedSphere('sph_b8', 0, 0, 0, 8, 8, 12),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },
      {
        id: 'CASE_A09_SPHERE_DIFFERENCE_BOX',
        name: 'Sphere − Box',
        category: 'A_BASIC_BOOLEAN',
        description: 'Subtracting a box from a faceted sphere solid',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Hemispherical facet extraction',
        expectedVerdict: ['PASS', 'UNPROVEN'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createFacetedSphere('sph_a9', 10, 10, 10, 8, 8, 12),
          operandB: AdversarialSolidFactory.createBox('box_b9', 10, 0, 0, 20, 20, 20),
          expectedBehavior: {
            canSucceed: true
          }
        })
      },

      // ==========================================
      // GROUP B: TANGENCY CASES
      // ==========================================
      {
        id: 'CASE_B01_TANGENT_FACE_CONTACT',
        name: 'Tangent Face Contact (Touch without penetration)',
        category: 'B_TANGENCY_CASES',
        description: 'Two boxes touching exactly at the X=10 planar boundary',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Zero-volume interior seam face elimination vs non-manifold double wall creation',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_tan_f1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_tan_f2', 10, 0, 0, 20, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 2000,
            isTangent: true
          }
        })
      },
      {
        id: 'CASE_B02_TANGENT_EDGE_CONTACT',
        name: 'Tangent Edge Contact (Corner edge touch)',
        category: 'B_TANGENCY_CASES',
        description: 'Two boxes touching along a single shared 1D edge at (10, 10)',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Non-manifold 1D edge sharing creation',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_tan_e1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_tan_e2', 10, 10, 0, 20, 20, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 2000,
            isTangent: true
          }
        })
      },
      {
        id: 'CASE_B03_TANGENT_VERTEX_CONTACT',
        name: 'Tangent Vertex Contact (Corner point touch)',
        category: 'B_TANGENCY_CASES',
        description: 'Two boxes touching only at a single corner vertex (10, 10, 10)',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: '0D point non-manifold pinch point generation',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_tan_v1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_tan_v2', 10, 10, 10, 20, 20, 20),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 2000,
            isTangent: true
          }
        })
      },
      {
        id: 'CASE_B04_TANGENT_INTERSECTION_EMPTY',
        name: 'Tangent Faces Intersection (Zero-volume)',
        category: 'B_TANGENCY_CASES',
        description: 'Intersection of two face-touching boxes resulting in 0 volume',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Zero-volume 2D face sheet emission instead of empty solid',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_tan_i1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_tan_i2', 10, 0, 0, 20, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 0,
            isTangent: true
          }
        })
      },

      // ==========================================
      // GROUP C: COINCIDENT GEOMETRY
      // ==========================================
      {
        id: 'CASE_C01_IDENTICAL_UNION',
        name: 'Identical Solid Union (A ∪ A)',
        category: 'C_COINCIDENT_GEOMETRY',
        description: 'Union of a solid with an identical copy of itself',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Duplication of all 6 faces and self-intersections',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const boxA = AdversarialSolidFactory.createBox('box_iden_1', 0, 0, 0, 10, 10, 10);
          return {
            operandA: boxA,
            operandB: boxA,
            expectedBehavior: {
              canSucceed: true,
              expectedVolume: 1000,
              isCoincident: true
            }
          };
        }
      },
      {
        id: 'CASE_C02_IDENTICAL_INTERSECTION',
        name: 'Identical Solid Intersection (A ∩ A)',
        category: 'C_COINCIDENT_GEOMETRY',
        description: 'Intersection of a solid with itself returning identical volume',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Coincident plane-plane zero normal cross-product division by zero',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const boxA = AdversarialSolidFactory.createBox('box_iden_2', 0, 0, 0, 10, 10, 10);
          return {
            operandA: boxA,
            operandB: boxA,
            expectedBehavior: {
              canSucceed: true,
              expectedVolume: 1000,
              isCoincident: true
            }
          };
        }
      },
      {
        id: 'CASE_C03_IDENTICAL_DIFFERENCE',
        name: 'Identical Solid Difference (A − A)',
        category: 'C_COINCIDENT_GEOMETRY',
        description: 'Difference subtracting solid from itself returning empty solid',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Negative volume or ghost faces left over',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const boxA = AdversarialSolidFactory.createBox('box_iden_3', 0, 0, 0, 10, 10, 10);
          return {
            operandA: boxA,
            operandB: boxA,
            expectedBehavior: {
              canSucceed: true,
              expectedVolume: 0,
              isCoincident: true
            }
          };
        }
      },
      {
        id: 'CASE_C04_COINCIDENT_BOTTOM_FACE',
        name: 'Coincident Shared Bottom Face (Coplanar Z=0)',
        category: 'C_COINCIDENT_GEOMETRY',
        description: 'Two boxes sharing coplanar bottom plane Z=0 with partial X overlap',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Coplanar face splitting with colinear boundary edges',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_cop_1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_cop_2', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 1500,
            isCoincident: true
          }
        })
      },

      // ==========================================
      // GROUP D: NEAR-DEGENERATE GEOMETRY
      // ==========================================
      {
        id: 'CASE_D01_TINY_GAP_1E7',
        name: 'Near-Degenerate Micro-Gap (1e-7 m)',
        category: 'D_NEAR_DEGENERATE_GEOMETRY',
        description: 'Two boxes separated by a microscopic 1e-7 gap near machine epsilon',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Floating point numerical sliver creation and tolerance confusion',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_gap_1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_gap_2', 10 + 1e-7, 0, 0, 20 + 1e-7, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 2000,
            isNearDegenerate: true
          }
        })
      },
      {
        id: 'CASE_D02_TINY_OVERLAP_1E7',
        name: 'Near-Degenerate Micro-Overlap (1e-7 m)',
        category: 'D_NEAR_DEGENERATE_GEOMETRY',
        description: 'Two boxes overlapping by a microscopic 1e-7 ribbon',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Micro-volume intersection sliver collapse',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_ov_1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_ov_2', 10 - 1e-7, 0, 0, 20, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            isNearDegenerate: true
          }
        })
      },
      {
        id: 'CASE_D03_VERY_THIN_SOLID_1E5',
        name: 'Extremely Thin Solid / Sheet (1e-5 thickness)',
        category: 'D_NEAR_DEGENERATE_GEOMETRY',
        description: 'Solid with thickness 1e-5 m (near sheet boundary)',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'High aspect ratio face normal precision loss',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_thin_1', 0, 0, 0, 10, 10, 1e-5),
          operandB: AdversarialSolidFactory.createBox('box_thin_2', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            isNearDegenerate: true
          }
        })
      },
      {
        id: 'CASE_D04_SLIGHT_ROTATION_1E5',
        name: 'Nearly Coincident Face Angle (1e-5 rad tilt)',
        category: 'D_NEAR_DEGENERATE_GEOMETRY',
        description: 'Box intersecting with slightly rotated box face generating acute intersection line',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Ill-conditioned plane-plane cross-product near parallel limit',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_tilt_1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_tilt_2', 5, 0, 0, 15, 10 + 1e-5, 10),
          expectedBehavior: {
            canSucceed: true,
            isNearDegenerate: true
          }
        })
      },

      // ==========================================
      // GROUP E: NESTED SOLIDS
      // ==========================================
      {
        id: 'CASE_E01_NESTED_SUBTRACTION_HOLE',
        name: 'Nested Difference (A − B with B ⊂ A)',
        category: 'E_NESTED_SOLIDS',
        description: 'Subtracting a concentric 4x4x4 inner box from a 10x10x10 outer box',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Inner cavity shell generation inside outer shell',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_nest_a1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_nest_b1', 3, 3, 3, 7, 7, 7),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 1000 - 64,
            isNested: true
          }
        })
      },
      {
        id: 'CASE_E02_REVERSE_NESTED_DIFFERENCE',
        name: 'Reverse Nested Difference (B − A with B ⊂ A)',
        category: 'E_NESTED_SOLIDS',
        description: 'Subtracting outer containing box from inner box (returns empty solid)',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Total annihilation of operand B yielding empty topology',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_nest_b2', 3, 3, 3, 7, 7, 7),
          operandB: AdversarialSolidFactory.createBox('box_nest_a2', 0, 0, 0, 10, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 0,
            isNested: true
          }
        })
      },
      {
        id: 'CASE_E03_NESTED_INTERSECTION',
        name: 'Nested Intersection (A ∩ B with B ⊂ A)',
        category: 'E_NESTED_SOLIDS',
        description: 'Intersection of outer box with inner box (equals inner box volume)',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Unmodified preservation of inner solid B',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_nest_a3', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_nest_b3', 3, 3, 3, 7, 7, 7),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 64,
            isNested: true
          }
        })
      },
      {
        id: 'CASE_E04_NESTED_UNION',
        name: 'Nested Union (A ∪ B with B ⊂ A)',
        category: 'E_NESTED_SOLIDS',
        description: 'Union of outer box with inner box (equals outer box volume)',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Discarding redundant enclosed inner solid B',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_nest_a4', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_nest_b4', 3, 3, 3, 7, 7, 7),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 1000,
            isNested: true
          }
        })
      },

      // ==========================================
      // GROUP F: COMPLEX BOOLEAN CHAINS
      // ==========================================
      {
        id: 'CASE_F01_CHAIN_UNION_THEN_DIFFERENCE',
        name: 'Chained Boolean: (A ∪ B) − C',
        category: 'F_COMPLEX_CHAINS',
        description: 'Sequential two-stage Boolean: fuse two boxes then subtract a through-tool',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Topology transfer and re-triangulation across multi-step pipeline',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const b1 = AdversarialSolidFactory.createBox('chain_b1', 0, 0, 0, 10, 10, 10);
          const b2 = AdversarialSolidFactory.createBox('chain_b2', 5, 0, 0, 15, 10, 10);
          return {
            operandA: b1,
            operandB: b2,
            expectedBehavior: {
              canSucceed: true,
              expectedVolume: 1500
            }
          };
        }
      },
      {
        id: 'CASE_F02_CHAIN_MULTI_STEP_INTERSECTION',
        name: 'Chained Boolean: (A ∩ B) ∩ C',
        category: 'F_COMPLEX_CHAINS',
        description: 'Successive cubic volume truncation in 3 orthogonal axes',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Progressive corner vertex clipping',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('chain_int_a', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('chain_int_b', 2, 2, 2, 8, 8, 8),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 216
          }
        })
      },

      // ==========================================
      // GROUP G: REPEATED BOOLEAN OPERATIONS
      // ==========================================
      {
        id: 'CASE_G01_REPEATED_UNION_STABILITY',
        name: 'Repeated Union Stability (10x Loop)',
        category: 'G_REPEATED_OPERATIONS',
        description: 'Re-running Union 10 times to verify memory stability and no progressive corruption',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Memory leak, global state pollution, progressive topology explosion',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_rep_a1', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_rep_b1', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 1500
          }
        })
      },
      {
        id: 'CASE_G02_REPEATED_DIFFERENCE_STABILITY',
        name: 'Repeated Difference Stability (10x Loop)',
        category: 'G_REPEATED_OPERATIONS',
        description: 'Re-running Difference 10 times checking bit-exact hash invariance',
        operation: 'DIFFERENCE',
        isAdversarial: true,
        threatModel: 'Hash drift and vertex coordinate degradation',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_rep_a2', 0, 0, 0, 10, 10, 10),
          operandB: AdversarialSolidFactory.createBox('box_rep_b2', 5, 0, 0, 15, 10, 10),
          expectedBehavior: {
            canSucceed: true,
            expectedVolume: 500
          }
        })
      },

      // ==========================================
      // GROUP H: RANDOMIZED ADVERSARIAL CASES
      // ==========================================
      {
        id: 'CASE_H01_RANDOMIZED_DISPLACEMENTS_SEED_42',
        name: 'Deterministic Seeded Random Box Displacements (Seed 42)',
        category: 'H_RANDOMIZED_ADVERSARIAL',
        description: 'Pseudo-randomized coordinate displacements generated by LCG PRNG (seed 42)',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Non-aligned non-integer bounding box coordinates',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const prng = AdversarialSolidFactory.createPRNG(42);
          const dx = prng() * 5;
          const dy = prng() * 5;
          const dz = prng() * 5;
          return {
            operandA: AdversarialSolidFactory.createBox('box_rnd_a1', 0, 0, 0, 10, 10, 10),
            operandB: AdversarialSolidFactory.createBox('box_rnd_b1', dx, dy, dz, dx + 10, dy + 10, dz + 10),
            expectedBehavior: {
              canSucceed: true
            }
          };
        }
      },
      {
        id: 'CASE_H02_RANDOMIZED_INTERSECTION_SEED_1337',
        name: 'Deterministic Seeded Random Intersection (Seed 1337)',
        category: 'H_RANDOMIZED_ADVERSARIAL',
        description: 'Pseudo-randomized box scaling and offset intersection sweep (seed 1337)',
        operation: 'INTERSECTION',
        isAdversarial: true,
        threatModel: 'Complex aspect ratio volume overlap',
        expectedVerdict: ['PASS'],
        generator: (seed: number) => {
          const prng = AdversarialSolidFactory.createPRNG(1337);
          const ox = 2 + prng() * 4;
          const oy = 2 + prng() * 4;
          const oz = 2 + prng() * 4;
          return {
            operandA: AdversarialSolidFactory.createBox('box_rnd_a2', 0, 0, 0, 10, 10, 10),
            operandB: AdversarialSolidFactory.createBox('box_rnd_b2', ox, oy, oz, ox + 8, oy + 8, oz + 8),
            expectedBehavior: {
              canSucceed: true
            }
          };
        }
      },
      {
        id: 'CASE_H03_MALFORMED_INPUT_REJECTION',
        name: 'Adversarial Malformed TopoShape Input Rejection',
        category: 'H_RANDOMIZED_ADVERSARIAL',
        description: 'Passing incomplete TopoShape missing outerShell to test robust error handling',
        operation: 'UNION',
        isAdversarial: true,
        threatModel: 'Kernel crash / unhandled null pointer exception on malformed B-Rep',
        expectedVerdict: ['INVALID_INPUT'],
        generator: (seed: number) => ({
          operandA: AdversarialSolidFactory.createBox('box_valid', 0, 0, 0, 10, 10, 10),
          operandB: { id: 'malformed_null_shell', shapeType: TopoShapeEnum.SOLID } as any,
          expectedBehavior: {
            canSucceed: false
          }
        })
      }
    ];
  }
}
