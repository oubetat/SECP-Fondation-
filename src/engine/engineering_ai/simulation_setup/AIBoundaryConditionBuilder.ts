/**
 * SECP Industrial OS - PATCH-310 Boundary Condition & Mesh Setup Assistant
 * Builds structured Structural FEM, CFD, and Thermal boundary conditions, loads, coordinate systems,
 * and mesh refinement configurations.
 */

import {
  AppliedLoad,
  BoundaryCondition,
  GeometryEntityRef,
  MeshConfiguration,
  SolverParameters,
} from './AISimulationSetupTypes310';

export class AIBoundaryConditionBuilder {
  /**
   * Constructs a fixed support boundary condition on a valid target face.
   */
  public createFixedSupport(
    name: string,
    faceRef: GeometryEntityRef,
    coordSys: string = 'GLOBAL_CS'
  ): BoundaryCondition {
    return {
      bcId: `BC-FIXED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'FIXED_SUPPORT',
      name,
      targetEntity: faceRef,
      coordinateSystem: coordSys,
      parameters: { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 },
    };
  }

  /**
   * Constructs a force load vector with magnitude, unit, direction vector, and coordinate system.
   */
  public createForceLoad(
    name: string,
    faceRef: GeometryEntityRef,
    magnitude: number,
    unit: string = 'N',
    directionVector: [number, number, number] = [0, -1, 0],
    coordSys: string = 'GLOBAL_CS'
  ): AppliedLoad {
    return {
      loadId: `LOAD-FORCE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'FORCE',
      name,
      targetEntity: faceRef,
      magnitude,
      unit,
      directionVector,
      coordinateSystem: coordSys,
    };
  }

  /**
   * Generates a recommended mesh configuration tailored to simulation physics and geometry size.
   */
  public generateMeshConfig(
    globalSizeMm: number = 2.0,
    convergencePlan: 'SINGLE_MESH' | 'COARSE_MEDIUM_FINE_SUITE' = 'COARSE_MEDIUM_FINE_SUITE'
  ): MeshConfiguration {
    return {
      meshId: `MESH-CFG-${Date.now()}`,
      elementType: 'TETRAHEDRAL_HEXA',
      globalSizeMm,
      localRefinementRegion: 'Hole_Edges_Stress_Concentration',
      inflationLayers: 5,
      targetQualityIndex: 0.85,
      meshConvergencePlan: convergencePlan,
    };
  }

  /**
   * Generates solver execution parameters for native SECP FEM/CFD solvers.
   */
  public generateSolverParameters(
    solverName: string = 'SECP_FEM_STRUCTURAL_SOLVER',
    version: string = 'v2.1.4'
  ): SolverParameters {
    return {
      solverId: `SOLVER-PARAM-${Date.now()}`,
      solverName,
      version,
      discretizationOrder: 2, // 2nd-order quadratic elements
      linearSolver: 'SPARSE_DIRECT_CHOLESKY',
      convergenceTolerance: 1e-6,
      maxIterations: 500,
    };
  }
}
