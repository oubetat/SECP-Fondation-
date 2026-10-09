/**
 * Domain-specific Failure Injectors for Industrial Chaos Testing
 * SECP Industrial OS v3 - PATCH-184
 */

import { InjectedFault, FailureDomain, ChaosScenario } from './ChaosTypes';

export class DomainInjectors {
  private static generateFaultId(domain: string, idx: number): string {
    return `FAULT-${domain}-${String(idx).padStart(3, '0')}`;
  }

  // 1. CAD / B-Rep Failure Injector
  public static createCADFaults(): InjectedFault[] {
    const types = [
      { name: 'malformed_brep', severity: 'CRITICAL', desc: 'Malformed B-Rep structure with missing shell topology' },
      { name: 'invalid_face_loops', severity: 'HIGH', desc: 'Invalid wire face loops with unclosed vertex sequences' },
      { name: 'broken_edge_adjacency', severity: 'HIGH', desc: 'Broken edge-face adjacency pointers causing topological disconnect' },
      { name: 'non_manifold_topology', severity: 'CRITICAL', desc: 'Non-manifold 3D wireframe vertex sharing across 3 solid bodies' },
      { name: 'self_intersections', severity: 'HIGH', desc: 'Self-intersecting B-Rep surface patches on complex fillet' },
      { name: 'inconsistent_orientations', severity: 'MEDIUM', desc: 'Inconsistent surface normal vector orientations' },
      { name: 'duplicated_vertices', severity: 'LOW', desc: 'Duplicate vertex nodes within 1e-12 geometric tolerance' },
      { name: 'disconnected_edges', severity: 'HIGH', desc: 'Disconnected boundary edges in trimmed surface loop' },
      { name: 'degenerate_faces', severity: 'HIGH', desc: 'Zero-area degenerate face patch with collapsed UV coordinates' },
      { name: 'zero_area_geometry', severity: 'HIGH', desc: 'Zero-area cylindrical face segment' },
      { name: 'invalid_nurbs_parameters', severity: 'CRITICAL', desc: 'Invalid B-Spline knot vector with non-monotonically increasing values' },
      { name: 'corrupted_trims', severity: 'HIGH', desc: 'Corrupted p-curve trimming loop exceeding surface domain bounds' },
      { name: 'tolerance_violations', severity: 'MEDIUM', desc: 'G1 continuity gap exceeding 0.05mm engineering tolerance' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('CAD', idx + 1),
      domain: 'CAD_BREP',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Valid B-Rep model loaded',
      injectedData: { targetEntity: `Face_${idx + 10}`, parameter: t.name, magnitude: 1e-3 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 2. Near-Zero / Degenerate Geometry Injector
  public static createDegenerateGeometryFaults(): InjectedFault[] {
    const types = [
      { name: 'near_zero_edges', severity: 'HIGH', desc: 'Edge length 1e-9 mm near numerical resolution limit' },
      { name: 'near_zero_faces', severity: 'HIGH', desc: 'Surface area 1e-14 mm2 near zero area threshold' },
      { name: 'extremely_thin_solids', severity: 'CRITICAL', desc: 'Solid wall thickness 1e-6 mm causing kernel raycast failure' },
      { name: 'collapsed_dimensions', severity: 'CRITICAL', desc: '3D Bounding box collapsed along Z-axis' },
      { name: 'tiny_gaps', severity: 'HIGH', desc: '0.0001 mm unclosed gap between mating flange faces' },
      { name: 'tiny_overlaps', severity: 'HIGH', desc: '0.0002 mm volumetric overlap between assembled components' },
      { name: 'tangent_only_contacts', severity: 'MEDIUM', desc: 'Point-tangent contact without area interaction' },
      { name: 'coincident_geometry', severity: 'HIGH', desc: 'Coincident plane surfaces with opposite normal vectors' },
      { name: 'extreme_aspect_ratios', severity: 'HIGH', desc: 'Face aspect ratio exceeding 1,000,000:1' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('DEGEN', idx + 1),
      domain: 'DEGENERATE_GEOMETRY',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Precise 3D CAD Assembly',
      injectedData: { lengthScale: 1e-9, aspectLimit: 1e6 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 3. Numerical Instability Injector
  public static createNumericalInstabilityFaults(): InjectedFault[] {
    const types = [
      { name: 'floating_point_perturbation', severity: 'MEDIUM', desc: 'Injected 1 ULP jitter in stiffness matrix coefficients' },
      { name: 'catastrophic_cancellation', severity: 'CRITICAL', desc: 'Subtractions of nearly equal floating point values causing 52-bit mantissa precision loss' },
      { name: 'ill_conditioned_systems', severity: 'CRITICAL', desc: 'Matrix condition number exceeding 1e16 (near singular)' },
      { name: 'tolerance_boundary_cases', severity: 'HIGH', desc: 'Values placed exactly on 1e-8 machine epsilon boundary' },
      { name: 'accumulated_numerical_drift', severity: 'HIGH', desc: 'Drift across 10,000 time steps exceeding energy conservation threshold' },
      { name: 'unstable_iterative_states', severity: 'CRITICAL', desc: 'Oscillatory residual trajectory in Newton-Raphson iteration' },
      { name: 'overflow_underflow_conditions', severity: 'CRITICAL', desc: 'IEEE 754 subnormal underflow in exponential creep strain calculation' },
      { name: 'inconsistent_floating_point_exec', severity: 'HIGH', desc: 'FMA vs non-FMA instruction discrepancy across solver threads' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('NUM', idx + 1),
      domain: 'NUMERICAL_INSTABILITY',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Active Math Matrix Solver',
      injectedData: { conditionNumber: 1e18, perturbMagnitude: 1e-15 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 4. Mesh Failure Injector
  public static createMeshFaults(): InjectedFault[] {
    const types = [
      { name: 'inverted_elements', severity: 'CRITICAL', desc: 'Negative Jacobian matrix determinant in 45 tetrahedral elements' },
      { name: 'zero_volume_elements', severity: 'CRITICAL', desc: 'Collapsed 3D element with 0.000000 mm3 volume' },
      { name: 'highly_skewed_elements', severity: 'HIGH', desc: 'Equiangle skewness value of 0.998 exceeding 0.85 threshold' },
      { name: 'poor_aspect_ratio', severity: 'HIGH', desc: 'Tetrahedral element aspect ratio of 8,500:1' },
      { name: 'disconnected_mesh', severity: 'CRITICAL', desc: 'Orphaned mesh sub-domain disconnected from master domain' },
      { name: 'duplicate_nodes', severity: 'HIGH', desc: 'Coincident nodes without shared degrees of freedom' },
      { name: 'non_manifold_elements', severity: 'HIGH', desc: '3 elements sharing a single 1D edge boundary' },
      { name: 'invalid_boundary_tagging', severity: 'HIGH', desc: 'Inlet velocity BC applied to internal fluid domain nodes' },
      { name: 'mesh_holes', severity: 'CRITICAL', desc: 'Unsealed boundary hole on pressure vessel mesh' },
      { name: 'excessive_refinement_transitions', severity: 'MEDIUM', desc: '10:1 size jump between adjacent hexahedral elements' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('MESH', idx + 1),
      domain: 'MESH',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'FEA/CFD Spatial Discretization',
      injectedData: { JacobianDeterminant: -0.042, Skewness: 0.998 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 5. Material Failure Injector
  public static createMaterialFaults(): InjectedFault[] {
    const types = [
      { name: 'missing_material_properties', severity: 'CRITICAL', desc: 'Poisson ratio parameter undefined in isotropic elasticity model' },
      { name: 'invalid_density', severity: 'CRITICAL', desc: 'Negative mass density value -7850 kg/m3' },
      { name: 'negative_zero_stiffness', severity: 'CRITICAL', desc: 'Youngs Modulus E = 0 MPa causing structural matrix singularity' },
      { name: 'incomplete_temperature_data', severity: 'HIGH', desc: 'Missing thermal expansion coefficients above 400C' },
      { name: 'invalid_plastic_curve', severity: 'HIGH', desc: 'Non-monotonic yield stress vs plastic strain relation' },
      { name: 'inconsistent_units', severity: 'HIGH', desc: 'Density supplied in lb/in3 while stress model expects SI Pascal' },
      { name: 'missing_constitutive_parameters', severity: 'HIGH', desc: 'Missing Johnson-Cook damage parameters for high strain rate' },
      { name: 'corrupted_material_certificate', severity: 'CRITICAL', desc: 'Cryptographic hash mismatch in Titanium Grade 5 mill test report' },
      { name: 'provenance_mismatch', severity: 'HIGH', desc: 'Material UID does not match master materials ontology DB' },
      { name: 'incompatible_material_model', severity: 'HIGH', desc: 'Hyperelastic Mooney-Rivlin model applied to structural steel' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('MAT', idx + 1),
      domain: 'MATERIAL',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Material Constitutive Engine',
      injectedData: { E_modulus: 0, density: -7850, certHash: 'CORRUPTED' },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 6. CFD Failure Injector
  public static createCFDFaults(): InjectedFault[] {
    const types = [
      { name: 'divergent_residuals', severity: 'CRITICAL', desc: 'Continuity residual spiking to 1e+12 after 45 iterations' },
      { name: 'cfl_violation', severity: 'HIGH', desc: 'Courant-Friedrichs-Lewy number CFL = 48.5 exceeding 1.0 explicit limit' },
      { name: 'unstable_timestep', severity: 'HIGH', desc: 'Time step delta_t too large causing high-frequency pressure waves' },
      { name: 'mass_imbalance', severity: 'CRITICAL', desc: 'Net mass imbalance delta_m = 12.4 kg/s in closed flow loop' },
      { name: 'momentum_imbalance', severity: 'HIGH', desc: 'Unbounded momentum vector divergence at outflow boundary' },
      { name: 'energy_imbalance', severity: 'HIGH', desc: 'Spurious heat generation violating 1st Law of Thermodynamics' },
      { name: 'invalid_boundary_conditions', severity: 'CRITICAL', desc: 'Conflicting velocity inlet and fixed pressure inlet on same boundary' },
      { name: 'invalid_turbulence_parameters', severity: 'HIGH', desc: 'Negative turbulent kinetic energy (k < 0) in k-omega SST model' },
      { name: 'pressure_velocity_instability', severity: 'HIGH', desc: 'Odd-even decoupling grid oscillation in collocated grid' },
      { name: 'nan_inf_propagation', severity: 'CRITICAL', desc: 'NaN values generated in Navier-Stokes pressure Poisson solver' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('CFD', idx + 1),
      domain: 'CFD',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Navier-Stokes Solvers',
      injectedData: { CFL: 48.5, continuityResidual: 1e12, NaNCount: 1420 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 7. FEM Failure Injector
  public static createFEMFaults(): InjectedFault[] {
    const types = [
      { name: 'singular_stiffness_matrix', severity: 'CRITICAL', desc: 'Zero diagonal pivot encountered in stiffness matrix solve' },
      { name: 'ill_conditioned_matrix', severity: 'CRITICAL', desc: 'Condition number 4.2e+17 causing total loss of precision' },
      { name: 'rigid_body_modes', severity: 'CRITICAL', desc: 'Unconstrained 6-DOF rigid body translation mode detected' },
      { name: 'excessive_deformation', severity: 'HIGH', desc: 'Nodal strain 450% violating small-strain elasticity assumptions' },
      { name: 'negative_jacobian', severity: 'CRITICAL', desc: 'Element 4108 inverted during large deformation step' },
      { name: 'material_instability', severity: 'HIGH', desc: 'Drucker stability criterion violated in nonlinear plasticity' },
      { name: 'nonlinear_divergence', severity: 'CRITICAL', desc: 'Newton-Raphson line search failed to converge after 100 iterations' },
      { name: 'contact_penetration', severity: 'HIGH', desc: 'Unconstrained slave node penetrating master surface by 4.5 mm' },
      { name: 'invalid_boundary_conditions', severity: 'HIGH', desc: 'Over-constrained nodal degrees of freedom causing artificial stress concentration' },
      { name: 'timestep_instability', severity: 'HIGH', desc: 'Central difference time step exceeding critical wave propagation limit' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('FEM', idx + 1),
      domain: 'FEM',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Structural Mechanics Solver',
      injectedData: { zeroPivots: 6, maxStrain: 4.5, residualNorm: 9.8e8 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 8. GCS / Constraint Failure Injector
  public static createGCSFaults(): InjectedFault[] {
    const types = [
      { name: 'over_constrained_system', severity: 'HIGH', desc: '14 constraints controlling 12 degrees of freedom' },
      { name: 'redundant_constraints', severity: 'MEDIUM', desc: 'Duplicate parallel alignment constraints on same axis' },
      { name: 'contradictory_constraints', severity: 'CRITICAL', desc: 'Coincident constraint + 50mm distance constraint between same entities' },
      { name: 'broken_constraint_references', severity: 'HIGH', desc: 'Dangling reference pointer to deleted cylinder face' },
      { name: 'closed_loop_inconsistency', severity: 'HIGH', desc: 'Kinematic 4-bar linkage loop closure error delta = 12.4mm' },
      { name: 'nonlinear_divergence', severity: 'HIGH', desc: 'Levenberg-Marquardt constraint solver failed to converge' },
      { name: 'invalid_datum', severity: 'CRITICAL', desc: 'Primary datum plane defined relative to non-existent feature' },
      { name: 'impossible_assembly_state', severity: 'CRITICAL', desc: 'Geometric conflict: required bolt distance exceeds housing dimensions' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('GCS', idx + 1),
      domain: 'GCS_CONSTRAINT',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Geometric Constraint Solver',
      injectedData: { constraintCount: 14, dof: 12, conflictSet: ['C12', 'C14'] },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 9. CAM Failure Injector
  public static createCAMFaults(): InjectedFault[] {
    const types = [
      { name: 'tool_collision', severity: 'CRITICAL', desc: 'Carbide endmill shank intersecting workpiece fixture at 5,000 mm/min' },
      { name: 'holder collision', severity: 'CRITICAL', desc: 'HSK-A63 tool holder crashing into rotary A-axis table' },
      { name: 'gouging', severity: 'CRITICAL', desc: 'Tool cutter gouging finished surface by -0.850 mm' },
      { name: 'unreachable_tool_orientation', severity: 'HIGH', desc: 'Requested 5-axis tool orientation vector outside B-axis tilt range (-30 to +110 deg)' },
      { name: 'machine_axis_limit', severity: 'HIGH', desc: 'X-axis stroke move X=1250 mm exceeds maximum travel limit X=1000 mm' },
      { name: 'rotary_singularity', severity: 'CRITICAL', desc: 'Tool orientation aligned with C-axis rotation pole (singular jacobian)' },
      { name: 'invalid_postprocessor_output', severity: 'HIGH', desc: 'Syntax error in generated Heidenhain / Fanuc G-code output' },
      { name: 'unsafe_rapid_move', severity: 'CRITICAL', desc: 'G0 rapid traverse positioning directly through solid workpiece' },
      { name: 'invalid_stock_state', severity: 'HIGH', desc: 'In-process stock model missing material removal history from operation 2' },
      { name: 'broken_toolpath_segment', severity: 'HIGH', desc: 'Discontinuous toolpath arc interpolation causing machine jerk' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('CAM', idx + 1),
      domain: 'CAM',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: '5-Axis CAM Engine',
      injectedData: { collisionVolume: 12.4, gougeDepthMm: 0.85, axisOvertravel: 'X' },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 10. PLM Failure Injector
  public static createPLMFaults(): InjectedFault[] {
    const types = [
      { name: 'inconsistent_revision', severity: 'HIGH', desc: 'Assembly Rev B referencing obsolete Sub-Assembly Rev A.1' },
      { name: 'broken_parent_child_revision', severity: 'CRITICAL', desc: 'Parent component published without child approval' },
      { name: 'invalid_release_state', severity: 'CRITICAL', desc: 'Production release status applied without passing Gate 183' },
      { name: 'conflicting_eco', severity: 'HIGH', desc: 'Two active Engineering Change Orders modifying same dimensional tolerance' },
      { name: 'bom_inconsistency', severity: 'HIGH', desc: 'BOM item count 42 does not match 3D CAD assembly instance count 44' },
      { name: 'missing_approval', severity: 'HIGH', desc: 'Chief Engineer sign-off missing on safety critical structural bracket' },
      { name: 'invalid_digital_signature', severity: 'CRITICAL', desc: 'X.509 release certificate signature failed cryptographic audit' },
      { name: 'stale_configuration', severity: 'HIGH', desc: 'Cached CAD geometry out of sync with PLM database master' },
      { name: 'unauthorized_change', severity: 'CRITICAL', desc: 'Direct parameter override committed without associated ECO ticket' },
      { name: 'corrupted_engineering_metadata', severity: 'HIGH', desc: 'JSON schema validation failure on part classification metadata' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('PLM', idx + 1),
      domain: 'PLM',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'PLM Data OS Governance',
      injectedData: { bomDiff: 2, ecoConflict: ['ECO-104', 'ECO-109'] },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 11. Evidence Failure Injector
  public static createEvidenceFaults(): InjectedFault[] {
    const types = [
      { name: 'corrupted_evidence', severity: 'CRITICAL', desc: 'Single bit flip injected into evidence payload block' },
      { name: 'mismatched_hash', severity: 'CRITICAL', desc: 'Evidence hash does not match computed Merkle root' },
      { name: 'missing_evidence', severity: 'CRITICAL', desc: 'Missing solver residual log in attestation bundle' },
      { name: 'stale_evidence', severity: 'HIGH', desc: 'Attestation timestamp generated 72 hours prior to run completion' },
      { name: 'wrong_runtime_metadata', severity: 'HIGH', desc: 'Claimed AVX-512 runtime environment on ARM64 host' },
      { name: 'incorrect_solver_version', severity: 'HIGH', desc: 'Claimed OpenFOAM v2312 while binary reports v2206' },
      { name: 'modified_result', severity: 'CRITICAL', desc: 'Von Mises peak stress altered from 450 MPa to 250 MPa in summary' },
      { name: 'invalid_signature', severity: 'CRITICAL', desc: 'ED25519 signature verification failure on truth certificate' },
      { name: 'broken_provenance_chain', severity: 'CRITICAL', desc: 'Parent Merkle pointer missing from chain of custody' },
      { name: 'result_evidence_mismatch', severity: 'CRITICAL', desc: 'Result array norm does not match raw output hash in evidence ledger' }
    ];

    return types.map((t, idx) => ({
      faultId: this.generateFaultId('EVI', idx + 1),
      domain: 'EVIDENCE',
      severity: t.severity as any,
      injectionType: t.name,
      precondition: 'Cryptographic Evidence Ledger',
      injectedData: { modifiedField: 'maxStress', original: 450, forged: 250 },
      description: t.desc,
      timestamp: new Date().toISOString()
    }));
  }

  // 12. Cross-Domain Chaos Injector
  public static createCrossDomainFaults(): InjectedFault[] {
    return [
      {
        faultId: 'FAULT-CHAOS-CHAIN-001',
        domain: 'CROSS_DOMAIN',
        severity: 'CRITICAL',
        injectionType: 'chained_multi_domain_corruption',
        precondition: 'End-to-End Simulation Pipeline',
        injectedData: {
          chain: [
            { stage: 'CAD', fault: 'malformed_brep' },
            { stage: 'MESH', fault: 'inverted_elements' },
            { stage: 'SOLVER', fault: 'divergent_residuals' },
            { stage: 'RESULT', fault: 'modified_result' },
            { stage: 'EVIDENCE', fault: 'mismatched_hash' }
          ]
        },
        description: 'Chained Multi-Domain Corruption: Malformed B-Rep -> Inverted Mesh -> Divergent CFD -> Forged Result -> Tampered Hash',
        timestamp: new Date().toISOString()
      }
    ];
  }

  public static getAllDomainFaults(): InjectedFault[] {
    return [
      ...this.createCADFaults(),
      ...this.createDegenerateGeometryFaults(),
      ...this.createNumericalInstabilityFaults(),
      ...this.createMeshFaults(),
      ...this.createMaterialFaults(),
      ...this.createCFDFaults(),
      ...this.createFEMFaults(),
      ...this.createGCSFaults(),
      ...this.createCAMFaults(),
      ...this.createPLMFaults(),
      ...this.createEvidenceFaults(),
      ...this.createCrossDomainFaults()
    ];
  }
}
