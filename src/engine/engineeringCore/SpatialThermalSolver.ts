/**
 * SECP Engineering Truth OS — Spatial Thermal Solver
 * Multilayer PCB Heat Transfer, 2D Conductance Network, Conjugate Convective Cooling,
 * Localized Heat Allocation, and Component Junction-Case-Board Hierarchy.
 *
 * Governing Equation:
 * - \nabla \cdot (k_{eff} \nabla T) + q''' = 0 (in-plane)
 * - Boundary: q'' = h * (T_surf - T_inf)
 * - Exact Discrete Matrix: [K_th] {T} = {Q_eff}
 */

import {
  PcbThermalBoardConfig,
  PcbStackupLayer,
  ComponentThermalSpec,
  STANDARD_THERMAL_CONDUCTIVITIES
} from './PcbThermalModel';

export interface PcbEffectiveConductivityResult {
  totalThicknessMm: number;
  inPlaneConductivityWMK: number; // k_xy,eff
  throughPlaneConductivityWMK: number; // k_z,eff
  layerContributions: {
    layerId: string;
    thicknessMm: number;
    inPlaneK: number;
    throughPlaneK: number;
  }[];
}

export interface ComponentThermalStatus {
  refDes: string;
  powerWatts: number;
  boardTempC: number;
  caseTempC: number;
  junctionTempC: number;
  maxJunctionTempC: number;
  marginC: number;
  isOverstressed: boolean;
}

export interface ThermalEnergyBalance {
  totalHeatGeneratedWatts: number;
  totalConvectionHeatWatts: number;
  totalPrescribedSinkWatts: number;
  heatImbalanceWatts: number;
  relativeImbalanceRatio: number;
  isConserved: boolean;
}

export interface SpatialThermalFieldResult {
  gridResolutionX: number;
  gridResolutionY: number;
  cellWidthMm: number;
  cellHeightMm: number;
  temperaturesC: number[][]; // [row_j][col_i]
  minTemperatureC: number;
  maxTemperatureC: number;
  avgTemperatureC: number;
  ambientTemperatureC: number;
  effectiveConductivity: PcbEffectiveConductivityResult;
  componentResults: ComponentThermalStatus[];
  energyBalance: ThermalEnergyBalance;
  maxResidualWatts: number;
  canonicalHash: string;
  verdict: 'VERIFIED_WITHIN_DECLARED_SCOPE' | 'NUMERICAL_DIVERGENCE' | 'UNCONSTRAINED_SYSTEM' | 'INVALID_INPUT';
  diagnostics: string[];
}

export class SpatialThermalSolver {
  /**
   * Computes effective in-plane and through-plane anisotropic thermal conductivities
   * based on multilayer stackup properties (copper weight, dielectric layers, coverage).
   */
  public static calculateEffectiveConductivity(layers: PcbStackupLayer[]): PcbEffectiveConductivityResult {
    if (!layers || layers.length === 0) {
      throw new Error('INVALID_STACKUP: At least one PCB layer is required.');
    }

    let totalThicknessMm = 0;
    let weightedInPlaneK = 0;
    let sumSeriesZResistance = 0;

    const layerContributions = layers.map(layer => {
      if (layer.thicknessMm <= 0) {
        throw new Error(`INVALID_LAYER_THICKNESS: Layer ${layer.id} thickness must be positive.`);
      }
      if (layer.thermalConductivityWMK <= 0) {
        throw new Error(`INVALID_CONDUCTIVITY: Layer ${layer.id} conductivity must be positive.`);
      }

      const t = layer.thicknessMm;
      totalThicknessMm += t;

      const coverage = Math.max(0.0, Math.min(1.0, layer.copperCoverageRatio ?? 1.0));
      const kBase = layer.thermalConductivityWMK;
      const kDiel = STANDARD_THERMAL_CONDUCTIVITIES.FR4;

      let inPlaneK: number;
      let throughPlaneK: number;

      if (layer.material === 'COPPER') {
        // Copper layer with signal/plane fill ratio
        inPlaneK = coverage * kBase + (1.0 - coverage) * kDiel;
        // Normal through plane
        throughPlaneK = 1.0 / (coverage / kBase + (1.0 - coverage) / kDiel);
      } else {
        // Dielectric / core / prepreg
        inPlaneK = kBase;
        throughPlaneK = kBase;
      }

      weightedInPlaneK += inPlaneK * t;
      sumSeriesZResistance += t / throughPlaneK;

      return {
        layerId: layer.id,
        thicknessMm: t,
        inPlaneK,
        throughPlaneK
      };
    });

    const inPlaneConductivityWMK = weightedInPlaneK / totalThicknessMm;
    const throughPlaneConductivityWMK = totalThicknessMm / sumSeriesZResistance;

    return {
      totalThicknessMm,
      inPlaneConductivityWMK,
      throughPlaneConductivityWMK,
      layerContributions
    };
  }

  /**
   * Solves steady-state 2D spatial heat distribution for a multilayer PCB.
   */
  public static solve(config: PcbThermalBoardConfig): SpatialThermalFieldResult {
    const diagnostics: string[] = [];

    // Validation
    if (config.boardWidthMm <= 0 || config.boardHeightMm <= 0) {
      return this.buildFailureResult(config, 'INVALID_INPUT', ['Board dimensions must be strictly positive.']);
    }

    if (!config.layers || config.layers.length === 0) {
      return this.buildFailureResult(config, 'INVALID_INPUT', ['No stackup layers provided.']);
    }

    const nx = Math.max(2, Math.min(60, config.gridResolutionX || 20));
    const ny = Math.max(2, Math.min(60, config.gridResolutionY || 20));
    const totalNodes = nx * ny;

    let effectiveCond: PcbEffectiveConductivityResult;
    try {
      effectiveCond = this.calculateEffectiveConductivity(config.layers);
    } catch (err: any) {
      return this.buildFailureResult(config, 'INVALID_INPUT', [err.message]);
    }

    const boardWidthM = config.boardWidthMm / 1000.0;
    const boardHeightM = config.boardHeightMm / 1000.0;
    const boardThickM = effectiveCond.totalThicknessMm / 1000.0;

    const dx = boardWidthM / nx;
    const dy = boardHeightM / ny;
    const cellAreaM2 = dx * dy;

    const kxy = effectiveCond.inPlaneConductivityWMK;

    const ambientT = config.boundaryConditions.ambientTemperatureC;
    const hTop = config.boundaryConditions.convectionCoeffTopWM2K;
    const hBot = config.boundaryConditions.convectionCoeffBottomWM2K;
    const hEdge = config.boundaryConditions.convectionCoeffEdgesWM2K || 0.0;

    const prescribedBCs = config.boundaryConditions.prescribedBoundaries || [];

    // Unconstrained domain check (Pure Neumann with no sink)
    const totalConvectiveH = (hTop + hBot) * (boardWidthM * boardHeightM) + hEdge * 2.0 * (boardWidthM + boardHeightM) * boardThickM;
    if (totalConvectiveH <= 1e-9 && prescribedBCs.length === 0) {
      return this.buildFailureResult(
        config,
        'UNCONSTRAINED_SYSTEM',
        ['System is thermally unconstrained: convection coefficients are zero and no prescribed temperature sink is defined.']
      );
    }

    // Allocate Conductance Matrix K and RHS vector Q
    // K[i][j] where size is totalNodes
    const K: number[][] = Array.from({ length: totalNodes }, () => new Array(totalNodes).fill(0.0));
    const Q: number[] = new Array(totalNodes).fill(0.0);

    // Conduction between neighboring cells
    // Gx = k * (dy * t) / dx
    const Gx = (kxy * (dy * boardThickM)) / dx;
    // Gy = k * (dx * t) / dy
    const Gy = (kxy * (dx * boardThickM)) / dy;

    // Convection per cell top and bottom
    const Gconv_surf = (hTop + hBot) * cellAreaM2;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const m = j * nx + i;
        let diagonalG = 0.0;

        // X neighbor left (i - 1)
        if (i > 0) {
          const mLeft = j * nx + (i - 1);
          K[m][mLeft] -= Gx;
          diagonalG += Gx;
        } else if (hEdge > 0) {
          const Gedge_x = hEdge * (dy * boardThickM);
          diagonalG += Gedge_x;
          Q[m] += Gedge_x * ambientT;
        }

        // X neighbor right (i + 1)
        if (i < nx - 1) {
          const mRight = j * nx + (i + 1);
          K[m][mRight] -= Gx;
          diagonalG += Gx;
        } else if (hEdge > 0) {
          const Gedge_x = hEdge * (dy * boardThickM);
          diagonalG += Gedge_x;
          Q[m] += Gedge_x * ambientT;
        }

        // Y neighbor bottom (j - 1)
        if (j > 0) {
          const mBot = (j - 1) * nx + i;
          K[m][mBot] -= Gy;
          diagonalG += Gy;
        } else if (hEdge > 0) {
          const Gedge_y = hEdge * (dx * boardThickM);
          diagonalG += Gedge_y;
          Q[m] += Gedge_y * ambientT;
        }

        // Y neighbor top (j + 1)
        if (j < ny - 1) {
          const mTop = (j + 1) * nx + i;
          K[m][mTop] -= Gy;
          diagonalG += Gy;
        } else if (hEdge > 0) {
          const Gedge_y = hEdge * (dx * boardThickM);
          diagonalG += Gedge_y;
          Q[m] += Gedge_y * ambientT;
        }

        // Surface convection
        diagonalG += Gconv_surf;
        Q[m] += Gconv_surf * ambientT;

        K[m][m] += diagonalG;
      }
    }

    // Heat Source Mapping from Components
    let totalHeatGen = 0.0;
    const compCellWeights: Map<string, { node: number; weight: number }[]> = new Map();

    for (const comp of config.components) {
      if (comp.powerDissipationWatts < 0) {
        return this.buildFailureResult(config, 'INVALID_INPUT', [`Component ${comp.refDes} power dissipation cannot be negative.`]);
      }
      totalHeatGen += comp.powerDissipationWatts;

      const halfW = comp.widthMm / 2.0;
      const halfH = comp.heightMm / 2.0;
      const cMinX = comp.xMm - halfW;
      const cMaxX = comp.xMm + halfW;
      const cMinY = comp.yMm - halfH;
      const cMaxY = comp.yMm + halfH;
      const compArea = Math.max(1e-6, comp.widthMm * comp.heightMm);

      const weights: { node: number; weight: number }[] = [];
      let totalOverlapArea = 0.0;

      for (let j = 0; j < ny; j++) {
        const cellMinY = (j * config.boardHeightMm) / ny;
        const cellMaxY = ((j + 1) * config.boardHeightMm) / ny;

        for (let i = 0; i < nx; i++) {
          const cellMinX = (i * config.boardWidthMm) / nx;
          const cellMaxX = ((i + 1) * config.boardWidthMm) / nx;

          const ovX = Math.max(0.0, Math.min(cMaxX, cellMaxX) - Math.max(cMinX, cellMinX));
          const ovY = Math.max(0.0, Math.min(cMaxY, cellMaxY) - Math.max(cMinY, cellMinY));
          const ovArea = ovX * ovY;

          if (ovArea > 0) {
            const m = j * nx + i;
            weights.push({ node: m, weight: ovArea });
            totalOverlapArea += ovArea;
          }
        }
      }

      // If component footprint is smaller than a cell or point source
      if (weights.length === 0 || totalOverlapArea <= 1e-9) {
        const iClamped = Math.max(0, Math.min(nx - 1, Math.floor((comp.xMm / config.boardWidthMm) * nx)));
        const jClamped = Math.max(0, Math.min(ny - 1, Math.floor((comp.yMm / config.boardHeightMm) * ny)));
        const m = jClamped * nx + iClamped;
        weights.push({ node: m, weight: 1.0 });
        totalOverlapArea = 1.0;
      }

      // Normalize weights so sum of weights == 1.0
      const normalizedWeights = weights.map(w => ({
        node: w.node,
        weight: w.weight / totalOverlapArea
      }));
      compCellWeights.set(comp.refDes, normalizedWeights);

      for (const nw of normalizedWeights) {
        Q[nw.node] += comp.powerDissipationWatts * nw.weight;
      }
    }

    // Apply Prescribed Boundary Conditions
    // Dirichlet or Contact Resistance sinks
    const isDirichletNode = new Array(totalNodes).fill(false);
    const dirichletValues = new Array(totalNodes).fill(0.0);
    const sinkConductances: { node: number; G: number; T: number }[] = [];

    for (const p of prescribedBCs) {
      const i = Math.max(0, Math.min(nx - 1, Math.floor((p.xMm / config.boardWidthMm) * nx)));
      const j = Math.max(0, Math.min(ny - 1, Math.floor((p.yMm / config.boardHeightMm) * ny)));
      const m = j * nx + i;

      const rContact = p.contactResistanceCW ?? 0.0;
      if (rContact > 0) {
        const Gsink = 1.0 / rContact;
        K[m][m] += Gsink;
        Q[m] += Gsink * p.temperatureC;
        sinkConductances.push({ node: m, G: Gsink, T: p.temperatureC });
      } else {
        // Ideal Dirichlet
        isDirichletNode[m] = true;
        dirichletValues[m] = p.temperatureC;
      }
    }

    // Modify linear system for ideal Dirichlet nodes
    for (let m = 0; m < totalNodes; m++) {
      if (isDirichletNode[m]) {
        const Tval = dirichletValues[m];
        for (let col = 0; col < totalNodes; col++) {
          K[m][col] = 0.0;
        }
        K[m][m] = 1.0;
        Q[m] = Tval;

        for (let row = 0; row < totalNodes; row++) {
          if (row !== m && !isDirichletNode[row]) {
            Q[row] -= K[row][m] * Tval;
            K[row][m] = 0.0;
          }
        }
      }
    }

    // Solve [K] {T} = {Q} via Gaussian Elimination with Partial Pivoting
    const T_solution = this.solveLinearSystem(K, Q);
    if (!T_solution) {
      return this.buildFailureResult(config, 'NUMERICAL_DIVERGENCE', ['Matrix singular or numerical divergence during Gaussian elimination.']);
    }

    // Form 2D array and compute statistics
    const temperaturesC: number[][] = [];
    let minT = Number.POSITIVE_INFINITY;
    let maxT = Number.NEGATIVE_INFINITY;
    let sumT = 0.0;

    for (let j = 0; j < ny; j++) {
      const row: number[] = [];
      for (let i = 0; i < nx; i++) {
        const m = j * nx + i;
        const temp = T_solution[m];
        row.push(Number(temp.toFixed(4)));
        if (temp < minT) minT = temp;
        if (temp > maxT) maxT = temp;
        sumT += temp;
      }
      temperaturesC.push(row);
    }
    const avgT = sumT / totalNodes;

    // Evaluate Component Temperature Hierarchy
    const componentResults: ComponentThermalStatus[] = [];
    for (const comp of config.components) {
      const nw = compCellWeights.get(comp.refDes) || [];
      let boardTemp = 0.0;
      for (const w of nw) {
        boardTemp += T_solution[w.node] * w.weight;
      }

      const rCS = comp.rThetaCS_CW ?? 0.5; // Default case-to-board/sink 0.5 C/W
      const rJC = comp.rThetaJC_CW ?? 2.0; // Default junction-to-case 2.0 C/W
      const caseTemp = boardTemp + comp.powerDissipationWatts * rCS;
      const junctionTemp = caseTemp + comp.powerDissipationWatts * rJC;

      const maxJunc = comp.maxJunctionTempC ?? 125.0;
      const margin = maxJunc - junctionTemp;
      const isOverstressed = junctionTemp > maxJunc;

      componentResults.push({
        refDes: comp.refDes,
        powerWatts: comp.powerDissipationWatts,
        boardTempC: Number(boardTemp.toFixed(3)),
        caseTempC: Number(caseTemp.toFixed(3)),
        junctionTempC: Number(junctionTemp.toFixed(3)),
        maxJunctionTempC: maxJunc,
        marginC: Number(margin.toFixed(3)),
        isOverstressed
      });
    }

    // Energy Balance Verification
    let totalConvectionHeatWatts = 0.0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const m = j * nx + i;
        const temp = T_solution[m];
        totalConvectionHeatWatts += Gconv_surf * (temp - ambientT);

        if (hEdge > 0) {
          if (i === 0 || i === nx - 1) totalConvectionHeatWatts += hEdge * (dy * boardThickM) * (temp - ambientT);
          if (j === 0 || j === ny - 1) totalConvectionHeatWatts += hEdge * (dx * boardThickM) * (temp - ambientT);
        }
      }
    }

    let totalPrescribedSinkWatts = 0.0;
    for (const s of sinkConductances) {
      totalPrescribedSinkWatts += s.G * (T_solution[s.node] - s.T);
    }

    // Dirichlet fixed node reactions: heat flowing from neighboring active nodes into the sink
    for (let m = 0; m < totalNodes; m++) {
      if (isDirichletNode[m]) {
        const Tfixed = dirichletValues[m];
        const i = m % nx;
        const j = Math.floor(m / nx);
        if (i > 0 && !isDirichletNode[j * nx + (i - 1)]) {
          totalPrescribedSinkWatts += Gx * (T_solution[j * nx + (i - 1)] - Tfixed);
        }
        if (i < nx - 1 && !isDirichletNode[j * nx + (i + 1)]) {
          totalPrescribedSinkWatts += Gx * (T_solution[j * nx + (i + 1)] - Tfixed);
        }
        if (j > 0 && !isDirichletNode[(j - 1) * nx + i]) {
          totalPrescribedSinkWatts += Gy * (T_solution[(j - 1) * nx + i] - Tfixed);
        }
        if (j < ny - 1 && !isDirichletNode[(j + 1) * nx + i]) {
          totalPrescribedSinkWatts += Gy * (T_solution[(j + 1) * nx + i] - Tfixed);
        }
      }
    }

    const heatImbalanceWatts = Math.abs(totalHeatGen - (totalConvectionHeatWatts + totalPrescribedSinkWatts));
    const denom = Math.max(totalHeatGen, 1.0);
    const relativeImbalanceRatio = heatImbalanceWatts / denom;
    const isConserved = relativeImbalanceRatio < 1e-3;

    if (!isConserved) {
      diagnostics.push(`Energy conservation warning: relative imbalance is ${(relativeImbalanceRatio * 100).toFixed(4)}%`);
    }

    // Check maximum residual norm
    let maxResidual = 0.0;
    for (let m = 0; m < totalNodes; m++) {
      if (!isDirichletNode[m]) {
        let rowSum = 0.0;
        for (let col = 0; col < totalNodes; col++) {
          rowSum += K[m][col] * T_solution[col];
        }
        const residual = Math.abs(rowSum - Q[m]);
        if (residual > maxResidual) maxResidual = residual;
      }
    }

    const result: SpatialThermalFieldResult = {
      gridResolutionX: nx,
      gridResolutionY: ny,
      cellWidthMm: config.boardWidthMm / nx,
      cellHeightMm: config.boardHeightMm / ny,
      temperaturesC,
      minTemperatureC: Number(minT.toFixed(3)),
      maxTemperatureC: Number(maxT.toFixed(3)),
      avgTemperatureC: Number(avgT.toFixed(3)),
      ambientTemperatureC: ambientT,
      effectiveConductivity: effectiveCond,
      componentResults,
      energyBalance: {
        totalHeatGeneratedWatts: Number(totalHeatGen.toFixed(5)),
        totalConvectionHeatWatts: Number(totalConvectionHeatWatts.toFixed(5)),
        totalPrescribedSinkWatts: Number(totalPrescribedSinkWatts.toFixed(5)),
        heatImbalanceWatts: Number(heatImbalanceWatts.toFixed(6)),
        relativeImbalanceRatio: Number(relativeImbalanceRatio.toFixed(6)),
        isConserved
      },
      maxResidualWatts: Number(maxResidual.toFixed(8)),
      canonicalHash: '',
      verdict: isConserved ? 'VERIFIED_WITHIN_DECLARED_SCOPE' : 'NUMERICAL_DIVERGENCE',
      diagnostics
    };

    return result;
  }

  /**
   * Gaussian elimination solver with partial pivoting for dense matrix system.
   */
  private static solveLinearSystem(A_orig: number[][], b_orig: number[]): number[] | null {
    const n = b_orig.length;
    const A: number[][] = A_orig.map(row => [...row]);
    const b: number[] = [...b_orig];

    for (let p = 0; p < n; p++) {
      // Find pivot row
      let maxVal = Math.abs(A[p][p]);
      let maxRow = p;
      for (let r = p + 1; r < n; r++) {
        if (Math.abs(A[r][p]) > maxVal) {
          maxVal = Math.abs(A[r][p]);
          maxRow = r;
        }
      }

      if (maxVal < 1e-12) {
        return null; // Singular matrix
      }

      // Swap rows
      if (maxRow !== p) {
        const tempRow = A[p];
        A[p] = A[maxRow];
        A[maxRow] = tempRow;
        const tempB = b[p];
        b[p] = b[maxRow];
        b[maxRow] = tempB;
      }

      // Eliminate below pivot
      const pivot = A[p][p];
      for (let r = p + 1; r < n; r++) {
        const factor = A[r][p] / pivot;
        if (factor !== 0) {
          for (let c = p; c < n; c++) {
            A[r][c] -= factor * A[p][c];
          }
          b[r] -= factor * b[p];
        }
      }
    }

    // Back substitution
    const x: number[] = new Array(n).fill(0.0);
    for (let r = n - 1; r >= 0; r--) {
      let sum = b[r];
      for (let c = r + 1; c < n; c++) {
        sum -= A[r][c] * x[c];
      }
      x[r] = sum / A[r][r];
    }

    return x;
  }

  private static buildFailureResult(
    config: PcbThermalBoardConfig,
    verdict: 'NUMERICAL_DIVERGENCE' | 'UNCONSTRAINED_SYSTEM' | 'INVALID_INPUT',
    diagnostics: string[]
  ): SpatialThermalFieldResult {
    return {
      gridResolutionX: config.gridResolutionX || 0,
      gridResolutionY: config.gridResolutionY || 0,
      cellWidthMm: 0,
      cellHeightMm: 0,
      temperaturesC: [],
      minTemperatureC: 0,
      maxTemperatureC: 0,
      avgTemperatureC: 0,
      ambientTemperatureC: config.boundaryConditions?.ambientTemperatureC || 25,
      effectiveConductivity: {
        totalThicknessMm: 0,
        inPlaneConductivityWMK: 0,
        throughPlaneConductivityWMK: 0,
        layerContributions: []
      },
      componentResults: [],
      energyBalance: {
        totalHeatGeneratedWatts: 0,
        totalConvectionHeatWatts: 0,
        totalPrescribedSinkWatts: 0,
        heatImbalanceWatts: 0,
        relativeImbalanceRatio: 1.0,
        isConserved: false
      },
      maxResidualWatts: 999.0,
      canonicalHash: '',
      verdict,
      diagnostics
    };
  }
}
