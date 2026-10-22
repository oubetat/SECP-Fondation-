/**
 * SECP Industrial OS — Engineering Truth OS
 * PcbStructuralDeflectionEngine.ts
 * 
 * Implements structural discrete Kirchhoff plate bending, 1D beam strip verification,
 * boundary condition enforcement, stress tensor recovery, reaction force equilibrium,
 * and dynamic natural frequency estimation for PCB substrates.
 */

import {
  PcbStructuralBoardConfig,
  StructuralBoundaryType,
  STANDARD_PCB_STRUCTURAL_MATERIALS
} from '../engineeringCore/PcbStructuralModel';
import {
  StructuralPlateSolver,
  SpatialStructuralResult
} from '../engineeringCore/StructuralPlateSolver';
import { PcbCanonicalModel } from './PcbCanonicalModel';

export interface PcbSubstrateProperties {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  youngModulusGpa: number; // e.g. 24 GPa for FR4
  poissonRatio: number;      // e.g. 0.14 for FR4
  densityKgM3: number;       // e.g. 1850 kg/m^3 for FR4
  totalMassKg: number;
  mountingType: 'FOUR_CORNERS_SUPPORTED' | 'FOUR_EDGES_CLAMPED' | 'FOUR_EDGES_SIMPLY_SUPPORTED';
}

export interface StructuralDeflectionResult {
  maxDeflectionMm: number;
  maxBendingStressMpa: number;
  fundamentalFrequencyHz: number;
  isMechanicallyStable: boolean;
  notes: string;
  spatialDetails?: SpatialStructuralResult;
}

export class PcbStructuralDeflectionEngine {
  /**
   * Evaluates substrate structural integrity under static load.
   * Leverages 2D Kirchhoff plate matrix solver or 1D Euler-Bernoulli beam theory depending on geometry.
   */
  public static evaluateStructuralIntegrity(
    props: PcbSubstrateProperties,
    uniformLoadPa: number = 500.0 // 500 Pa (~50 kg/m^2 distributed load)
  ): StructuralDeflectionResult {
    const { lengthMm, widthMm, thicknessMm, youngModulusGpa, poissonRatio, densityKgM3, totalMassKg, mountingType } = props;

    if (lengthMm <= 0 || widthMm <= 0 || thicknessMm <= 0 || youngModulusGpa <= 0) {
      return {
        maxDeflectionMm: 0,
        maxBendingStressMpa: 0,
        fundamentalFrequencyHz: 0,
        isMechanicallyStable: false,
        notes: 'Invalid substrate geometric or material parameters.'
      };
    }

    const boundaryTypeMap: Record<string, StructuralBoundaryType> = {
      'FOUR_EDGES_CLAMPED': 'FOUR_EDGES_CLAMPED',
      'FOUR_EDGES_SIMPLY_SUPPORTED': 'FOUR_EDGES_SIMPLY_SUPPORTED',
      'FOUR_CORNERS_SUPPORTED': 'FOUR_CORNERS_SUPPORTED'
    };

    const bType = boundaryTypeMap[mountingType] || 'FOUR_CORNERS_SUPPORTED';

    try {
      const spatialConfig: PcbStructuralBoardConfig = {
        lengthMm,
        widthMm,
        thicknessMm,
        youngModulusGpa,
        poissonRatio: poissonRatio || 0.14,
        densityKgM3: densityKgM3 || 1850.0,
        boundaryType: bType,
        loads: {
          uniformPressurePa: uniformLoadPa,
          includeSubstrateSelfWeight: false // Use explicit load passed
        },
        gridResolutionX: 15,
        gridResolutionY: 15
      };

      const spatialRes = StructuralPlateSolver.solve(spatialConfig);

      const allowableDeflectionMm = lengthMm / 500;
      const allowableStressMpa = 100.0;
      const isStable = spatialRes.maxDeflectionMm <= allowableDeflectionMm && spatialRes.maxVonMisesStressMPa <= allowableStressMpa;

      return {
        maxDeflectionMm: spatialRes.maxDeflectionMm,
        maxBendingStressMpa: spatialRes.maxVonMisesStressMPa,
        fundamentalFrequencyHz: spatialRes.fundamentalFrequencyHz,
        isMechanicallyStable: isStable,
        notes: isStable
          ? `Substrate is structurally stable: Deflection ${spatialRes.maxDeflectionMm.toFixed(3)}mm <= ${allowableDeflectionMm.toFixed(3)}mm limit, Stress ${spatialRes.maxVonMisesStressMPa.toFixed(1)} MPa <= ${allowableStressMpa} MPa.`
          : `Structural warning: Deflection (${spatialRes.maxDeflectionMm.toFixed(3)}mm) or stress (${spatialRes.maxVonMisesStressMPa.toFixed(1)} MPa) exceeds allowable criteria.`,
        spatialDetails: spatialRes
      };
    } catch {
      // Robust analytical fallback (Euler-Bernoulli / Navier beam-plate)
      const L = lengthMm / 1000;
      const W = widthMm / 1000;
      const h = thicknessMm / 1000;
      const E = youngModulusGpa * 1e9;
      const I = (W * Math.pow(h, 3)) / 12;

      let maxDeflectionM = (5 * uniformLoadPa * Math.pow(L, 4)) / (384 * E * I);
      let maxStressPa = (3 * uniformLoadPa * Math.pow(L, 2)) / (4 * W * Math.pow(h, 2));

      if (mountingType === 'FOUR_EDGES_CLAMPED') {
        maxDeflectionM *= 0.2; // 1/5th deflection for clamped beam
        maxStressPa *= 0.67;
      }

      const maxDeflectionMm = parseFloat((maxDeflectionM * 1000).toFixed(4));
      const maxStressMpa = parseFloat((maxStressPa / 1e6).toFixed(3));

      const area = L * W;
      const mBar = area > 0 ? totalMassKg / area : 1.0;
      const fnHz = parseFloat(((Math.PI / 2) * Math.sqrt((E * I) / (mBar * Math.pow(L, 4)))).toFixed(1));

      const allowableDeflectionMm = lengthMm / 500;
      const isStable = maxDeflectionMm <= allowableDeflectionMm && maxStressMpa <= 100.0;

      return {
        maxDeflectionMm,
        maxBendingStressMpa: maxStressMpa,
        fundamentalFrequencyHz: fnHz,
        isMechanicallyStable: isStable,
        notes: isStable
          ? `Substrate is structurally stable: Deflection ${maxDeflectionMm.toFixed(3)}mm <= ${allowableDeflectionMm.toFixed(3)}mm limit, Stress ${maxStressMpa.toFixed(1)} MPa <= 100.0 MPa.`
          : `Structural warning: Deflection or bending stress exceeds allowable safety threshold.`
      };
    }
  }

  /**
   * Advanced spatial plate deflection solver with complete boundary options and stress tensors.
   */
  public static evaluateSpatialPlateIntegrity(config: PcbStructuralBoardConfig): SpatialStructuralResult {
    return StructuralPlateSolver.solve(config);
  }

  /**
   * Evaluates the canonical PcbCanonicalModel directly, converting mounting holes to standoffs
   * and placed components to localized point masses.
   */
  public static evaluateCanonicalPcbModel(
    model: PcbCanonicalModel,
    uniformPressurePa: number = 80.0
  ): SpatialStructuralResult {
    const standoffs = (model.mountingHoles || []).map(mh => ({
      id: mh.id,
      xMm: mh.x,
      yMm: mh.y,
      radiusMm: mh.diameterMm / 2
    }));

    // Estimate component masses (e.g. 0.5g default for passive, 2.5g for ICs)
    const components = (model.placements || []).map(p => {
      const isIC = p.widthMm > 6.0 || p.heightMm > 6.0;
      return {
        refDes: p.refDes,
        xMm: p.xMm,
        yMm: p.yMm,
        massGrams: isIC ? 2.5 : 0.5,
        widthMm: p.widthMm,
        heightMm: p.heightMm
      };
    });

    const boundaryType: StructuralBoundaryType =
      standoffs.length >= 4 ? 'STANDOFF_SUPPORTED' : 'FOUR_CORNERS_SUPPORTED';

    const cfg: PcbStructuralBoardConfig = {
      lengthMm: model.boardWidthMm,
      widthMm: model.boardHeightMm,
      thicknessMm: model.thicknessMm,
      materialType: 'FR4',
      boundaryType,
      standoffs,
      components,
      loads: {
        uniformPressurePa,
        includeSubstrateSelfWeight: true
      },
      gridResolutionX: 21,
      gridResolutionY: 21
    };

    return StructuralPlateSolver.solve(cfg);
  }
}
