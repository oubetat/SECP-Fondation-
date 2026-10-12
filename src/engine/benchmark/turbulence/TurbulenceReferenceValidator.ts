/**
 * PATCH-176: Turbulence Reference Validator Engine
 * 
 * Compares SECP CFD solver output against physical empirical/analytical reference correlations:
 * - Blasius Empirical Pipe & Channel Friction Correlations (1913/1939)
 * - Prandtl 1/7th Law Turbulent Skin Friction Correlation (1927)
 * - Moody / Colebrook-White Friction Factor
 */

import { ReferenceValidationResult } from './types';
import { TurbulenceCaseRegistry } from './TurbulenceCaseRegistry';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';

export class TurbulenceReferenceValidator {
  public static validateCase(
    c: ReturnType<typeof TurbulenceCaseRegistry.getCanonicalCases>[0],
    sol: ReturnType<typeof Fvm3DNavierStokesSolver.solve>
  ): ReferenceValidationResult {
    const isConverged = sol.convergenceAudit?.converged === true && sol.convergenceAudit?.terminationReason === 'CONVERGED';

    if (c.caseId === 'TC-TURB-01-CHANNEL') {
      const U = c.boundaryConditions.inletVelocityMS.x;
      const rho = c.fluid.densityKgM3;
      const wallArea = c.mesh.faces.filter(f => f.boundaryType === 'WALL').reduce((sum, f) => sum + f.area, 0);
      const viscousForce = sol.monitors.viscousDragForceN || sol.monitors.dragForceN;
      const tau_w = viscousForce / Math.max(wallArea, 1e-10);
      const calculatedF = (8.0 * tau_w) / Math.max(rho * U * U, 1e-10);
      const refF = c.referenceFrictionFactor || 0.0265;

      const absErr = Math.abs(calculatedF - refF);
      const relErrPercent = (absErr / refF) * 100;
      const normErr = absErr / refF;

      let status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'NOT_CONVERGED' = 'FAIL';
      if (!isConverged) {
        status = 'NOT_CONVERGED';
      } else if (relErrPercent <= 25.0) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }

      return {
        caseId: c.caseId,
        caseName: c.name,
        calculatedValue: calculatedF,
        referenceValue: refF,
        metricName: 'Darcy Friction Factor (f)',
        unit: 'dimensionless',
        referenceSource: 'Blasius / Dean Channel Correlation (f = 0.316 * Re^-0.25)',
        absoluteError: absErr,
        relativeErrorPercent: relErrPercent,
        normalizedError: normErr,
        tolerancePercent: 25.0,
        status: status as 'PASS' | 'FAIL' | 'UNPROVEN'
      };
    } else if (c.caseId === 'TC-TURB-02-PIPE') {
      const U = c.boundaryConditions.inletVelocityMS.x;
      const rho = c.fluid.densityKgM3;
      const wallArea = c.mesh.faces.filter(f => f.boundaryType === 'WALL').reduce((sum, f) => sum + f.area, 0);
      const viscousForce = sol.monitors.viscousDragForceN || sol.monitors.dragForceN;
      const tau_w = viscousForce / Math.max(wallArea, 1e-10);
      const calculatedF = (8.0 * tau_w) / Math.max(rho * U * U, 1e-10);
      const refF = c.referenceFrictionFactor || 0.0223;

      const absErr = Math.abs(calculatedF - refF);
      const relErrPercent = (absErr / refF) * 100;
      const normErr = absErr / refF;

      let status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'NOT_CONVERGED' = 'FAIL';
      if (!isConverged) {
        status = 'NOT_CONVERGED';
      } else if (relErrPercent <= 25.0) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }

      return {
        caseId: c.caseId,
        caseName: c.name,
        calculatedValue: calculatedF,
        referenceValue: refF,
        metricName: 'Darcy Friction Factor (f)',
        unit: 'dimensionless',
        referenceSource: 'Blasius / Moody Pipe Correlation (Re = 40,000)',
        absoluteError: absErr,
        relativeErrorPercent: relErrPercent,
        normalizedError: normErr,
        tolerancePercent: 25.0,
        status: status as 'PASS' | 'FAIL' | 'UNPROVEN'
      };
    } else if (c.caseId === 'TC-TURB-03-FLAT-PLATE') {
      const calculatedCf = sol.monitors.dragCoefficientCd / 2.0;
      const refCf = c.referenceSkinFriction || 0.00427;

      const absErr = Math.abs(calculatedCf - refCf);
      const relErrPercent = (absErr / refCf) * 100;
      const normErr = absErr / refCf;

      let status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'NOT_CONVERGED' = 'FAIL';
      if (!isConverged) {
        status = 'NOT_CONVERGED';
      } else if (relErrPercent <= 30.0) {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }

      return {
        caseId: c.caseId,
        caseName: c.name,
        calculatedValue: calculatedCf,
        referenceValue: refCf,
        metricName: 'Skin Friction Coefficient (Cf)',
        unit: 'dimensionless',
        referenceSource: 'Prandtl 1/7th Power Law Turbulent Skin Friction',
        absoluteError: absErr,
        relativeErrorPercent: relErrPercent,
        normalizedError: normErr,
        tolerancePercent: 30.0,
        status: status as 'PASS' | 'FAIL' | 'UNPROVEN'
      };
    } else {
      // Case D / Adverse Pressure Gradient
      return {
        caseId: c.caseId,
        caseName: c.name,
        calculatedValue: sol.monitors.pressureDropPa,
        referenceValue: 0.0,
        metricName: 'Separated Recirculation Length',
        unit: 'm',
        referenceSource: 'NASA Langley Adverse Pressure Gradient Database',
        absoluteError: 0.0,
        relativeErrorPercent: 0.0,
        normalizedError: 0.0,
        tolerancePercent: 0.0,
        status: 'UNPROVEN'
      };
    }
  }

  public static validateAgainstReferences(): ReferenceValidationResult[] {
    const results: ReferenceValidationResult[] = [];
    const cases = TurbulenceCaseRegistry.getCanonicalCases();

    for (const c of cases) {
      const sol = Fvm3DNavierStokesSolver.solve(Fvm3DMeshGenerator.cloneMesh(c.mesh), c.fluid, c.boundaryConditions, c.solverConfig);
      results.push(TurbulenceReferenceValidator.validateCase(c, sol));
    }

    return results;
  }
}
