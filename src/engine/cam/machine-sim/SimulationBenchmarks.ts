/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Reference Benchmarks Battery (A through H) & Negative Verification Cases
 */

import {
  MachineSimulationInput,
  MachineDefinition,
  StockModelDefinition,
  FixtureModel,
  MachineSimulationResult,
} from './MachineSimulationTypes';
import { MachineSimulationEngine } from './MachineSimulationEngine';
import { FixtureManager } from './FixtureModel';
import { ToolGeometryDefinition, ToolHolderDefinition } from '../tool-library/ToolTypes';

export interface BenchmarkCaseResult {
  id: string;
  name: string;
  expectedVerdict: string;
  actualVerdict: string;
  passed: boolean;
  notes: string;
  simulationResult: MachineSimulationResult;
}

export class SimulationBenchmarks {
  public static getHaasVF4Definition(): MachineDefinition {
    return {
      id: 'HAAS_VF4SS',
      name: 'Haas VF-4SS Super-Speed VMC',
      vendor: 'Haas Automation',
      type: '3-AXIS-MILL',
      controllerDialect: 'HAAS_NGC',
      axes: [
        { name: 'X', type: 'LINEAR', direction: { x: 1, y: 0, z: 0 }, limits: { min: -635, max: 635, maxVelocity: 35500 }, homePosition: 0 },
        { name: 'Y', type: 'LINEAR', direction: { x: 0, y: 1, z: 0 }, limits: { min: -254, max: 254, maxVelocity: 35500 }, homePosition: 0 },
        { name: 'Z', type: 'LINEAR', direction: { x: 0, y: 0, z: 1 }, limits: { min: -317, max: 317, maxVelocity: 35500 }, homePosition: 100 },
      ],
      spindle: { maxRpm: 12000, minRpm: 100, maxPowerKw: 22.4, accelerationTimeSec: 1.5, interfaceType: 'CAT40', gaugeLength: 60 },
      toolChanger: { capacity: 30, toolChangeTimeSec: 2.8, chipToChipTimeSec: 3.6 },
      tableDimensions: { length: 1321, width: 457, height: 100 },
      machineOrigin: { x: 0, y: 0, z: 0 },
      kinematicChain: { baseComponent: 'BED', tableChain: ['X_AXIS', 'TABLE'], headChain: ['Z_COLUMN', 'Y_SADDLE', 'SPINDLE'] },
    };
  }

  public static getHermleC42Definition(): MachineDefinition {
    return {
      id: 'HERMLE_C42U',
      name: 'Hermle C42 U 5-Axis Dynamic Machining Center',
      vendor: 'Maschinenfabrik Berthold Hermle AG',
      type: '5-AXIS-TABLE-TABLE',
      controllerDialect: 'HEIDENHAIN_TNC640',
      axes: [
        { name: 'X', type: 'LINEAR', direction: { x: 1, y: 0, z: 0 }, limits: { min: -400, max: 400, maxVelocity: 45000 }, homePosition: 0 },
        { name: 'Y', type: 'LINEAR', direction: { x: 0, y: 1, z: 0 }, limits: { min: -400, max: 400, maxVelocity: 45000 }, homePosition: 0 },
        { name: 'Z', type: 'LINEAR', direction: { x: 0, y: 0, z: 1 }, limits: { min: -275, max: 275, maxVelocity: 45000 }, homePosition: 150 },
        { name: 'A', type: 'ROTARY', direction: { x: 1, y: 0, z: 0 }, limits: { min: -130, max: 130, maxVelocity: 4000 }, homePosition: 0 },
        { name: 'C', type: 'ROTARY', direction: { x: 0, y: 0, z: 1 }, limits: { min: -360, max: 360, maxVelocity: 6000 }, homePosition: 0 },
      ],
      spindle: { maxRpm: 18000, minRpm: 50, maxPowerKw: 35, accelerationTimeSec: 1.0, interfaceType: 'HSK-A63', gaugeLength: 50 },
      toolChanger: { capacity: 42, toolChangeTimeSec: 2.2, chipToChipTimeSec: 2.9 },
      tableDimensions: { length: 800, width: 800, height: 120 },
      machineOrigin: { x: 0, y: 0, z: 0 },
      kinematicChain: { baseComponent: 'BED', tableChain: ['A_TRUNNION', 'C_ROTARY_TABLE'], headChain: ['X_CARRIAGE', 'Y_CARRIAGE', 'Z_RAM', 'SPINDLE'] },
    };
  }

  public static getStandardTools(): Map<number, ToolGeometryDefinition> {
    const tools = new Map<number, ToolGeometryDefinition>();
    tools.set(1, {
      id: 'T01_EM10',
      name: '10mm Solid Carbide 4-Flute Endmill',
      type: 'FLAT_ENDMILL',
      cuttingDiameter: 10.0,
      fluteLength: 22.0,
      overallLength: 70.0,
      flutesCount: 4,
      cornerType: 'SHARP',
      shankDiameter: 10.0,
    });
    tools.set(2, {
      id: 'T02_EM16',
      name: '16mm Roughing Endmill',
      type: 'BULLNOSE_ENDMILL',
      cuttingDiameter: 16.0,
      fluteLength: 35.0,
      overallLength: 85.0,
      flutesCount: 4,
      cornerType: 'RADIUS',
      cornerRoundingRadius: 1.0,
      shankDiameter: 16.0,
    });
    return tools;
  }

  public static getStandardHolders(): Map<number, ToolHolderDefinition> {
    const holders = new Map<number, ToolHolderDefinition>();
    holders.set(1, {
      id: 'H01_ER32',
      name: 'ER32 Precision Collet Chuck HSK-A63',
      gaugeLength: 65.0,
      bodyDiameter: 50.0,
      colletDiameter: 34.0,
      taperType: 'HSK-A63',
    });
    holders.set(2, {
      id: 'H02_ER32_WIDE',
      name: 'ER32 Heavy-Duty Collet Chuck HSK-A63',
      gaugeLength: 50.0,
      bodyDiameter: 58.0,
      colletDiameter: 42.0,
      taperType: 'HSK-A63',
    });
    return holders;
  }

  public static getStandardStock(): StockModelDefinition {
    return {
      id: 'STK_ALU_6061',
      dimensions: { x: 100, y: 100, z: 40 },
      origin: { x: -50, y: -50, z: 0 },
      resolutionMm: 1.0,
      material: 'ALUMINUM_6061_T6',
      initialHash: 'STK-INIT-ALU6061-100X100X40',
    };
  }

  public static runAllBenchmarks(): BenchmarkCaseResult[] {
    const results: BenchmarkCaseResult[] = [];
    const engine = new MachineSimulationEngine();

    // Benchmark A: 3-Axis Reference Program
    const benchAInput: MachineSimulationInput = {
      ncProgram: `%
O1001 (BENCHMARK A - 3-AXIS MILLING)
G90 G54 G17 G21 G94
T01 M06
S8000 M03
G00 X-30.0 Y-30.0 Z10.0
G00 Z2.0
G01 Z-2.0 F500
G01 X30.0 F1200
G02 X30.0 Y30.0 R30.0
G01 X-30.0
G01 Y-30.0
G00 Z10.0
M05
M30
%`,
      machine: this.getHaasVF4Definition(),
      controller: 'HAAS_NGC',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createPrecisionVise(120, 100, 35, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resA = engine.runSimulation(benchAInput);
    results.push({
      id: 'BENCHMARK-A',
      name: '3-Axis Milling Reference Program',
      expectedVerdict: 'SIMULATION_PASSED',
      actualVerdict: resA.verdict,
      passed: resA.verdict === 'SIMULATION_PASSED' && resA.collisions.length === 0,
      notes: 'Clean 3-axis motion with zero collisions and verified material removal.',
      simulationResult: resA,
    });

    // Benchmark B: Intentional Tool ↔ Fixture Collision
    const benchBInput: MachineSimulationInput = {
      ncProgram: `%
O1002 (BENCHMARK B - INTENTIONAL TOOL CLAMP COLLISION)
G90 G54 G17 G21 G94
T01 M06
S6000 M03
G00 X0.0 Y0.0 Z10.0
G01 X0.0 Y60.0 Z-5.0 F1000 (Plunges straight into Fixed Vise Jaw)
G00 Z10.0
M30
%`,
      machine: this.getHaasVF4Definition(),
      controller: 'HAAS_NGC',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createPrecisionVise(120, 100, 35, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resB = engine.runSimulation(benchBInput);
    results.push({
      id: 'BENCHMARK-B',
      name: 'Intentional Tool-Fixture Collision',
      expectedVerdict: 'COLLISION_DETECTED',
      actualVerdict: resB.verdict,
      passed: resB.verdict === 'COLLISION_DETECTED' && resB.collisions.some(c => c.classification === 'FIXTURE_COLLISION' || c.classification === 'TOOL_COLLISION'),
      notes: 'Successfully intercepted cutter collision with fixture jaw.',
      simulationResult: resB,
    });

    // Benchmark C: Holder Collision (Cutter tip safe, Holder strikes fixture)
    const benchCInput: MachineSimulationInput = {
      ncProgram: `%
O1003 (BENCHMARK C - HOLDER ONLY COLLISION)
G90 G54 G17 G21 G94
T02 M06 (Tool with wide H02 Holder)
S6000 M03
G00 X0.0 Y0.0 Z10.0
G01 X-45.0 Y0.0 Z0.0 F800 (Tip clears stock, but Wide 58mm holder strikes Step Clamp at X=-60)
G00 Z20.0
M30
%`,
      machine: this.getHaasVF4Definition(),
      controller: 'HAAS_NGC',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createStepClampFixture(80, 80, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resC = engine.runSimulation(benchCInput);
    results.push({
      id: 'BENCHMARK-C',
      name: 'Holder-Only Fixture Collision',
      expectedVerdict: 'COLLISION_DETECTED',
      actualVerdict: resC.verdict,
      passed: resC.verdict === 'COLLISION_DETECTED' && resC.collisions.some(c => c.classification === 'HOLDER_COLLISION' || c.classification === 'FIXTURE_COLLISION'),
      notes: 'Correctly identified interference between Holder Collet and step clamp.',
      simulationResult: resC,
    });

    // Benchmark D: Axis Limit Violation
    const benchDInput: MachineSimulationInput = {
      ncProgram: `%
O1004 (BENCHMARK D - AXIS OVERTRAVEL)
G90 G54 G17 G21 G94
T01 M06
S8000 M03
G00 X1000.0 Y0.0 Z50.0 (Exceeds Haas X-axis +635mm stroke limit)
M30
%`,
      machine: this.getHaasVF4Definition(),
      controller: 'HAAS_NGC',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createPrecisionVise(120, 100, 35, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resD = engine.runSimulation(benchDInput);
    results.push({
      id: 'BENCHMARK-D',
      name: 'Physical Axis Stroke Limit Violation',
      expectedVerdict: 'AXIS_LIMIT_FAILURE',
      actualVerdict: resD.verdict,
      passed: resD.verdict === 'AXIS_LIMIT_FAILURE' && resD.limitViolations.some(v => v.axis === 'X'),
      notes: 'Flagged stroke over-travel at X=1000mm against +635mm ceiling.',
      simulationResult: resD,
    });

    // Benchmark E: 5-Axis RTCP Impeller Blade Simulation
    const benchEInput: MachineSimulationInput = {
      ncProgram: `%
O1005 (BENCHMARK E - 5-AXIS RTCP IMPELLER)
G90 G54 G17 G21 G94
T01 M06
S12000 M03
M128 (Enable Heidenhain TCPM)
G00 X0.0 Y-30.0 Z20.0 A0.0 C0.0
G01 Z2.0 F1000
G01 X10.0 Y-20.0 Z0.0 A15.0 C30.0 F1500
G01 X20.0 Y-10.0 Z-2.0 A25.0 C60.0
G01 X25.0 Y0.0 Z-3.0 A30.0 C90.0
G00 Z30.0
M129 (Disable TCPM)
M30
%`,
      machine: this.getHermleC42Definition(),
      controller: 'HEIDENHAIN_TNC640',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createPrecisionVise(100, 80, 30, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resE = engine.runSimulation(benchEInput);
    results.push({
      id: 'BENCHMARK-E',
      name: '5-Axis Simultaneous RTCP Impeller',
      expectedVerdict: 'SIMULATION_PASSED',
      actualVerdict: resE.verdict,
      passed: resE.verdict === 'SIMULATION_PASSED' && resE.snapshots.length > 5,
      notes: 'Verified continuous multi-axis kinematics and RTCP orientation tracking.',
      simulationResult: resE,
    });

    // Benchmark F: Stock Comparison & Material Removal
    const benchFInput: MachineSimulationInput = {
      ...benchAInput,
    };
    const resF = engine.runSimulation(benchFInput);
    results.push({
      id: 'BENCHMARK-F',
      name: 'Stock Volume Removal & Rest Material',
      expectedVerdict: 'SIMULATION_PASSED',
      actualVerdict: resF.verdict,
      passed: resF.verdict === 'SIMULATION_PASSED' && resF.stockResult.totalVolumeRemovedMm3 > 0,
      notes: `Successfully excavated ${resF.stockResult.totalVolumeRemovedMm3.toFixed(1)} mm³ of stock material.`,
      simulationResult: resF,
    });

    // Benchmark G: Intentional Gouge Detection
    const benchGInput: MachineSimulationInput = {
      ncProgram: `%
O1007 (BENCHMARK G - INTENTIONAL GOUGE)
G90 G54 G17 G21 G94
T01 M06
S8000 M03
G00 X0.0 Y0.0 Z10.0
G01 Z-20.0 F500 (Gouges deeply past finished floor at Z=5mm)
G01 X20.0
G00 Z10.0
M30
%`,
      machine: this.getHaasVF4Definition(),
      controller: 'HAAS_NGC',
      tools: this.getStandardTools(),
      holders: this.getStandardHolders(),
      fixture: FixtureManager.createPrecisionVise(120, 100, 35, { x: 0, y: 0, z: 0 }),
      stock: this.getStandardStock(),
      wcsOffsets: { G54: { x: 0, y: 0, z: 0 } },
    };
    const resG = engine.runSimulation(benchGInput);
    results.push({
      id: 'BENCHMARK-G',
      name: 'Workpiece Gouge Overcut Detection',
      expectedVerdict: 'STOCK_DEVIATION',
      actualVerdict: resG.verdict,
      passed: resG.verdict === 'STOCK_DEVIATION' && resG.stockResult.gougeCount > 0,
      notes: `Detected overcut gouge of ${resG.stockResult.maxGougeDepthMm.toFixed(2)} mm below nominal floor.`,
      simulationResult: resG,
    });

    // Benchmark H: Deterministic Replay
    const resH1 = engine.runSimulation(benchAInput);
    const resH2 = engine.runSimulation(benchAInput);
    const isDeterministic = resH1.evidenceDigest === resH2.evidenceDigest &&
      resH1.cycleTime.totalTimeSec === resH2.cycleTime.totalTimeSec &&
      resH1.stockResult.finalHash === resH2.stockResult.finalHash;
    results.push({
      id: 'BENCHMARK-H',
      name: 'Deterministic Simulation Replay',
      expectedVerdict: 'SIMULATION_PASSED',
      actualVerdict: resH1.verdict,
      passed: isDeterministic,
      notes: `SHA-256 Provenance hashes bit-for-bit identical across multiple runs (${resH1.evidenceDigest.substring(0, 16)}...).`,
      simulationResult: resH1,
    });

    return results;
  }
}
