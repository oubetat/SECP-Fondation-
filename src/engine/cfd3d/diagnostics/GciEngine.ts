/**
 * SECP Industrial OS v2 — CFD GCI Engine
 * Performs Richardson Extrapolation and calculates Grid Convergence Index (GCI).
 * Based on Roache (1994) / ASME V&V 20-2009.
 * FORENSIC CONTRACT COMPLIANT: Explicit separation of computed, numericallyValid, meshConverged, and validated states.
 */

export interface GciData {
  phi: number[];      // Solution values (Fine [0], Medium [1], Coarse [2])
  h: number[];        // Grid spacing or characteristic length
  r: number[];        // Refinement ratios r21 = h2/h1, r32 = h3/h2
}

export interface GciResult {
  p_order: number;           // Apparent order of accuracy
  phi_extrapolated: number;  // Richardson extrapolated value
  gci_fine: number;         // GCI for the fine grid (%)
  gciFineFraction: number;   // GCI fine grid fraction (0..1)
  gciFinePercent: number;    // GCI fine grid percentage (0..100)
  gci_medium: number;       // GCI for the medium grid (%)
  asymptoticCheck: number;  // Should be close to 1.0
  eps21: number;
  eps32: number;
  monotonicityRatio: number;
}

export interface GridSolutionEvidence {
  meshHash: string;
  solutionStateHash: string;
  geometryHash?: string;
  CL: number;
  CD?: number;
  Cm?: number;
  converged: boolean;
  iterations: number;
  cells: number;
  faces: number;
  characteristicLength: number;
  cpDistribution?: { x: number; cp: number; side: 'upper' | 'lower' }[];
  cfDistribution?: { x: number; cf: number; side: 'upper' | 'lower' }[];
  yPlus?: { min: number; max: number; mean: number };
  continuationCL?: number;
  continuationDelta?: number;
  determinismPassed?: boolean;
}

export interface StrictGciContractData {
  coarse: GridSolutionEvidence;
  medium: GridSolutionEvidence;
  fine: GridSolutionEvidence;
  refinementRatios: {
    r21: number;
    r32: number;
  };
}

export interface StrictGciReport {
  computed: boolean;         // GCI arithmetic was successfully executed
  numericallyValid: boolean; // Inputs are finite, independent, unique, converged, and mathematically admissible
  meshConverged: boolean;    // Solutions demonstrate acceptable monotonic grid convergence
  validated: boolean;       // Complete contract passed (computed && numericallyValid && meshConverged)
  valid: boolean;           // Backward compatibility alias (= validated)
  rejectionReason?: string;
  coarse: {
    meshHash: string;
    solutionStateHash: string;
    CL: number;
    converged: boolean;
    iterations: number;
  };
  medium: {
    meshHash: string;
    solutionStateHash: string;
    CL: number;
    converged: boolean;
    iterations: number;
  };
  fine: {
    meshHash: string;
    solutionStateHash: string;
    CL: number;
    converged: boolean;
    iterations: number;
  };
  refinementRatios: {
    r21: number;
    r32: number;
  };
  observedOrder: number;
  extrapolatedCL: number;
  gciFine: number;
  gciFineFraction: number;
  gciFinePercent: number;
  asymptoticRange: number;
  monotonicityRatio: number;
}

export class GciEngine {
  public static calculate(data: GciData): GciResult {
    const { phi, r } = data;
    const f1 = phi[0]; // Fine
    const f2 = phi[1]; // Medium
    const f3 = phi[2]; // Coarse
    const r21 = r[0];
    const r32 = r[1];

    // 1. Apparent order of accuracy (p)
    const eps32 = f3 - f2;
    const eps21 = f2 - f1;
    const monotonicityRatio = Math.abs(eps32) > 1e-12 ? eps21 / eps32 : 0;

    let p = 2.0;
    if (Math.abs(eps21) > 1e-12 && Math.abs(eps32) > 1e-12) {
      const ratio = Math.abs(eps32 / eps21);
      p = Math.abs(Math.log(ratio) / Math.log(r21));
    }
    if (isNaN(p) || !isFinite(p) || p <= 0) p = 2.0;

    // 2. Extrapolated value
    const denom = Math.pow(r21, p) - 1;
    const phi_ext = Math.abs(denom) > 1e-12 ? f1 + (f1 - f2) / denom : f1;

    // 3. GCI
    const safetyFactor = 1.25; // ASME recommendation for 3+ grids
    const ea21 = Math.abs((f1 - f2) / Math.max(Math.abs(f1), 1e-12));
    const gciFineFraction = Math.abs(denom) > 1e-12 ? (safetyFactor * ea21) / denom : 0;
    const gci_fine = gciFineFraction * 100;
    const gciFinePercent = gci_fine;

    const denom32 = Math.pow(r32, p) - 1;
    const ea32 = Math.abs((f2 - f3) / Math.max(Math.abs(f2), 1e-12));
    const gci_medium = Math.abs(denom32) > 1e-12 ? (safetyFactor * ea32) / denom32 * 100 : 0;

    // 4. Asymptotic check
    const asymptoticCheck = (gci_fine > 1e-12) ? gci_medium / (Math.pow(r21, p) * gci_fine) : 1.0;

    return {
      p_order: p,
      phi_extrapolated: phi_ext,
      gci_fine,
      gciFineFraction,
      gciFinePercent,
      gci_medium,
      asymptoticCheck,
      eps21,
      eps32,
      monotonicityRatio
    };
  }

  public static evaluateStrictContract(data: StrictGciContractData): StrictGciReport {
    const { coarse, medium, fine, refinementRatios } = data;

    const emptyReport = (rejectionReason: string): StrictGciReport => ({
      computed: false,
      numericallyValid: false,
      meshConverged: false,
      validated: false,
      valid: false,
      rejectionReason,
      coarse: { meshHash: coarse.meshHash, solutionStateHash: coarse.solutionStateHash, CL: coarse.CL, converged: coarse.converged, iterations: coarse.iterations },
      medium: { meshHash: medium.meshHash, solutionStateHash: medium.solutionStateHash, CL: medium.CL, converged: medium.converged, iterations: medium.iterations },
      fine: { meshHash: fine.meshHash, solutionStateHash: fine.solutionStateHash, CL: fine.CL, converged: fine.converged, iterations: fine.iterations },
      refinementRatios,
      observedOrder: 0,
      extrapolatedCL: 0,
      gciFine: 0,
      asymptoticRange: 0,
      monotonicityRatio: 0
    });

    // 1. Numerical Validity Checks
    if (!fine.converged || !medium.converged || !coarse.converged) {
      return emptyReport('One or more grid levels failed solver convergence.');
    }

    if (fine.meshHash === medium.meshHash || medium.meshHash === coarse.meshHash || fine.meshHash === coarse.meshHash) {
      return emptyReport('Duplicate mesh hashes detected across multi-grid levels.');
    }

    if (fine.solutionStateHash === medium.solutionStateHash || medium.solutionStateHash === coarse.solutionStateHash) {
      return emptyReport('Duplicate solution state hashes detected across multi-grid levels.');
    }

    if (!isFinite(fine.CL) || !isFinite(medium.CL) || !isFinite(coarse.CL)) {
      return emptyReport('Non-finite CL values detected in grid solution evidence.');
    }

    // 2. Perform GCI Calculations
    const calc = this.calculate({
      phi: [fine.CL, medium.CL, coarse.CL],
      h: [fine.characteristicLength, medium.characteristicLength, coarse.characteristicLength],
      r: [refinementRatios.r21, refinementRatios.r32]
    });

    const computed = true;
    const numericallyValid = true;

    // 3. Mesh Convergence Evaluation (ASME V&V 20 Criteria)
    // Monotonic convergence requires 0 < R < 1, GCI_fine <= 10%, and 0.9 <= asymptoticRange <= 1.1
    const isMonotonic = calc.monotonicityRatio > 0 && calc.monotonicityRatio < 1.0;
    const isGciAcceptable = calc.gci_fine <= 10.0; // 10% fine grid uncertainty threshold
    const isAsymptoticValid = calc.asymptoticCheck >= 0.9 && calc.asymptoticCheck <= 1.1;

    const meshConverged = isMonotonic && isGciAcceptable && isAsymptoticValid;

    let rejectionReason: string | undefined = undefined;
    if (!meshConverged) {
      const reasons: string[] = [];
      if (!isMonotonic) {
        reasons.push(`Non-monotonic mesh convergence (R = ${calc.monotonicityRatio.toFixed(4)} ${calc.monotonicityRatio < 0 ? '[Oscillatory]' : '[Divergent]'})`);
      }
      if (!isGciAcceptable) {
        reasons.push(`Fine grid GCI (${calc.gci_fine.toFixed(2)}%) exceeds 10.0% threshold`);
      }
      if (!isAsymptoticValid) {
        reasons.push(`Asymptotic range ratio (${calc.asymptoticCheck.toFixed(4)}) outside [0.9, 1.1]`);
      }
      rejectionReason = reasons.join('; ');
    }

    const validated = computed && numericallyValid && meshConverged;

    return {
      computed,
      numericallyValid,
      meshConverged,
      validated,
      valid: validated, // Strict fail-closed alias
      rejectionReason,
      coarse: { meshHash: coarse.meshHash, solutionStateHash: coarse.solutionStateHash, CL: coarse.CL, converged: coarse.converged, iterations: coarse.iterations },
      medium: { meshHash: medium.meshHash, solutionStateHash: medium.solutionStateHash, CL: medium.CL, converged: medium.converged, iterations: medium.iterations },
      fine: { meshHash: fine.meshHash, solutionStateHash: fine.solutionStateHash, CL: fine.CL, converged: fine.converged, iterations: fine.iterations },
      refinementRatios,
      observedOrder: calc.p_order,
      extrapolatedCL: calc.phi_extrapolated,
      gciFine: calc.gciFineFraction,
      gciFineFraction: calc.gciFineFraction,
      gciFinePercent: calc.gciFinePercent,
      asymptoticRange: calc.asymptoticCheck,
      monotonicityRatio: calc.monotonicityRatio
    };
  }

  /**
   * Generalized ASME V&V 20-2009 evaluation for arbitrary engineering scalars
   * (e.g. pressure drop, drag coefficient, mass imbalance) avoiding divide-by-zero on symmetric CL=0.
   */
  public static evaluateScalarContract(
    scalarName: string,
    phiFine: number,
    phiMedium: number,
    phiCoarse: number,
    r21: number,
    r32: number,
    convergedFine: boolean,
    convergedMedium: boolean,
    convergedCoarse: boolean
  ): {
    scalarName: string;
    computed: boolean;
    meshConverged: boolean;
    observedOrder: number;
    extrapolatedValue: number;
    gciFinePercent: number;
    monotonicityRatio: number;
    asymptoticRange: number;
    rejectionReason?: string;
  } {
    if (!convergedFine || !convergedMedium || !convergedCoarse) {
      return {
        scalarName,
        computed: false,
        meshConverged: false,
        observedOrder: 0,
        extrapolatedValue: 0,
        gciFinePercent: 0,
        monotonicityRatio: 0,
        asymptoticRange: 0,
        rejectionReason: 'One or more grid levels failed solver convergence.'
      };
    }

    const calc = this.calculate({
      phi: [phiFine, phiMedium, phiCoarse],
      h: [1.0, r21, r21 * r32],
      r: [r21, r32]
    });

    const isMonotonic = calc.monotonicityRatio > 0 && calc.monotonicityRatio < 1.0;
    const isGciAcceptable = calc.gci_fine <= 10.0;
    const isAsymptoticValid = calc.asymptoticCheck >= 0.9 && calc.asymptoticCheck <= 1.1;
    const meshConverged = isMonotonic && isGciAcceptable && isAsymptoticValid;

    let rejectionReason: string | undefined = undefined;
    if (!meshConverged) {
      const reasons: string[] = [];
      if (!isMonotonic) reasons.push(`Non-monotonic mesh convergence (R = ${calc.monotonicityRatio.toFixed(4)})`);
      if (!isGciAcceptable) reasons.push(`Fine grid GCI (${calc.gci_fine.toFixed(2)}%) exceeds 10.0% threshold`);
      if (!isAsymptoticValid) reasons.push(`Asymptotic range ratio (${calc.asymptoticCheck.toFixed(4)}) outside [0.9, 1.1]`);
      rejectionReason = reasons.join('; ');
    }

    return {
      scalarName,
      computed: true,
      meshConverged,
      observedOrder: calc.p_order,
      extrapolatedValue: calc.phi_extrapolated,
      gciFinePercent: calc.gciFinePercent,
      monotonicityRatio: calc.monotonicityRatio,
      asymptoticRange: calc.asymptoticCheck,
      rejectionReason
    };
  }
}

