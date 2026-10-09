/**
 * PATCH-SECP-078: Nonlinear Mechanics & Structural Contact Type Definitions
 * Covers:
 * - Geometric nonlinearity (Large deformation / Green-Lagrange strain / Corotational kinematics)
 * - Material nonlinearity (J2 von Mises plasticity with isotropic hardening & radial return)
 * - Structural contact (Penalty & Augmented Lagrangian node-to-segment / obstacle formulations)
 * - Full Newton-Raphson equilibrium solver telemetry, convergence criteria, and line search
 */

export type ContactStatus = 'OPEN' | 'CONTACT' | 'PENETRATING' | 'INVALID';

export type NonlinearSolverStatus =
  | 'CONVERGED'
  | 'DIVERGENCE_DETECTED'
  | 'STAGNATION_DETECTED'
  | 'SINGULAR_TANGENT_DETECTED'
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'UNPHYSICAL_PLASTICITY_DETECTED'
  | 'UNRESOLVED_PENETRATION_DETECTED'
  | 'INVALID_INPUT';

export interface NonlinearMaterial {
  id: string;
  name: string;
  E: number;                  // Young's modulus (Pa) > 0
  nu: number;                 // Poisson's ratio -1 < nu < 0.5
  rho: number;                // Density (kg/m3) > 0
  yieldStress0: number;       // Initial yield stress sigma_y0 (Pa) > 0
  hardeningModulus: number;   // Plastic hardening modulus H = dsigma_y / d_eps_p >= 0
  ultimateStress?: number;    // Optional ultimate strength (Pa)
}

export interface NonlinearNode {
  id: number;
  x0: number;                 // Initial X coordinate
  y0: number;                 // Initial Y coordinate
  z0: number;                 // Initial Z coordinate
  x?: number;                 // Current deformed X
  y?: number;                 // Current deformed Y
  z?: number;                 // Current deformed Z
}

export interface NonlinearElement {
  id: number;
  type: 'BAR2' | 'BEAM2D_NL' | 'QUAD4_NL' | 'TET4_NL' | 'HEX8_NL';
  nodeIds: number[];
  materialId: string;
  crossSectionArea?: number;  // For 1D elements (m^2)
  thickness?: number;         // For 2D elements (m)
}

export interface NonlinearBC {
  nodeId: number;
  dof: 0 | 1 | 2;             // 0: Ux, 1: Uy, 2: Uz
  prescribedValue: number;
}

export interface NonlinearLoad {
  nodeId: number;
  dof: 0 | 1 | 2;             // 0: Fx, 1: Fy, 2: Fz
  magnitude: number;
}

export interface ContactPair {
  id: string;
  slaveNodeId: number;
  targetY: number;            // Obstacle / plane position in normal direction
  normalDirection: [number, number, number]; // Unit normal outward from obstacle (e.g. [0, 1, 0])
  penaltyStiffness: number;   // Normal penalty stiffness k_N (N/m)
  frictionCoeff?: number;     // Coulomb friction coefficient mu (default 0)
  augmentedMultiplier?: number; // Augmented Lagrangian multiplier lambda_N
}

export interface PlasticStateRecord {
  elementId: number;
  integrationPointId: number;
  equivalentPlasticStrain: number; // eps_p >= 0
  yieldStress: number;             // current sigma_y(eps_p)
  yieldFunctionValue: number;      // f = sigma_eq - sigma_y <= 0
  isYielded: boolean;
  stressTensor: number[];          // [sigma_xx, sigma_yy, sigma_zz, tau_xy, tau_yz, tau_zx] or [sigma]
  plasticStrainTensor: number[];
}

export interface ContactStateRecord {
  pairId: string;
  slaveNodeId: number;
  gap: number;                     // Normal gap g_N (positive = open, negative = penetration)
  penetration: number;             // max(0, -gap)
  normalForce: number;             // Contact normal compressive force (N) >= 0
  status: ContactStatus;
  augmentedMultiplier: number;
}

export interface NewtonIterationRecord {
  iteration: number;
  step: number;
  loadFactor: number;
  residualNorm: number;
  relativeResidual: number;
  displacementIncrementNorm: number;
  energyIncrement: number;
  lineSearchStepLength: number;
  tangentConditionNumber: number;
  plasticIntegrationPoints: number;
  activeContactPoints: number;
}

export interface NonlinearStepResult {
  step: number;
  loadFactor: number;
  converged: boolean;
  iterationsTaken: number;
  displacements: number[];         // Global displacement vector u
  internalForces: number[];        // F_int
  externalForces: number[];        // F_ext
  contactForces: number[];         // F_contact
  residual: number[];              // R = F_ext - F_int - F_contact
  residualNorm: number;
  strainEnergy: number;            // Elastic strain energy U
  plasticDissipation: number;      // Plastic work W_p
  contactEnergy: number;           // Contact penalty energy
  totalWork: number;               // External work W_ext
  plasticStates: PlasticStateRecord[];
  contactStates: ContactStateRecord[];
  iterationHistory: NewtonIterationRecord[];
}

export interface NonlinearAnalysisResult {
  status: NonlinearSolverStatus;
  isConverged: boolean;
  totalSteps: number;
  totalIterations: number;
  maxResidualNorm: number;
  maxRelativeResidual: number;
  maxPenetration: number;
  finalDisplacements: number[];
  finalPlasticStates: PlasticStateRecord[];
  finalContactStates: ContactStateRecord[];
  steps: NonlinearStepResult[];
  energyConsistent: boolean;
  energyBalanceDiscrepancy: number;
  executionTimeMs: number;
  failureReason?: string;
}
