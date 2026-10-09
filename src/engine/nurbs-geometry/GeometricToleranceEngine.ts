/**
 * PATCH-SECP-074: Geometric Tolerance Engine
 * Establishes a unified, rigorous tolerance system across the entire SECP platform.
 * Ensures CAD (071), Kinematics (072), FEA (073), and NURBS (074) use consistent definitions of "zero".
 */

export class GeometricToleranceEngine {
  // Model/Spatial Tolerance: Minimum resolvable distance in 3D space (e.g., 1 nanometer)
  public static readonly MODEL_TOLERANCE_METERS = 1e-9; 
  public static readonly MODEL_TOLERANCE_MM = 1e-6;

  // Geometric Tolerance: Threshold for considering two geometric entities (points, curves) coincident
  public static readonly GEOMETRIC_COINCIDENCE_TOLERANCE = 1e-6; // 1 micrometer
  public static readonly GEOMETRIC_TANGENCY_TOLERANCE = 1e-4; // Radians (~0.005 degrees)
  public static readonly GEOMETRIC_CURVATURE_TOLERANCE = 1e-3; // Radians per meter

  // Numerical/Solver Tolerance: Threshold for matrix solvers, iterative Newton-Raphson methods, and root finding
  public static readonly NUMERICAL_SOLVER_TOLERANCE = 1e-12;

  // FEA Tolerance: Threshold for considering a residual norm converged
  public static readonly FEA_CONVERGENCE_TOLERANCE = 1e-8;

  // Mesh Tolerance: Maximum chordal deviation for generating FEA meshes from NURBS surfaces
  public static readonly MESH_CHORDAL_DEVIATION_MAX = 0.01; // mm

  /**
   * Checks if two 3D points are coincident within the established geometric tolerance.
   */
  public static arePointsCoincident(p1: number[], p2: number[]): boolean {
    if (p1.length !== 3 || p2.length !== 3) return false;
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    const dz = p1[2] - p2[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    return distSq <= (this.GEOMETRIC_COINCIDENCE_TOLERANCE * this.GEOMETRIC_COINCIDENCE_TOLERANCE);
  }

  /**
   * Evaluates if a numerical value is effectively zero.
   */
  public static isZero(value: number): boolean {
    return Math.abs(value) <= this.NUMERICAL_SOLVER_TOLERANCE;
  }
}
