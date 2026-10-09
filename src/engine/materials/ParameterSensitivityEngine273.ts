/**
 * PATCH-273: Parameter Sensitivity Engine
 * Computes parameter sensitivities (finite differences) and ranks parameter influence.
 */

import {
  CADParameter,
  ParameterOptimizationSensitivity,
  ParameterInfluence,
} from './ParameterOptimizationTypes273';
import { AnalysisResultsSummary } from './OptimizationTypes272';

export class ParameterSensitivityEngine273 {
  /**
   * Evaluates finite difference parameter sensitivity around baseline.
   */
  public static calculateSensitivity(
    studyId: string,
    parameters: CADParameter[],
    baselineValues: Record<string, number>,
    evaluatePhysicsFn: (values: Record<string, number>) => AnalysisResultsSummary
  ): ParameterOptimizationSensitivity {
    const basePhysics = evaluatePhysicsFn(baselineValues);
    const influences: ParameterInfluence[] = [];

    for (const param of parameters) {
      if (param.isLocked) {
        influences.push({
          parameterId: param.parameterId,
          parameterName: param.name,
          sensitivityMass: 0,
          sensitivityStress: 0,
          sensitivityDisplacement: 0,
          sensitivityFoS: 0,
          influenceRank: 999,
          isDrivingParameter: false,
        });
        continue;
      }

      const h = Math.max(0.1, (param.maxValue - param.minValue) * 0.05); // 5% step perturbation
      const perturbedValues = { ...baselineValues, [param.parameterId]: baselineValues[param.parameterId] + h };

      const perturbedPhysics = evaluatePhysicsFn(perturbedValues);

      const dMass = (perturbedPhysics.massKg - basePhysics.massKg) / h;
      const dStress = ((perturbedPhysics.maxVonMisesStressPa - basePhysics.maxVonMisesStressPa) / 1e6) / h; // MPa / unit
      const dDisp = (perturbedPhysics.maxDisplacementMm - basePhysics.maxDisplacementMm) / h; // mm / unit
      const dFoS = (perturbedPhysics.safetyFactorFoS - basePhysics.safetyFactorFoS) / h;

      influences.push({
        parameterId: param.parameterId,
        parameterName: param.name,
        sensitivityMass: Math.round(dMass * 1000) / 1000,
        sensitivityStress: Math.round(dStress * 1000) / 1000,
        sensitivityDisplacement: Math.round(dDisp * 1000) / 1000,
        sensitivityFoS: Math.round(dFoS * 1000) / 1000,
        influenceRank: 0,
        isDrivingParameter: false,
      });
    }

    // Sort by absolute influence magnitude (Mass + Stress impact)
    influences.sort(
      (a, b) =>
        Math.abs(b.sensitivityMass) + Math.abs(b.sensitivityStress) - (Math.abs(a.sensitivityMass) + Math.abs(a.sensitivityStress))
    );

    influences.forEach((inf, idx) => {
      inf.influenceRank = idx + 1;
      inf.isDrivingParameter = idx < 3 && !parameters.find((p) => p.parameterId === inf.parameterId)?.isLocked;
    });

    const topDriving = influences.filter((i) => i.isDrivingParameter).map((i) => i.parameterId);

    return {
      studyId,
      influences,
      topDrivingParameters: topDriving,
      evaluationMethod: 'FINITE_DIFFERENCES',
    };
  }
}
