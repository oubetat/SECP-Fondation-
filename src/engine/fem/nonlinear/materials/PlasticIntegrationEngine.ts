import { Matrix } from '../../core/MathUtils';
export class PlasticIntegrationEngine {
  static buildElasticTangent(lambda: number, G: number): Matrix { return new Matrix(6, 6); }
  static integrateJ2(strainVoigt: any, prevState: any, E: any, nu: any, sigY: any, Hiso: any, Hkin: any) {
    return {
      stressVoigt: [0,0,0,0,0,0],
      tangentModulus: new Matrix(6, 6),
      newState: { plasticStrainVoigt: [0,0,0,0,0,0], equivalentPlasticStrain: 0, yieldStatus: 'ELASTIC', energyDensity: 0, plasticDissipation: 0 }
    };
  }
}
