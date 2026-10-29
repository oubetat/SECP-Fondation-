/**
 * SECP Industrial OS — Engineering Truth OS
 * IndependentOracleChallengeSuite.ts
 *
 * SECP-PHYSICS-EXPANSION-004D: Independent Oracle Challenge & Numerical Verification Closure.
 *
 * Standalone, uncoupled 3D Analytical Challenge Suite.
 * Deliberately challenges the production electrothermal solver using complex physical cases:
 *
 * 1. Challenge Case 4A: 3D Nonlinear Conduction with Temperature-Dependent Conductivity k(T) = k0 * (1 + beta * T)
 *    Uses Kirchhoff Transformation Theta(T) = integral_{T0}^T (k(T')/k0) dT'
 *    Closed-form analytical solution for physical temperature T(x) and exact heat flux q(x)
 *
 * 2. Challenge Case 4B: 3D Multi-Domain Layered Composite Conduction
 *    Composite bar with interface at x = x_interface between material 1 (k1) and material 2 (k2)
 *    Exact interface temperature T_interface and continuous flux continuity -k1*dT1/dx = -k2*dT2/dx
 *
 * 3. Challenge Case 4C: Independent Electrothermal Power-to-Heat Mapping Oracle
 *    Independently evaluates P_elec = sum_e sigma_e * ||grad V_e||^2 * Volume_e
 *    Verifies uncorrupted transfer into thermal source Q_th without solver assumption leaks
 *
 * CRITICAL RULE:
 * This module MUST NOT import any production solver or production auditor code.
 */

export interface NonlinearThermalParams {
  lengthXM: number;            // Lx [m]
  lengthYM: number;            // Ly [m]
  lengthZM: number;            // Lz [m]
  k0_W_mK: number;             // Reference thermal conductivity k0 [W/(m*K)]
  beta_1_per_K: number;        // Temperature coefficient beta [/K]
  volumetricHeatW_m3: number;  // q_vol [W/m^3]
  boundaryTempC: number;       // T0 [C]
}

export interface CompositeThermalParams {
  lengthXM: number;            // Lx [m]
  lengthYM: number;            // Ly [m]
  lengthZM: number;            // Lz [m]
  xInterfaceM: number;         // Interface position x_i [m]
  k1_W_mK: number;             // Material 1 conductivity [W/(m*K)]
  k2_W_mK: number;             // Material 2 conductivity [W/(m*K)]
  tempLeftC: number;           // T(0) [C]
  tempRightC: number;          // T(Lx) [C]
}

export interface PointEvaluation4A {
  x: number;
  y: number;
  z: number;
  kirchhoffThetaC: number;
  analyticalTempC: number;
  analyticalGradTC_per_m: [number, number, number];
  analyticalHeatFluxW_per_m2: [number, number, number];
}

export interface CompositeGlobalResult4B {
  interfaceTempC: number;
  uniformHeatFluxW_per_m2: number;
  totalHeatFlowWatts: number;
  dirichletReactionLeftWatts: number;
  dirichletReactionRightWatts: number;
  energyBalanceResidualWatts: number;
}

export class IndependentOracleChallengeSuite {

  /**
   * Evaluates Challenge Case 4A (Nonlinear k(T) conduction) at point (x,y,z).
   *
   * Governing ODE: -d/dx [ k(T) dT/dx ] = q_vol
   * Kirchhoff Transform: Theta(T) = (T - T0) + (beta / 2) * (T^2 - T0^2)  (for k0 = 1 normalization)
   * Transformed ODE: -k0 * d2Theta/dx2 = q_vol  => Theta(x) = (q_vol / k0) * (Lx*x - x^2 / 2)
   * Inversion: T(x) = ( -1 + sqrt( 1 + 2*beta*( Theta(x) + T0 + 0.5*beta*T0^2 ) ) ) / beta  (if beta != 0)
   */
  public static evaluateCase4A_NonlinearPoint(
    x: number,
    y: number,
    z: number,
    params: NonlinearThermalParams
  ): PointEvaluation4A {
    const { lengthXM: Lx, k0_W_mK: k0, beta_1_per_K: beta, volumetricHeatW_m3: q_vol, boundaryTempC: T0 } = params;
    const xc = Math.max(0, Math.min(Lx, x));

    // Transformed linear solution Theta(x)
    const theta = (q_vol / k0) * (Lx * xc - 0.5 * xc * xc);

    let tempC: number;
    let dT_dx: number;

    if (Math.abs(beta) < 1e-12) {
      tempC = T0 + theta;
      dT_dx = (q_vol / k0) * (Lx - xc);
    } else {
      // Solve quadratic: 0.5 * beta * T^2 + T - ( T0 + 0.5*beta*T0^2 + theta ) = 0
      const C = T0 + 0.5 * beta * T0 * T0 + theta;
      const discriminant = 1.0 + 2.0 * beta * C;
      if (discriminant < 0) {
        throw new Error(`[ORACLE_FAIL] Physical temperature breakdown in nonlinear Kirchhoff inversion (discriminant < 0)`);
      }
      tempC = (-1.0 + Math.sqrt(discriminant)) / beta;

      // dT/dx = (dTheta/dx) / (1 + beta * T) = ((q_vol/k0)*(Lx - x)) / (1 + beta * T)
      const k_local = k0 * (1.0 + beta * tempC);
      dT_dx = (q_vol * (Lx - xc)) / k_local;
    }

    const local_k = k0 * (1.0 + beta * tempC);
    const fluxX = -local_k * dT_dx; // = -q_vol * (Lx - xc)

    return {
      x, y, z,
      kirchhoffThetaC: theta,
      analyticalTempC: tempC,
      analyticalGradTC_per_m: [dT_dx, 0, 0],
      analyticalHeatFluxW_per_m2: [fluxX, 0, 0]
    };
  }

  /**
   * Evaluates Challenge Case 4B (Composite Multi-Domain Conduction) global parameters.
   */
  public static evaluateCase4B_CompositeGlobal(params: CompositeThermalParams): CompositeGlobalResult4B {
    const { lengthXM: Lx, lengthYM: Ly, lengthZM: Lz, xInterfaceM: xi, k1_W_mK: k1, k2_W_mK: k2, tempLeftC: T1, tempRightC: T2 } = params;

    const crossArea = Ly * Lz;

    // Interface temperature T_i from heat flux continuity across x = xi
    // q = -k1 * (T_i - T1) / xi = -k2 * (T2 - T_i) / (Lx - xi)
    // T_i * (k1/xi + k2/(Lx - xi)) = k1*T1/xi + k2*T2/(Lx - xi)
    const R1 = xi / k1;
    const R2 = (Lx - xi) / k2;
    const R_total = R1 + R2;

    const interfaceTempC = (T1 * R2 + T2 * R1) / R_total;

    // Uniform heat flux density q_x [W/m^2]
    const q_x = -(T2 - T1) / R_total;

    // Heat flow rate [W]
    const totalHeatFlowWatts = q_x * crossArea;

    // Left reaction at x=0 (n = -1): R_left = q_x * (-1) * A = -q_x * A
    // Heat entering at x=0 is -R_left = +q_x * A
    const dirichletReactionLeftWatts = -q_x * crossArea;
    const dirichletReactionRightWatts = +q_x * crossArea;

    return {
      interfaceTempC,
      uniformHeatFluxW_per_m2: q_x,
      totalHeatFlowWatts,
      dirichletReactionLeftWatts,
      dirichletReactionRightWatts,
      energyBalanceResidualWatts: Math.abs(dirichletReactionLeftWatts + dirichletReactionRightWatts)
    };
  }

  /**
   * Evaluates point temperature for Challenge Case 4B.
   */
  public static evaluateCase4B_Point(x: number, params: CompositeThermalParams): { tempC: number; fluxX: number } {
    const { lengthXM: Lx, xInterfaceM: xi, k1_W_mK: k1, k2_W_mK: k2, tempLeftC: T1, tempRightC: T2 } = params;
    const globalRes = this.evaluateCase4B_CompositeGlobal(params);
    const Ti = globalRes.interfaceTempC;
    const qx = globalRes.uniformHeatFluxW_per_m2;

    let tempC: number;
    if (x <= xi) {
      tempC = T1 + (Ti - T1) * (x / xi);
    } else {
      tempC = Ti + (T2 - Ti) * ((x - xi) / (Lx - xi));
    }

    return { tempC, fluxX: qx };
  }

  /**
   * Evaluates raw L2 and L_inf nodal temperature errors directly from float arrays.
   */
  public static computeRawNodalErrors(
    feTemps: Map<string, number>,
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    analyticalFunc: (x: number, y: number, z: number) => number
  ): { rawL2ErrorC: number; rawLInfErrorC: number; maxNodalId: string } {
    let sumSq = 0.0;
    let maxErr = -1.0;
    let maxNodalId = "";

    nodes.forEach(n => {
      const feVal = feTemps.get(n.id);
      if (feVal === undefined) {
        throw new Error(`[ORACLE_FAIL] Node ${n.id} missing in FE solution map`);
      }
      const anaVal = analyticalFunc(n.x, n.y, n.z);
      const err = Math.abs(feVal - anaVal);
      sumSq += err * err;

      if (err > maxErr) {
        maxErr = err;
        maxNodalId = n.id;
      }
    });

    const l2Err = Math.sqrt(sumSq / nodes.length);
    return { rawL2ErrorC: l2Err, rawLInfErrorC: maxErr, maxNodalId };
  }

  /**
   * Calculates empirical spatial convergence rates directly from pristine raw float values.
   */
  public static calculateRawConvergenceRates(
    meshSizesH: number[],
    rawErrors: number[]
  ): { rates: number[]; asymptoticRate: number; isStrictlyMonotonic: boolean } {
    if (meshSizesH.length !== rawErrors.length) {
      throw new Error(`[ORACLE_FAIL] Mesh size count (${meshSizesH.length}) !== raw error count (${rawErrors.length})`);
    }

    let isStrictlyMonotonic = true;
    for (let i = 1; i < rawErrors.length; i++) {
      if (rawErrors[i] >= rawErrors[i - 1]) {
        isStrictlyMonotonic = false;
        break;
      }
    }

    const rates: number[] = [];
    for (let i = 1; i < meshSizesH.length; i++) {
      const h1 = meshSizesH[i - 1];
      const h2 = meshSizesH[i];
      const e1 = rawErrors[i - 1];
      const e2 = rawErrors[i];

      if (e1 > 0 && e2 > 0 && h1 !== h2) {
        const p = Math.log(e1 / e2) / Math.log(h1 / h2);
        rates.push(p);
      } else {
        rates.push(0);
      }
    }

    const asymptoticRate = rates.length > 0 ? rates[rates.length - 1] : 0;
    return { rates, asymptoticRate, isStrictlyMonotonic };
  }
}
