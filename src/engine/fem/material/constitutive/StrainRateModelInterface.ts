export interface IStrainRateModelInterface {
  computeDynamicYieldStress?(staticYieldStress: number, strainRate: number, temperature?: number): number;
}

export abstract class StrainRateModelInterface implements IStrainRateModelInterface {
  abstract computeDynamicYieldStress(staticYieldStress: number, strainRate: number, temperature?: number): number;
}
