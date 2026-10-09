import { Matrix } from "../core/MathUtils";
import { J2PlasticityModel } from "./J2PlasticityModel";
import { MaterialPoint, MaterialState } from "./MaterialState";
import { IntegrationEngine } from "../elements/IntegrationEngine";
import { JacobianEngine } from "../elements/JacobianEngine";
import { ShapeFunctions } from "../elements/ShapeFunctions";

export interface ElementNonlinearUpdateResult {
  elementId: string;
  elementType: 'BAR2' | 'QUAD4' | 'HEX8' | 'TET4';
  internalForce: number[];
  tangentStiffness: Matrix;
  gaussPoints: {
    pointIndex: number;
    coordinates: number[];
    weight: number;
    detJ: number;
    strain: number[];
    stress: number[];
    status: string;
    equivalentPlasticStrain: number;
    plasticDissipation: number;
  }[];
  plasticityOccurred: boolean;
}

export class NonlinearElementIntegrator {
  /**
   * Evaluates 1D 2-node Bar element nonlinear internal force and consistent tangent.
   */
  static evaluateBAR2(
    elementId: string,
    nodeCoords: number[][],
    area: number,
    displacements: number[],
    materialModel: J2PlasticityModel,
    materialPoints: MaterialPoint[]
  ): ElementNonlinearUpdateResult {
    const dx = nodeCoords[1][0] - nodeCoords[0][0];
    const dy = (nodeCoords[1][1] ?? 0) - (nodeCoords[0][1] ?? 0);
    const dz = (nodeCoords[1][2] ?? 0) - (nodeCoords[0][2] ?? 0);
    const L = Math.hypot(dx, dy, dz);
    if (L <= 1e-14) throw new Error("BAR2 element length must be strictly positive");

    const nx = dx / L;
    const ny = dy / L;
    const nz = dz / L;

    const is2D = displacements.length === 4;

    let totalStrain = 0.0;
    if (is2D) {
      const u1_axial = displacements[0] * nx + displacements[1] * ny;
      const u2_axial = displacements[2] * nx + displacements[3] * ny;
      totalStrain = (u2_axial - u1_axial) / L;
    } else {
      const u1 = displacements[0];
      const u2 = displacements[1];
      totalStrain = (u2 - u1) / L;
    }

    // Material point 0
    const mp = materialPoints[0];
    const prevCommitted = mp.getCommittedState();
    const dEps = totalStrain - prevCommitted.totalStrain[0];

    const constitutiveResult = materialModel.updateConstitutive([dEps], prevCommitted);

    // Update trial state of material point
    const trialState = new MaterialState({
      stress: constitutiveResult.stress,
      totalStrain: [totalStrain],
      elasticStrain: constitutiveResult.elasticStrain,
      plasticStrain: constitutiveResult.plasticStrain,
      equivalentPlasticStrain: constitutiveResult.equivalentPlasticStrain,
      plasticDissipation: prevCommitted.plasticDissipation + constitutiveResult.plasticDissipationIncrement,
      elasticEnergy: constitutiveResult.elasticEnergy,
      internalVariables: { ...prevCommitted.internalVariables },
      materialStatus: constitutiveResult.materialStatus,
      stepId: prevCommitted.stepId,
      incrementId: prevCommitted.incrementId + 1,
      version: prevCommitted.version
    });
    mp.setTrialState(trialState);

    const sigma = constitutiveResult.stress[0];
    const Et = constitutiveResult.tangent.get(0, 0);

    let f_int: number[];
    let Kt: Matrix;

    if (is2D) {
      // 4x1 internal force vector
      f_int = [-area * sigma * nx, -area * sigma * ny, area * sigma * nx, area * sigma * ny];

      // 4x4 tangent stiffness matrix
      const kFactor = (Et * area) / L;
      Kt = Matrix.zeros(4, 4);

      const n_outer = [
        [nx * nx, nx * ny],
        [ny * nx, ny * ny]
      ];

      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const val = kFactor * n_outer[r][c];
          Kt.set(r, c, val);
          Kt.set(r, c + 2, -val);
          Kt.set(r + 2, c, -val);
          Kt.set(r + 2, c + 2, val);
        }
      }
    } else {
      // 2x1 internal force vector
      f_int = [-area * sigma, area * sigma];

      // 2x2 tangent stiffness matrix
      const kFactor = (Et * area) / L;
      Kt = new Matrix(2, 2, [
        [kFactor, -kFactor],
        [-kFactor, kFactor]
      ]);
    }

    return {
      elementId,
      elementType: 'BAR2',
      internalForce: f_int,
      tangentStiffness: Kt,
      gaussPoints: [{
        pointIndex: 0,
        coordinates: [0.5 * (nodeCoords[0][0] + nodeCoords[1][0])],
        weight: L,
        detJ: L * 0.5,
        strain: [totalStrain],
        stress: [sigma],
        status: constitutiveResult.materialStatus,
        equivalentPlasticStrain: constitutiveResult.equivalentPlasticStrain,
        plasticDissipation: trialState.plasticDissipation
      }],
      plasticityOccurred: constitutiveResult.equivalentPlasticStrain > 0.0
    };
  }

  /**
   * Evaluates 3D 8-node Hexahedral (HEX8) element nonlinear internal force and tangent stiffness (8 Gauss points).
   */
  static evaluateHEX8(
    elementId: string,
    nodeCoords: number[][],
    displacements: number[],
    materialModel: J2PlasticityModel,
    materialPoints: MaterialPoint[]
  ): ElementNonlinearUpdateResult {
    if (nodeCoords.length !== 8) throw new Error("HEX8 requires 8 node coordinates");
    if (displacements.length !== 24) throw new Error("HEX8 requires 24 displacement DOFs");

    const rule = IntegrationEngine.getRule("GAUSS_HEX_2X2X2");
    const f_int = new Array(24).fill(0);
    const Kt = Matrix.zeros(24, 24);

    const gpResults: ElementNonlinearUpdateResult['gaussPoints'] = [];
    let plasticityOccurred = false;

    for (let q = 0; q < rule.points.length; q++) {
      const pt = rule.points[q];
      const xi = pt.xi;
      const eta = pt.eta ?? 0;
      const zeta = pt.zeta ?? 0;

      const sf = ShapeFunctions.hex8(xi, eta, zeta);
      const jac = JacobianEngine.compute3D(sf.dN_dxi, sf.dN_deta!, sf.dN_dzeta!, nodeCoords);
      if (!jac.isValid || jac.det <= 1e-14) {
        throw new Error(`Non-positive Jacobian in HEX8 element ${elementId}`);
      }

      const { dN_dx, dN_dy, dN_dz } = JacobianEngine.computeSpatialDerivatives3D(
        sf.dN_dxi,
        sf.dN_deta!,
        sf.dN_dzeta!,
        jac.inverse
      );

      // Build 6x24 B matrix
      const B = new Matrix(6, 24);
      for (let i = 0; i < 8; i++) {
        const c = i * 3;
        B.set(0, c,     dN_dx[i]);
        B.set(1, c + 1, dN_dy[i]);
        B.set(2, c + 2, dN_dz[i]);
        B.set(3, c + 1, dN_dz[i]);
        B.set(3, c + 2, dN_dy[i]);
        B.set(4, c,     dN_dz[i]);
        B.set(4, c + 2, dN_dx[i]);
        B.set(5, c,     dN_dy[i]);
        B.set(5, c + 1, dN_dx[i]);
      }

      // Strain vector at Gauss point eps_q = B * u_e
      const totalStrain_q = B.multiplyVector(displacements);

      const mp = materialPoints[q];
      const prevCommitted = mp.getCommittedState();
      const dEps = totalStrain_q.map((v, i) => v - prevCommitted.totalStrain[i]);

      const constitutiveResult = materialModel.updateConstitutive(dEps, prevCommitted);

      const trialState = new MaterialState({
        stress: constitutiveResult.stress,
        totalStrain: totalStrain_q,
        elasticStrain: constitutiveResult.elasticStrain,
        plasticStrain: constitutiveResult.plasticStrain,
        equivalentPlasticStrain: constitutiveResult.equivalentPlasticStrain,
        plasticDissipation: prevCommitted.plasticDissipation + constitutiveResult.plasticDissipationIncrement,
        elasticEnergy: constitutiveResult.elasticEnergy,
        internalVariables: { ...prevCommitted.internalVariables },
        materialStatus: constitutiveResult.materialStatus,
        stepId: prevCommitted.stepId,
        incrementId: prevCommitted.incrementId + 1,
        version: prevCommitted.version
      });
      mp.setTrialState(trialState);

      if (constitutiveResult.equivalentPlasticStrain > 0.0) {
        plasticityOccurred = true;
      }

      const dV = jac.det * pt.weight;
      const sigma_q = constitutiveResult.stress;
      const Cep_q = constitutiveResult.tangent;

      // Contribution to internal force: f_int_q = B^T * sigma_q * dV
      const BT = B.transpose();
      const BT_sigma = BT.multiplyVector(sigma_q);
      for (let i = 0; i < 24; i++) {
        f_int[i] += BT_sigma[i] * dV;
      }

      // Contribution to tangent stiffness: K_t_q = B^T * Cep_q * B * dV
      const BT_Cep = BT.multiply(Cep_q);
      const BT_Cep_B = BT_Cep.multiply(B);
      for (let r = 0; r < 24; r++) {
        for (let c = 0; c < 24; c++) {
          Kt.add(r, c, BT_Cep_B.get(r, c) * dV);
        }
      }

      gpResults.push({
        pointIndex: q,
        coordinates: [xi, eta, zeta],
        weight: pt.weight,
        detJ: jac.det,
        strain: totalStrain_q,
        stress: sigma_q,
        status: constitutiveResult.materialStatus,
        equivalentPlasticStrain: constitutiveResult.equivalentPlasticStrain,
        plasticDissipation: trialState.plasticDissipation
      });
    }

    return {
      elementId,
      elementType: 'HEX8',
      internalForce: f_int,
      tangentStiffness: Kt,
      gaussPoints: gpResults,
      plasticityOccurred
    };
  }

  /**
   * Initializes a set of MaterialPoint instances for an element.
   */
  static initializeMaterialPoints(
    elementId: string,
    elementType: 'BAR2' | 'QUAD4' | 'HEX8' | 'TET4',
    dim: number
  ): MaterialPoint[] {
    const count = elementType === 'BAR2' ? 1 : (elementType === 'HEX8' ? 8 : (elementType === 'QUAD4' ? 4 : 1));
    const points: MaterialPoint[] = [];

    for (let i = 0; i < count; i++) {
      const initial = MaterialState.createInitial(dim);
      points.push(new MaterialPoint(elementId, i, [0, 0, 0], 1.0, 1.0, initial));
    }

    return points;
  }
}
