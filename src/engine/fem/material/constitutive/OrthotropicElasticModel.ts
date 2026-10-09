/**
 * SECP CAD/CAE Platform - PATCH-233: Orthotropic Elastic Model
 *
 * Implements 3D Orthotropic Linear Elastic constitutive law:
 * - Directional elastic properties: E1, E2, E3, nu12, nu23, nu13, G12, G23, G13
 * - Compliance matrix construction & inversion to Stiffness matrix C
 * - Coordinate transformations: Material CS -> Element CS -> Global CS
 */

import { ConstitutiveResponse, MaterialConstitutiveDefinition, MaterialPointState } from './ConstitutiveTypes';
import { MaterialConstitutiveValidator } from './MaterialConstitutiveValidator';

export class OrthotropicElasticModel {
  public readonly E1: number; public readonly E2: number; public readonly E3: number;
  public readonly nu12: number; public readonly nu23: number; public readonly nu13: number;
  public readonly nu21: number; public readonly nu32: number; public readonly nu31: number;
  public readonly G12: number; public readonly G23: number; public readonly G13: number;

  public readonly Compliance6x6: number[][];
  public readonly Stiffness6x6: number[][];

  constructor(definition: MaterialConstitutiveDefinition) {
    const el = definition.elastic;
    if (!el.E1 || !el.E2 || !el.E3 || el.nu12 === undefined || el.nu23 === undefined || el.nu13 === undefined || !el.G12 || !el.G23 || !el.G13) {
      throw new Error('Orthotropic material requires E1, E2, E3, nu12, nu23, nu13, G12, G23, G13.');
    }

    this.E1 = el.E1; this.E2 = el.E2; this.E3 = el.E3;
    this.nu12 = el.nu12; this.nu23 = el.nu23; this.nu13 = el.nu13;
    this.G12 = el.G12; this.G23 = el.G23; this.G13 = el.G13;

    // Reciprocal Poisson's ratios from symmetry condition nu_ij / Ei = nu_ji / Ej
    this.nu21 = (this.nu12 * this.E2) / this.E1;
    this.nu32 = (this.nu23 * this.E3) / this.E2;
    this.nu31 = (this.nu13 * this.E3) / this.E1;

    // Construct 6x6 Compliance Matrix S in Voigt notation
    this.Compliance6x6 = [
      [1 / this.E1, -this.nu21 / this.E2, -this.nu31 / this.E3, 0, 0, 0],
      [-this.nu12 / this.E1, 1 / this.E2, -this.nu32 / this.E3, 0, 0, 0],
      [-this.nu13 / this.E1, -this.nu23 / this.E2, 1 / this.E3, 0, 0, 0],
      [0, 0, 0, 1 / this.G23, 0, 0],
      [0, 0, 0, 0, 1 / this.G13, 0],
      [0, 0, 0, 0, 0, 1 / this.G12]
    ];

    // Invert Compliance matrix to obtain Stiffness Matrix C
    this.Stiffness6x6 = this.invert6x6(this.Compliance6x6);

    // Validate derived Stiffness Matrix
    const val = MaterialConstitutiveValidator.validateStiffnessMatrix6x6(this.Stiffness6x6);
    if (!val.isValid) {
      throw new Error(`Invalid Orthotropic Stiffness Matrix: ${val.errors.map(e => e.reason).join('; ')}`);
    }
  }

  /**
   * Transforms stiffness matrix from Material Coordinate System (MCS) to Global CS (GCS)
   * using direction cosines rotation matrix Q (3x3).
   */
  public transformStiffnessToGlobal(Q3x3: number[][]): number[][] {
    const T = this.buildVoigtTransformationMatrix(Q3x3);
    const T_inv = this.invert6x6(T);
    const T_inv_T = this.transpose6x6(T_inv);

    // C_global = T_inv * C_material * T_inv_T
    return this.multiply6x6(T_inv, this.multiply6x6(this.Stiffness6x6, T_inv_T));
  }

  /**
   * Updates stress given strain increment
   */
  public updateStress(
    strainIncrement: number[],
    state: MaterialPointState,
    materialOrientation3x3?: number[][]
  ): ConstitutiveResponse {
    let C_eff = this.Stiffness6x6;
    if (materialOrientation3x3) {
      C_eff = this.transformStiffnessToGlobal(materialOrientation3x3);
    }

    const newTotalStrain = state.totalStrain.map((e, i) => e + strainIncrement[i]);
    const newStress: number[] = new Array(6).fill(0);

    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        sum += C_eff[i][j] * newTotalStrain[j];
      }
      newStress[i] = sum;
    }

    let energyDensity = 0;
    for (let i = 0; i < 6; i++) {
      energyDensity += 0.5 * newStress[i] * newTotalStrain[i];
    }

    const updatedState: MaterialPointState = {
      ...state,
      totalStrain: newTotalStrain,
      stress: newStress,
      elasticEnergyDensity: Math.max(0, energyDensity),
      status: 'ELASTIC'
    };

    return {
      stress: newStress,
      tangent: C_eff,
      plasticStrain: [...state.plasticStrain],
      equivalentPlasticStrain: state.equivalentPlasticStrain,
      backStress: [...state.backStress],
      elasticEnergyDensity: Math.max(0, energyDensity),
      plasticDissipationIncrement: 0,
      updatedState,
      converged: true
    };
  }

  /**
   * Builds Bond-Voigt 6x6 transformation matrix T from 3x3 orientation matrix Q
   */
  private buildVoigtTransformationMatrix(Q: number[][]): number[][] {
    const l1 = Q[0][0], m1 = Q[0][1], n1 = Q[0][2];
    const l2 = Q[1][0], m2 = Q[1][1], n2 = Q[1][2];
    const l3 = Q[2][0], m3 = Q[2][1], n3 = Q[2][2];

    return [
      [l1 * l1, m1 * m1, n1 * n1, 2 * m1 * n1, 2 * l1 * n1, 2 * l1 * m1],
      [l2 * l2, m2 * m2, n2 * n2, 2 * m2 * n2, 2 * l2 * n2, 2 * l2 * m2],
      [l3 * l3, m3 * m3, n3 * n3, 2 * m3 * n3, 2 * l3 * n3, 2 * l3 * m3],
      [l2 * l3, m2 * m3, n2 * n3, m2 * n3 + m3 * n2, l2 * n3 + l3 * n2, l2 * m3 + l3 * m2],
      [l1 * l3, m1 * m3, n1 * n3, m1 * n3 + m3 * n1, l1 * n3 + l3 * n1, l1 * m3 + l3 * m1],
      [l1 * l2, m1 * m2, n1 * n2, m1 * n2 + m2 * n1, l1 * n2 + l2 * n1, l1 * m2 + l2 * m1]
    ];
  }

  private invert6x6(A: number[][]): number[][] {
    const n = 6;
    const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      if (Math.abs(M[maxRow][i]) < 1e-18) {
        throw new Error(`Matrix inversion failed: Singular or ill-conditioned 6x6 matrix at row ${i}`);
      }

      const temp = M[i]; M[i] = M[maxRow]; M[maxRow] = temp;
      const pivot = M[i][i];

      for (let j = 0; j < 2 * n; j++) M[i][j] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = M[k][i];
          for (let j = 0; j < 2 * n; j++) M[k][j] -= factor * M[i][j];
        }
      }
    }

    return M.map(row => row.slice(n));
  }

  private multiply6x6(A: number[][], B: number[][]): number[][] {
    const C: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        let sum = 0;
        for (let k = 0; k < 6; k++) sum += A[i][k] * B[k][j];
        C[i][j] = sum;
      }
    }
    return C;
  }

  private transpose6x6(A: number[][]): number[][] {
    const At: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) At[j][i] = A[i][j];
    }
    return At;
  }
}
