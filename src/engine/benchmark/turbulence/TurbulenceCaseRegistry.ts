/**
 * PATCH-176: Canonical Turbulence Benchmark Case Registry
 * 
 * Defines canonical test cases for turbulence verification:
 * - Case A: Turbulent Channel Flow
 * - Case B: Fully Developed Pipe Flow
 * - Case C: Flat Plate Boundary Layer
 * - Case D: Adverse Pressure Gradient
 */

import { BenchmarkCaseId, ReynoldsCalculationInput } from './types';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { BoundaryConditionSpec3D, FluidProperties3D, FvmMesh3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';

export interface CanonicalTurbulenceCase {
  caseId: BenchmarkCaseId;
  name: string;
  description: string;
  mesh: FvmMesh3D;
  fluid: FluidProperties3D;
  boundaryConditions: BoundaryConditionSpec3D;
  solverConfig: SolverConfig3D;
  characteristicLength: number;
  referenceFrictionFactor?: number;
  referenceSkinFriction?: number;
}

export class TurbulenceCaseRegistry {
  public static calculateReynoldsNumber(
    density: number,
    velocity: number,
    characteristicLength: number,
    viscosity: number
  ): ReynoldsCalculationInput {
    const re = (density * Math.abs(velocity) * characteristicLength) / Math.max(viscosity, 1e-12);
    let regime: ReynoldsCalculationInput['flowRegimeClassification'] = 'LAMINAR';
    if (re > 4000) {
      regime = 'TURBULENT';
    } else if (re > 2300) {
      regime = 'TRANSITIONAL';
    }

    return {
      fluidDensity: density,
      fluidViscosity: viscosity,
      bulkVelocity: velocity,
      characteristicLength,
      calculatedReynoldsNumber: re,
      reynoldsFormula: `Re = (rho * U * L) / mu = (${density} * ${velocity} * ${characteristicLength}) / ${viscosity} = ${re.toFixed(1)}`,
      flowRegimeClassification: regime
    };
  }

  public static getCanonicalCases(): CanonicalTurbulenceCase[] {
    const cases: CanonicalTurbulenceCase[] = [];

    // Case A: Turbulent Channel Flow (Re_H = 10,152)
    const channelMesh = Fvm3DMeshGenerator.generateBoxMesh(0.4, 0.03, 0.03, 12, 4, 4);
    const airFluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 1.81e-5 };
    
    // Blasius empirical correlation for turbulent pipe/channel friction factor: f = 0.316 * Re^(-1/4)
    const dhChannel = 0.03; // Hydraulic diameter = 4A/P = 4*(0.03*0.03)/(4*0.03) = 0.03m
    const reChannel = (1.225 * 10.0 * dhChannel) / 1.81e-5; // Re = 20,303.9
    const blasiusFrictionFactor = 0.316 * Math.pow(reChannel, -0.25); // ~ 0.0265

    cases.push({
      caseId: 'TC-TURB-01-CHANNEL',
      name: 'Turbulent Channel Flow (Re ≈ 20,000)',
      description: '3D rectangular channel flow under high Reynolds number conditions to audit turbulent velocity profiles and wall shear.',
      mesh: channelMesh,
      fluid: airFluid,
      boundaryConditions: {
        inletVelocityMS: { x: 10.0, y: 0.0, z: 0.0 },
        outletPressurePa: 0.0,
        wallTurbulenceIntensity: 5.0
      },
      solverConfig: {
        maxIterations: 30,
        continuityTol: 1e-4,
        momentumTol: 1e-4,
        underRelaxationVelocity: 0.7,
        underRelaxationPressure: 0.3,
        useTurbulenceModel: true,
        turbulenceScheme: 'K_EPSILON',
        upwindScheme: 'FIRST_ORDER_UPWIND'
      },
      characteristicLength: dhChannel,
      referenceFrictionFactor: blasiusFrictionFactor
    });

    // Case B: Fully Developed Pipe Flow (Re_D = 40,000)
    const pipeMesh = Fvm3DMeshGenerator.generateBoxMesh(0.5, 0.02, 0.02, 15, 5, 5);
    const waterFluid: FluidProperties3D = { densityKgM3: 1000.0, viscosityPaS: 0.001 };
    const dhPipe = 0.02; // Hydraulic diameter = 4A/P = 0.02m
    const rePipe = (1000.0 * 2.0 * dhPipe) / 0.001; // Re = 40,000.0
    const blasiusPipeFrictionFactor = 0.316 * Math.pow(rePipe, -0.25); // ~ 0.0223

    cases.push({
      caseId: 'TC-TURB-02-PIPE',
      name: 'Fully Developed Pipe Flow (Re = 40,000)',
      description: 'High Reynolds number water flow in a duct to evaluate friction factor against Moody/Blasius empirical correlations.',
      mesh: pipeMesh,
      fluid: waterFluid,
      boundaryConditions: {
        inletVelocityMS: { x: 2.0, y: 0.0, z: 0.0 },
        outletPressurePa: 0.0,
        wallTurbulenceIntensity: 5.0
      },
      solverConfig: {
        maxIterations: 30,
        continuityTol: 1e-4,
        momentumTol: 1e-4,
        underRelaxationVelocity: 0.7,
        underRelaxationPressure: 0.3,
        useTurbulenceModel: true,
        turbulenceScheme: 'K_EPSILON',
        upwindScheme: 'FIRST_ORDER_UPWIND'
      },
      characteristicLength: dhPipe,
      referenceFrictionFactor: blasiusPipeFrictionFactor
    });

    // Case C: Flat Plate Boundary Layer (Re_x = 500,000)
    const flatPlateMesh = Fvm3DMeshGenerator.generateBoxMesh(0.5, 0.05, 0.05, 16, 4, 4);
    const reFlatPlate = (1.225 * 30.0 * 0.25) / 1.81e-5; // Re = 507596.7
    // Prandtl 1/7th law skin friction coefficient: Cf = 0.0592 * Re_x^(-0.2)
    const prandtlCf = 0.0592 * Math.pow(reFlatPlate, -0.2); // ~ 0.00427

    cases.push({
      caseId: 'TC-TURB-03-FLAT-PLATE',
      name: 'Flat Plate Boundary Layer (Re_x ≈ 500,000)',
      description: 'Zero pressure gradient turbulent boundary layer development along a flat surface.',
      mesh: flatPlateMesh,
      fluid: airFluid,
      boundaryConditions: {
        inletVelocityMS: { x: 30.0, y: 0.0, z: 0.0 },
        outletPressurePa: 0.0,
        wallTurbulenceIntensity: 5.0
      },
      solverConfig: {
        maxIterations: 30,
        continuityTol: 1e-4,
        momentumTol: 1e-4,
        underRelaxationVelocity: 0.7,
        underRelaxationPressure: 0.3,
        useTurbulenceModel: true,
        turbulenceScheme: 'K_EPSILON',
        upwindScheme: 'FIRST_ORDER_UPWIND'
      },
      characteristicLength: 0.25,
      referenceSkinFriction: prandtlCf
    });

    // Case D: Adverse Pressure Gradient (Diffuser / Separation Tendency)
    const apgMesh = Fvm3DMeshGenerator.generateBoxMesh(0.6, 0.06, 0.06, 12, 4, 4);
    cases.push({
      caseId: 'TC-TURB-04-ADVERSE-PRESSURE',
      name: 'Adverse Pressure Gradient & Separation (Re ≈ 50,000)',
      description: 'Decelerating flow under adverse pressure gradient to test boundary layer separation behavior and turbulence recovery.',
      mesh: apgMesh,
      fluid: airFluid,
      boundaryConditions: {
        inletVelocityMS: { x: 15.0, y: 0.0, z: 0.0 },
        outletPressurePa: 50.0, // Imposed back-pressure creating adverse gradient
        wallTurbulenceIntensity: 5.0
      },
      solverConfig: {
        maxIterations: 30,
        continuityTol: 1e-4,
        momentumTol: 1e-4,
        underRelaxationVelocity: 0.7,
        underRelaxationPressure: 0.3,
        useTurbulenceModel: true,
        turbulenceScheme: 'K_EPSILON',
        upwindScheme: 'FIRST_ORDER_UPWIND'
      },
      characteristicLength: 0.06
    });

    return cases;
  }
}
