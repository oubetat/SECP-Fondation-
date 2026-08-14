/**
 * PATCH-SECP-073: FEA Validation Engine
 * Validates FEA solvers against analytical boundary value problems (e.g. Axial Bar Tension, Cantilever Bending).
 */

import { FEAMesh, StructuralAnalysisResults } from './StructuralPhysicsTypes';
import { MaterialModelEngine } from './MaterialModelEngine';

export interface AnalyticalValidationReport {
  problemName: string;
  numericalValue: number;
  analyticalValue: number;
  relativeErrorPercent: number;
  isWithinTolerance: boolean;
}

export class FEAValidationEngine {
  /**
   * Compares axial bar FEM displacement results against the classic Hookean analytical displacement:
   * delta = (F * L) / (A * E)
   */
  public static validateAxialTension(
    results: StructuralAnalysisResults,
    length: number,
    force: number,
    area: number,
    materialId: string
  ): AnalyticalValidationReport {
    const mat = MaterialModelEngine.getMaterial(materialId);
    
    // delta = P * L / (A * E)
    const analyticalValue = (force * length) / (area * mat.youngsModulus);
    const numericalValue = results.maxDisplacement;

    const absoluteError = Math.abs(numericalValue - analyticalValue);
    const relativeErrorPercent = analyticalValue > 0 
      ? (absoluteError / analyticalValue) * 100 
      : 0;

    const isWithinTolerance = relativeErrorPercent < 0.1; // Strict 0.1% CAD benchmark tolerance

    return {
      problemName: '1D Axial Tension Rod Benchmark',
      numericalValue,
      analyticalValue,
      relativeErrorPercent,
      isWithinTolerance
    };
  }
}
