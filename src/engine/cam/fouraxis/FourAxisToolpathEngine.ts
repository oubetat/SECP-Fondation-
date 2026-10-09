/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Toolpath Master Engine & Benchmark Suite
 */

import {
  FourAxisMachineModel,
  FourAxisSetup,
  FourAxisOperation,
  FourAxisToolpathResult,
  FourAxisEvidencePackage,
  RotaryCoordinateSystem
} from './FourAxisTypes';
import { ToolType, CoolantState, CuttingTool } from '../toolpath/ToolpathTypes';
import { FourAxisToolpathGenerator } from './FourAxisToolpathGenerator';
import { FourAxisStockRemovalSimulator, FourAxisSimulationResult } from './FourAxisStockRemovalSimulator';
import { FourAxisEvidenceEngine } from './FourAxisEvidencePackage';

export class FourAxisToolpathEngine {
  /**
   * Pre-configured Industrial 4-Axis Machine Models
   */
  public static readonly MACHINE_MODELS: FourAxisMachineModel[] = [
    {
      id: 'HAAS_VF2_HRT210',
      name: 'Haas VF-2 + HRT210 (A-Axis Rotary)',
      manufacturer: 'Haas Automation',
      rotaryAxisLetter: 'A',
      tableType: 'TABLE_ROTARY',
      xLimitsMm: [-380, 380],
      yLimitsMm: [-200, 200],
      zLimitsMm: [-250, 250],
      isContinuousRotation: true,
      rotaryLimitsDeg: [-999999, 999999],
      rotaryOriginMachine: { x: 0, y: 0, z: 0 },
      rotaryAxisVector: { x: 1, y: 0, z: 0 },
      positiveRotationDirection: 'CCW',
      maxLinearFeedMmMin: 16500,
      maxRapidFeedMmMin: 25400,
      maxRotaryFeedDegMin: 6000,
      maxRotaryVelocityDegSec: 100,
      maxSpindleRpm: 12000,
      homePosition: { x: 0, y: 0, z: 200, rotaryDeg: 0 },
      toolChangePosition: { x: 0, y: 0, z: 220, rotaryDeg: 0 },
    },
    {
      id: 'DMG_DMU50_B_AXIS',
      name: 'DMG Mori DMU 50 (B-Axis Table Rotary)',
      manufacturer: 'DMG MORI',
      rotaryAxisLetter: 'B',
      tableType: 'TABLE_ROTARY',
      xLimitsMm: [-250, 250],
      yLimitsMm: [-220, 220],
      zLimitsMm: [-200, 200],
      isContinuousRotation: false,
      rotaryLimitsDeg: [-180, 180],
      rotaryOriginMachine: { x: 0, y: 0, z: 0 },
      rotaryAxisVector: { x: 0, y: 1, z: 0 },
      positiveRotationDirection: 'CCW',
      maxLinearFeedMmMin: 24000,
      maxRapidFeedMmMin: 30000,
      maxRotaryFeedDegMin: 4800,
      maxRotaryVelocityDegSec: 80,
      maxSpindleRpm: 15000,
      homePosition: { x: 0, y: 0, z: 180, rotaryDeg: 0 },
      toolChangePosition: { x: 0, y: 0, z: 190, rotaryDeg: 0 },
    },
    {
      id: 'HERMLE_C22_B_AXIS',
      name: 'Hermle C22 High-Precision (B-Axis)',
      manufacturer: 'Hermle AG',
      rotaryAxisLetter: 'B',
      tableType: 'TABLE_ROTARY',
      xLimitsMm: [-225, 225],
      yLimitsMm: [-200, 200],
      zLimitsMm: [-165, 165],
      isContinuousRotation: true,
      rotaryLimitsDeg: [-720, 720],
      rotaryOriginMachine: { x: 0, y: 0, z: 0 },
      rotaryAxisVector: { x: 0, y: 1, z: 0 },
      positiveRotationDirection: 'CCW',
      maxLinearFeedMmMin: 30000,
      maxRapidFeedMmMin: 45000,
      maxRotaryFeedDegMin: 7200,
      maxRotaryVelocityDegSec: 120,
      maxSpindleRpm: 18000,
      homePosition: { x: 0, y: 0, z: 150, rotaryDeg: 0 },
      toolChangePosition: { x: 0, y: 0, z: 160, rotaryDeg: 0 },
    },
    {
      id: 'FANUC_ROBODRILL_DDR',
      name: 'Fanuc RoboDrill DDR-T (Direct Drive A-Axis)',
      manufacturer: 'FANUC',
      rotaryAxisLetter: 'A',
      tableType: 'TABLE_ROTARY',
      xLimitsMm: [-300, 300],
      yLimitsMm: [-150, 150],
      zLimitsMm: [-160, 160],
      isContinuousRotation: true,
      rotaryLimitsDeg: [-999999, 999999],
      rotaryOriginMachine: { x: 0, y: 0, z: 0 },
      rotaryAxisVector: { x: 1, y: 0, z: 0 },
      positiveRotationDirection: 'CCW',
      maxLinearFeedMmMin: 20000,
      maxRapidFeedMmMin: 54000,
      maxRotaryFeedDegMin: 12000,
      maxRotaryVelocityDegSec: 200,
      maxSpindleRpm: 24000,
      homePosition: { x: 0, y: 0, z: 140, rotaryDeg: 0 },
      toolChangePosition: { x: 0, y: 0, z: 150, rotaryDeg: 0 },
    },
  ];

  /**
   * Standard Cutting Tools for 4-Axis
   */
  public static readonly STANDARD_TOOLS: CuttingTool[] = [
    {
      id: 'TOOL_EM_10MM',
      name: 'Ø10mm 4-Flute Carbide End Mill',
      type: ToolType.FLAT_END_MILL,
      diameterMm: 10.0,
      overallLengthMm: 75.0,
      fluteLengthMm: 25.0,
      numberOfFlutes: 4,
      material: 'CARBIDE',
      holderDiameterMm: 28.0,
      stickoutMm: 45.0,
    },
    {
      id: 'TOOL_BALL_6MM',
      name: 'Ø6mm 2-Flute Ball Nose Mill',
      type: ToolType.BALL_NOSE,
      diameterMm: 6.0,
      overallLengthMm: 60.0,
      fluteLengthMm: 18.0,
      numberOfFlutes: 2,
      material: 'CARBIDE',
      holderDiameterMm: 24.0,
      stickoutMm: 38.0,
    },
    {
      id: 'TOOL_DRILL_6MM',
      name: 'Ø6mm High-Speed Carbide Drill',
      type: ToolType.DRILL,
      diameterMm: 6.0,
      overallLengthMm: 70.0,
      fluteLengthMm: 30.0,
      numberOfFlutes: 2,
      material: 'CARBIDE',
      holderDiameterMm: 24.0,
      stickoutMm: 40.0,
    },
    {
      id: 'TOOL_SLOT_8MM',
      name: 'Ø8mm 3-Flute Slot Mill',
      type: ToolType.SLOT_MILL,
      diameterMm: 8.0,
      overallLengthMm: 65.0,
      fluteLengthMm: 20.0,
      numberOfFlutes: 3,
      material: 'CARBIDE',
      holderDiameterMm: 26.0,
      stickoutMm: 42.0,
    }
  ];

  /**
   * Benchmark A — Cylindrical Profile
   */
  public static createBenchmarkA(machineIndex: number = 0): FourAxisSetup {
    const machine = this.MACHINE_MODELS[machineIndex];
    const wcs: RotaryCoordinateSystem = {
      origin: { x: 0, y: 0, z: 0 },
      axisVector: { x: 1, y: 0, z: 0 },
      zeroAngleVector: { x: 0, y: 0, z: 1 },
      positiveDirection: 'CCW',
      angularUnit: 'DEGREES',
      wrapRadiusMm: 25.0,
      workOffsetId: 'G54',
    };

    const op1: FourAxisOperation = {
      id: 'OP_BENCH_A_CONTOUR',
      name: 'Rotary Cylindrical Profiling',
      strategy: 'ROTARY_CONTOUR' as any,
      mode: 'SIMULTANEOUS_4AXIS',
      tool: this.STANDARD_TOOLS[0],
      axialStepdownMm: 1.0,
      radialStepoverMm: 4.0,
      cuttingFeedMmMin: 1200,
      plungeFeedMmMin: 400,
      spindleRpm: 8000,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 25.0,
      axialRangeMm: [5, 45],
      slotDepthMm: 2.0,
    };

    return {
      id: 'SETUP_BENCHMARK_A',
      name: 'Benchmark A: Cylindrical Profile',
      machine,
      wcs,
      workOffset: 'G54',
      stockType: 'CYLINDRICAL',
      stockDimensions: {
        outerDiameterMm: 52.0,
        lengthMm: 60.0,
      },
      fixtureModel: {
        type: 'CHUCK_3JAW',
        clampingLengthMm: 12.0,
        jawClearanceRadiusMm: 35.0,
      },
      partPlacementOffset: { x: 0, y: 0, z: 0 },
      partRotaryOrientationDeg: 0,
      operations: [op1],
    };
  }

  /**
   * Benchmark B — Wrapped Helical Slot
   */
  public static createBenchmarkB(machineIndex: number = 0): FourAxisSetup {
    const machine = this.MACHINE_MODELS[machineIndex];
    const wcs: RotaryCoordinateSystem = {
      origin: { x: 0, y: 0, z: 0 },
      axisVector: { x: 1, y: 0, z: 0 },
      zeroAngleVector: { x: 0, y: 0, z: 1 },
      positiveDirection: 'CCW',
      angularUnit: 'DEGREES',
      wrapRadiusMm: 25.0,
      workOffsetId: 'G54',
    };

    const op1: FourAxisOperation = {
      id: 'OP_BENCH_B_SLOT',
      name: 'Wrapped Helical Slot 360°',
      strategy: 'WRAPPED_SLOT' as any,
      mode: 'SIMULTANEOUS_4AXIS',
      tool: this.STANDARD_TOOLS[3],
      axialStepdownMm: 1.5,
      radialStepoverMm: 0,
      cuttingFeedMmMin: 900,
      plungeFeedMmMin: 300,
      spindleRpm: 7500,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 25.0,
      angularRangeDeg: [0, 360],
      axialRangeMm: [10, 45],
      slotDepthMm: 4.0,
    };

    return {
      id: 'SETUP_BENCHMARK_B',
      name: 'Benchmark B: Wrapped Helical Slot',
      machine,
      wcs,
      workOffset: 'G54',
      stockType: 'CYLINDRICAL',
      stockDimensions: {
        outerDiameterMm: 50.0,
        lengthMm: 60.0,
      },
      fixtureModel: {
        type: 'CHUCK_3JAW',
        clampingLengthMm: 10.0,
        jawClearanceRadiusMm: 32.0,
      },
      partPlacementOffset: { x: 0, y: 0, z: 0 },
      partRotaryOrientationDeg: 0,
      operations: [op1],
    };
  }

  /**
   * Benchmark C — Indexed Radial Hole Pattern
   */
  public static createBenchmarkC(machineIndex: number = 0): FourAxisSetup {
    const machine = this.MACHINE_MODELS[machineIndex];
    const wcs: RotaryCoordinateSystem = {
      origin: { x: 0, y: 0, z: 0 },
      axisVector: { x: 1, y: 0, z: 0 },
      zeroAngleVector: { x: 0, y: 0, z: 1 },
      positiveDirection: 'CCW',
      angularUnit: 'DEGREES',
      wrapRadiusMm: 25.0,
      workOffsetId: 'G54',
    };

    const op1: FourAxisOperation = {
      id: 'OP_BENCH_C_DRILL',
      name: 'Indexed Radial Cross-Holes (4x 90°)',
      strategy: 'INDEXED_HOLE_DRILLING' as any,
      mode: 'INDEXED_4AXIS',
      tool: this.STANDARD_TOOLS[2],
      axialStepdownMm: 6.0,
      radialStepoverMm: 0,
      cuttingFeedMmMin: 450,
      plungeFeedMmMin: 350,
      spindleRpm: 4500,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 25.0,
    };

    return {
      id: 'SETUP_BENCHMARK_C',
      name: 'Benchmark C: Indexed Radial Holes',
      machine,
      wcs,
      workOffset: 'G54',
      stockType: 'CYLINDRICAL',
      stockDimensions: {
        outerDiameterMm: 50.0,
        lengthMm: 55.0,
      },
      fixtureModel: {
        type: 'CHUCK_3JAW',
        clampingLengthMm: 10.0,
        jawClearanceRadiusMm: 30.0,
      },
      partPlacementOffset: { x: 0, y: 0, z: 0 },
      partRotaryOrientationDeg: 0,
      operations: [op1],
    };
  }

  /**
   * Benchmark D — High-Precision Rotary Contour
   */
  public static createBenchmarkD(machineIndex: number = 0): FourAxisSetup {
    const machine = this.MACHINE_MODELS[machineIndex];
    const wcs: RotaryCoordinateSystem = {
      origin: { x: 0, y: 0, z: 0 },
      axisVector: { x: 1, y: 0, z: 0 },
      zeroAngleVector: { x: 0, y: 0, z: 1 },
      positiveDirection: 'CCW',
      angularUnit: 'DEGREES',
      wrapRadiusMm: 30.0,
      workOffsetId: 'G54',
    };

    const op1: FourAxisOperation = {
      id: 'OP_BENCH_D_CONTOUR',
      name: 'Rotary Contour Multi-Pass Finishing',
      strategy: 'ROTARY_CONTOUR' as any,
      mode: 'SIMULTANEOUS_4AXIS',
      tool: this.STANDARD_TOOLS[1],
      axialStepdownMm: 0.8,
      radialStepoverMm: 2.5,
      cuttingFeedMmMin: 1500,
      plungeFeedMmMin: 500,
      spindleRpm: 12000,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 30.0,
      axialRangeMm: [10, 50],
      slotDepthMm: 1.5,
    };

    return {
      id: 'SETUP_BENCHMARK_D',
      name: 'Benchmark D: Rotary Contour Finishing',
      machine,
      wcs,
      workOffset: 'G54',
      stockType: 'CYLINDRICAL',
      stockDimensions: {
        outerDiameterMm: 62.0,
        lengthMm: 65.0,
      },
      fixtureModel: {
        type: 'CHUCK_3JAW',
        clampingLengthMm: 10.0,
        jawClearanceRadiusMm: 38.0,
      },
      partPlacementOffset: { x: 0, y: 0, z: 0 },
      partRotaryOrientationDeg: 0,
      operations: [op1],
    };
  }

  /**
   * Benchmark E — Complex 4-Axis Part (Turbine Rotor / Camshaft)
   * Combines Indexed Machining, Wrapped Helical Slots, Cross-Holes and Rotary Finishing
   */
  public static createBenchmarkE(machineIndex: number = 0): FourAxisSetup {
    const machine = this.MACHINE_MODELS[machineIndex];
    const wcs: RotaryCoordinateSystem = {
      origin: { x: 0, y: 0, z: 0 },
      axisVector: { x: 1, y: 0, z: 0 },
      zeroAngleVector: { x: 0, y: 0, z: 1 },
      positiveDirection: 'CCW',
      angularUnit: 'DEGREES',
      wrapRadiusMm: 25.0,
      workOffsetId: 'G54',
    };

    const opIndexed0: FourAxisOperation = {
      id: 'OP_E_INDEX_0',
      name: 'Indexed Pocket A=0°',
      strategy: 'INDEXED_MACHINING' as any,
      mode: 'INDEXED_4AXIS',
      tool: this.STANDARD_TOOLS[0],
      axialStepdownMm: 1.5,
      radialStepoverMm: 5.0,
      cuttingFeedMmMin: 1100,
      plungeFeedMmMin: 350,
      spindleRpm: 7000,
      coolant: CoolantState.FLOOD,
      fixedIndexAngleDeg: 0,
      slotDepthMm: 3.5,
    };

    const opIndexed90: FourAxisOperation = {
      id: 'OP_E_INDEX_90',
      name: 'Indexed Pocket A=90°',
      strategy: 'INDEXED_MACHINING' as any,
      mode: 'INDEXED_4AXIS',
      tool: this.STANDARD_TOOLS[0],
      axialStepdownMm: 1.5,
      radialStepoverMm: 5.0,
      cuttingFeedMmMin: 1100,
      plungeFeedMmMin: 350,
      spindleRpm: 7000,
      coolant: CoolantState.FLOOD,
      fixedIndexAngleDeg: 90,
      slotDepthMm: 3.5,
    };

    const opSlot: FourAxisOperation = {
      id: 'OP_E_WRAPPED_SLOT',
      name: 'Simultaneous Wrapped Helical Flute',
      strategy: 'WRAPPED_SLOT' as any,
      mode: 'SIMULTANEOUS_4AXIS',
      tool: this.STANDARD_TOOLS[3],
      axialStepdownMm: 1.2,
      radialStepoverMm: 0,
      cuttingFeedMmMin: 950,
      plungeFeedMmMin: 300,
      spindleRpm: 7200,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 25.0,
      angularRangeDeg: [0, 270],
      axialRangeMm: [15, 45],
      slotDepthMm: 3.0,
    };

    const opHoles: FourAxisOperation = {
      id: 'OP_E_CROSS_HOLES',
      name: 'Radial Cross-Drilling (4x Holes)',
      strategy: 'INDEXED_HOLE_DRILLING' as any,
      mode: 'INDEXED_4AXIS',
      tool: this.STANDARD_TOOLS[2],
      axialStepdownMm: 5.0,
      radialStepoverMm: 0,
      cuttingFeedMmMin: 400,
      plungeFeedMmMin: 300,
      spindleRpm: 4200,
      coolant: CoolantState.FLOOD,
      cylinderRadiusMm: 25.0,
    };

    return {
      id: 'SETUP_BENCHMARK_E',
      name: 'Benchmark E: Complex Multi-Operation 4-Axis Part',
      machine,
      wcs,
      workOffset: 'G54',
      stockType: 'CYLINDRICAL',
      stockDimensions: {
        outerDiameterMm: 52.0,
        lengthMm: 65.0,
      },
      fixtureModel: {
        type: 'CHUCK_3JAW',
        clampingLengthMm: 12.0,
        jawClearanceRadiusMm: 35.0,
      },
      partPlacementOffset: { x: 0, y: 0, z: 0 },
      partRotaryOrientationDeg: 0,
      operations: [opIndexed0, opIndexed90, opSlot, opHoles],
    };
  }

  /**
   * Execute full pipeline: Setup -> Toolpath -> Simulation -> Evidence
   */
  public static executePipeline(setup: FourAxisSetup): {
    toolpath: FourAxisToolpathResult;
    simulation: FourAxisSimulationResult;
    evidence: FourAxisEvidencePackage;
  } {
    const toolpath = FourAxisToolpathGenerator.generateToolpath(setup);
    const simulation = FourAxisStockRemovalSimulator.simulateMaterialRemoval(
      toolpath.allSegments,
      setup,
      setup.operations,
      35,
      60
    );
    const evidence = FourAxisEvidenceEngine.generateEvidencePackage(
      toolpath,
      setup,
      simulation.stats,
      toolpath.isValid
    );

    return {
      toolpath,
      simulation,
      evidence,
    };
  }
}
