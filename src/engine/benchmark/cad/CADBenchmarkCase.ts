import { BenchmarkCategory, OracleType } from './types';
import type { CADBenchmarkCase } from './types';

export type { CADBenchmarkCase };

export const CAD_BENCHMARK_CASES: CADBenchmarkCase[] = [
  // 1. GEOMETRY_CREATION
  {
    id: 'BENCH-GEO-001',
    name: 'Solid Box Primitive',
    category: BenchmarkCategory.GEOMETRY_CREATION,
    description: 'Volume, surface area, center of gravity, and face count verification for solid cuboid.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { dxMm: 100, dyMm: 50, dzMm: 25 },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Analytical Cuboid Formula' }
  },
  {
    id: 'BENCH-GEO-002',
    name: 'Solid Cylinder Primitive',
    category: BenchmarkCategory.GEOMETRY_CREATION,
    description: 'Analytical cylinder mass properties and surface area evaluation.',
    isAdversarial: false,
    tolerance: 1e-2,
    input: { radiusMm: 20, heightMm: 80 },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Analytical Cylinder Formula' }
  },
  {
    id: 'BENCH-GEO-003',
    name: 'Solid Sphere Primitive',
    category: BenchmarkCategory.GEOMETRY_CREATION,
    description: 'Analytical sphere volume and surface area verification.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { radiusMm: 15 },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Analytical Sphere Formula' }
  },
  {
    id: 'BENCH-GEO-004',
    name: 'Solid Torus Primitive',
    category: BenchmarkCategory.GEOMETRY_CREATION,
    description: 'Analytical torus genus-1 topology and volume verification.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { majorRadiusMm: 30, minorRadiusMm: 10 },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Analytical Torus Formula' }
  },

  // 2. CURVE_CREATION
  {
    id: 'BENCH-CRV-001',
    name: 'Cubic Bezier Curve Evaluation',
    category: BenchmarkCategory.CURVE_CREATION,
    description: 'Bernstein polynomial evaluation against independent mathematical oracle.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {
      p0: { x: 0, y: 0, z: 0 },
      p1: { x: 10, y: 20, z: 0 },
      p2: { x: 20, y: 20, z: 0 },
      p3: { x: 30, y: 0, z: 0 },
      u: 0.5
    },
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'De Casteljau Algorithm' }
  },

  // 3. NURBS_EVALUATION
  {
    id: 'BENCH-NURBS-001',
    name: 'Rational B-Spline Circular Arc',
    category: BenchmarkCategory.NURBS_EVALUATION,
    description: 'Exact quarter-circle NURBS evaluation against analytical trigonometry.',
    isAdversarial: false,
    tolerance: 1e-5,
    input: {
      controlPoints: [
        { x: 50, y: 0, z: 0, w: 1 },
        { x: 50, y: 50, z: 0, w: Math.SQRT1_2 },
        { x: 0, y: 50, z: 0, w: 1 }
      ],
      knots: [0, 0, 0, 1, 1, 1],
      u: 0.5
    },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Trigonometric Quarter-Circle' }
  },
  {
    id: 'BENCH-NURBS-002',
    name: 'NURBS Adversarial Singular Weights',
    category: BenchmarkCategory.NURBS_EVALUATION,
    description: 'Graceful handling and numerical rejection of near-zero singular weights.',
    isAdversarial: true,
    tolerance: 1e-5,
    input: {
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 1e-12 },
        { x: 10, y: 10, z: 0, w: 0 }
      ],
      knots: [0, 0, 1, 1],
      degree: 1,
      u: 0.5
    },
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'Singularity Guard' }
  },

  // 4. BREP_VALIDATION
  {
    id: 'BENCH-BREP-001',
    name: 'Euler-Poincare Formula Invariance',
    category: BenchmarkCategory.BREP_VALIDATION,
    description: 'Verifies V - E + F = 2 for closed manifold polyhedra.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.TOPOLOGICAL, source: 'Euler-Poincare Theorem' }
  },
  {
    id: 'BENCH-BREP-002',
    name: 'Non-Manifold Edge Detection',
    category: BenchmarkCategory.BREP_VALIDATION,
    description: 'Rejection of non-manifold 3-faces incident on a single shared edge.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.TOPOLOGICAL, source: '2-Manifold Boundary Definition' }
  },

  // 5. BOOLEAN_OPERATIONS
  {
    id: 'BENCH-BOOL-001',
    name: 'Analytical Box-Box Boolean Intersection',
    category: BenchmarkCategory.BOOLEAN_OPERATIONS,
    description: 'Intersection volume verification against analytical overlap formula.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {
      boxA: { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } },
      boxB: { min: { x: 50, y: 0, z: 0 }, max: { x: 150, y: 100, z: 100 } }
    },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'AABB Exact Overlap' }
  },
  {
    id: 'BENCH-BOOL-002',
    name: 'Adversarial Coincident Faces Boolean',
    category: BenchmarkCategory.BOOLEAN_OPERATIONS,
    description: 'Robust handling of perfectly coplanar boundary faces.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'Coplanar Classification' }
  },
  {
    id: 'BENCH-BOOL-003',
    name: 'Adversarial Micro-Overlap Boolean',
    category: BenchmarkCategory.BOOLEAN_OPERATIONS,
    description: 'Robust resolution of 1e-6 mm near-tangent boundary intersections.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'Epsilon Perturbation Theory' }
  },

  // 6. GEOMETRIC_PREDICATES
  {
    id: 'BENCH-PRED-001',
    name: 'Barycentric Point-in-Triangle Predicate',
    category: BenchmarkCategory.GEOMETRIC_PREDICATES,
    description: 'Robust 2D containment test via barycentric coordinates.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {
      p: { x: 10, y: 10 },
      tri: { a: { x: 0, y: 0 }, b: { x: 30, y: 0 }, c: { x: 0, y: 30 } }
    },
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Barycentric Coordinates' }
  },
  {
    id: 'BENCH-PRED-002',
    name: 'Point-to-Plane Signed Distance',
    category: BenchmarkCategory.GEOMETRIC_PREDICATES,
    description: 'Analytical distance calculation from point to 3D plane.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {
      pt: { x: 10, y: 20, z: 30 },
      planePoint: { x: 0, y: 0, z: 0 },
      planeNormal: { x: 0, y: 0, z: 1 }
    },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Hesse Normal Form' }
  },

  // 7. TOPOLOGY_HEALING
  {
    id: 'BENCH-HEAL-001',
    name: 'Micro-Gap Edge Stitching',
    category: BenchmarkCategory.TOPOLOGY_HEALING,
    description: 'Closure of sub-tolerance gaps across adjacent faces.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.TOPOLOGICAL, source: 'Boundary Curve Stitching' }
  },
  {
    id: 'BENCH-HEAL-002',
    name: 'Topological Rollback on Defect',
    category: BenchmarkCategory.TOPOLOGY_HEALING,
    description: 'Graceful transaction rollback when healing cannot be guaranteed.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'ACID Geometry Transaction' }
  },

  // 8. TOLERANCE_VERIFICATION
  {
    id: 'BENCH-TOL-001',
    name: 'Multi-Scale Tolerance Consistency',
    category: BenchmarkCategory.TOLERANCE_VERIFICATION,
    description: 'Ensures spatial predicates remain invariant across 1e-6 to 1e3 scales.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Scale Invariance Axiom' }
  },

  // 9. PARAMETRIC_UPDATE
  {
    id: 'BENCH-PARAM-001',
    name: 'Parametric Dimension Propagation',
    category: BenchmarkCategory.PARAMETRIC_UPDATE,
    description: 'Verification that length scaling propagates strictly linearly to volume.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Linear Homothety' }
  },

  // 10. FEATURE_REGENERATION
  {
    id: 'BENCH-REGEN-001',
    name: 'Feature DAG Cycle Regeneration',
    category: BenchmarkCategory.FEATURE_REGENERATION,
    description: 'Invariance of final solid hash across feature reorder and regeneration cycles.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'DAG Determinism' }
  },

  // 11. GEOMETRIC_CONSTRAINTS
  {
    id: 'BENCH-GCS-001',
    name: '2D Geometric Constraint Solver',
    category: BenchmarkCategory.GEOMETRIC_CONSTRAINTS,
    description: 'Newton-Raphson satisfaction of perpendicularity and length constraints.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Orthogonal Projection' }
  },
  {
    id: 'BENCH-GCS-002',
    name: 'Overconstrained System Detection',
    category: BenchmarkCategory.GEOMETRIC_CONSTRAINTS,
    description: 'Detection of rank deficiency and overconstrained conflict.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Jacobian Rank Deficiency' }
  },

  // 12. ASSEMBLY_MATING
  {
    id: 'BENCH-ASY-001',
    name: 'Kinematic Mating Transformation',
    category: BenchmarkCategory.ASSEMBLY_MATING,
    description: 'Rigid body transform composition matching analytical SE(3) matrix.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {
      point: { x: 10, y: 0, z: 0 },
      translation: { x: 50, y: 0, z: 0 },
      rotationRad: Math.PI / 2
    },
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'SE(3) Rigid Transformation' }
  },

  // 13. CLASH_DETECTION
  {
    id: 'BENCH-CLASH-001',
    name: 'Assembly Interference Clash Detection',
    category: BenchmarkCategory.CLASH_DETECTION,
    description: 'Exact volumetric overlap calculation between intersecting assembly parts.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Analytical Intersection Volume' }
  },

  // 14. MASSIVE_ASSEMBLY
  {
    id: 'BENCH-SCALE-001',
    name: '10,000 Instance Scalability',
    category: BenchmarkCategory.MASSIVE_ASSEMBLY,
    description: 'Linear memory scaling and transform dispatch across 10,000 instances.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { instanceCount: 10000 },
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Instance Allocation Metric' }
  },

  // 15. NUMERICAL_ROBUSTNESS
  {
    id: 'BENCH-NUM-001',
    name: 'High-Aspect-Ratio Slender Beam',
    category: BenchmarkCategory.NUMERICAL_ROBUSTNESS,
    description: 'Volume calculation for 10,000:1 aspect ratio beam avoiding catastrophic cancellation.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.ANALYTICAL, source: 'Direct Analytical Volume' }
  },

  // 16. DEGENERATE_GEOMETRY
  {
    id: 'BENCH-DEG-001',
    name: 'Zero-Dimension Primitive Rejection',
    category: BenchmarkCategory.DEGENERATE_GEOMETRY,
    description: 'Validation kernel rejecting zero-volume collapsed bodies.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: { dxMm: 0, dyMm: 10, dzMm: 10 },
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'Measure Theory Non-Zero Volume' }
  },

  // 17. ADVERSARIAL_CASES
  {
    id: 'BENCH-ADV-001',
    name: 'Self-Intersecting Wire Rejection',
    category: BenchmarkCategory.ADVERSARIAL_CASES,
    description: 'Rejection of figure-8 self-intersecting boundary curves for face creation.',
    isAdversarial: true,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.TOPOLOGICAL, source: 'Jordan Curve Theorem' }
  },

  // 18. BIT_EXACT_DETERMINISM
  {
    id: 'BENCH-DET-001',
    name: 'Multi-Pass Hash Determinism',
    category: BenchmarkCategory.BIT_EXACT_DETERMINISM,
    description: 'Multi-iteration verification that identical geometry yields identical cryptographic hashes.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { iterations: 10 },
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Pure Function Invariance' }
  },

  // 19. REPRODUCIBILITY
  {
    id: 'BENCH-REP-001',
    name: 'Canonical Serialization Round-Trip',
    category: BenchmarkCategory.REPRODUCIBILITY,
    description: 'Zero-loss JSON serialization and deserialization geometry integrity.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: {},
    oracle: { isAvailable: true, type: OracleType.MATHEMATICAL, source: 'Bijective Round-Trip' }
  },

  // 20. PERFORMANCE_REGRESSION
  {
    id: 'BENCH-PERF-001',
    name: 'High-Throughput Primitive Creation',
    category: BenchmarkCategory.PERFORMANCE_REGRESSION,
    description: 'Execution of 500 primitives measuring wall-time and ops/sec.',
    isAdversarial: false,
    tolerance: 1e-6,
    input: { count: 500 },
    oracle: { isAvailable: true, type: OracleType.THEORETICAL, source: 'Throughput Threshold' }
  }
];

