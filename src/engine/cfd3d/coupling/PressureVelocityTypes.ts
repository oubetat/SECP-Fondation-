/**
 * SECP Industrial OS v2 — Pressure-Velocity Coupling Types
 * PATCH-054: Pressure-Velocity Coupling
 */

export interface FlowAssumptions {
  readonly constantDensity: boolean;
  readonly incompressible: boolean;
  readonly singlePhase: boolean;
  readonly noCompressibilityCorrection: boolean;
  readonly noTurbulence: boolean;
  readonly noEnergyCoupling: boolean;
  readonly noTransient: boolean;
}

export const CANONICAL_INCOMPRESSIBLE_ASSUMPTIONS: FlowAssumptions = Object.freeze({
  constantDensity: true,
  incompressible: true,
  singlePhase: true,
  noCompressibilityCorrection: true,
  noTurbulence: true,
  noEnergyCoupling: true,
  noTransient: true
});

export type GridArrangement = 'COLLOCATED' | 'STAGGERED';

export interface PressureReferencePolicy {
  readonly type: 'FIXED_CELL' | 'PRESCRIBED_PRESSURE' | 'NONE';
  readonly referenceCellId?: number;
  readonly referencePressure?: number;
}

export interface UnderRelaxationConfig {
  readonly pressureRelaxation: number; // e.g. 0.3
  readonly velocityRelaxation: number; // e.g. 0.7
}

export interface MomentumCoefficients {
  readonly aP: Float64Array; // Central coefficient per cell
  readonly aN: Map<number, number>[]; // Neighbor cell coefficients per cell (cellId -> Map<neighborCellId, coef>)
  readonly sU: Float64Array; // Explicit Source / Convective-diffusive RHS X
  readonly sV: Float64Array; // Explicit Source Y
  readonly sW: Float64Array; // Explicit Source Z
  readonly vol: Float64Array; // Cell volumes
  readonly gradP: Float64Array; // Cell-centered pressure gradient [3 * cellId + 0/1/2]
  readonly provenance: string;
}

export interface MomentumPrediction {
  readonly uStar: Float64Array;
  readonly vStar: Float64Array;
  readonly wStar: Float64Array;
  readonly coefficients: MomentumCoefficients;
  readonly residual: number;
  readonly valid: boolean;
  readonly diagnostics: string[];
}

export interface PressureCorrectionSystem {
  readonly aP: Float64Array;
  readonly aN: Map<number, number>[];
  readonly b: Float64Array; // Mass imbalance source term b_P = sum(m_f*)
  readonly valid: boolean;
  readonly diagnostics: string[];
}

export interface PressureField {
  readonly pressure: Float64Array;
  readonly correction: Float64Array;
  readonly underRelaxation: number;
}

export interface VelocityField {
  readonly u: Float64Array;
  readonly v: Float64Array;
  readonly w: Float64Array;
  readonly uCorrection: Float64Array;
  readonly vCorrection: Float64Array;
  readonly wCorrection: Float64Array;
}

export interface FaceFluxField {
  readonly predictedFlux: Float64Array;
  readonly correctedFlux: Float64Array;
  readonly fluxCorrection: Float64Array;
}

export interface ContinuityResult {
  readonly absoluteResidual: number;
  readonly normalizedResidual: number;
  readonly maxCellImbalance: number;
  readonly totalDomainImbalance: number;
  readonly cellImbalances: Float64Array;
  readonly converged: boolean;
}

export interface GlobalMassBalance {
  readonly inletMassFlow: number;
  readonly outletMassFlow: number;
  readonly netMassImbalance: number;
  readonly relativeImbalance: number;
  readonly balanced: boolean;
}

export interface CouplingIterationState {
  readonly iteration: number;
  readonly pressureResidual: number;
  readonly momentumResidual: number;
  readonly continuityResidual: number;
  readonly globalMassImbalance: number;
  readonly maxVelocityCorrection: number;
  readonly maxPressureCorrection: number;
  readonly underRelaxation: UnderRelaxationConfig;
  readonly solverStatuses: Record<string, string>;
  readonly timestamp: string;
}

export type CouplingVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'NOT_CONVERGED' | 'INVALID';

export interface CouplingState {
  readonly pressure: PressureField;
  readonly velocity: VelocityField;
  readonly faceFlux: FaceFluxField;
  readonly continuity: ContinuityResult;
  readonly massBalance: GlobalMassBalance;
  readonly iteration: number;
  readonly history: CouplingIterationState[];
}
