/**
 * SECP-260 — Stock Simulation Reference Benchmarks (A through G)
 * Standardized industrial validation scenarios:
 * - BM_A: Simple Pocket (Ø10 Flat Endmill)
 * - BM_B: Through Hole (Ø12 Drill)
 * - BM_C: Complex Pocket with Island
 * - BM_D: 4-Axis Rotary Indexing
 * - BM_E: 5-Axis Sculpted Surface Sweep
 * - BM_F: Intentional Gouge Detection
 * - BM_G: Between-Points Continuous Removal (Tunneling Prevention)
 */

import { 
  Vector3D,
  vec3,
  StockDefinition, 
  ToolGeometry, 
  ToolPose, 
  ToolpathSegment, 
  TargetCadGeometry, 
  StockSimulationResult 
} from './StockTypes';
import { StockSimulationEngine } from './StockSimulationEngine';
import { StockCoordinateTransform } from './StockCoordinateTransform';

export class StockBenchmarks {
  /**
   * Benchmark A — Simple Pocket Machining
   */
  public static runBenchmarkA(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-A',
      name: 'Block Raw Stock 100x60x30',
      geometryType: 'BOUNDING_BOX',
      dimensions: { lengthMm: 100, widthMm: 60, heightMm: 30 },
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 60, minZ: 0, maxZ: 30 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0),
        vec3(1, 0, 0),
        vec3(0, 1, 0),
        vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'AL6061',
        materialName: 'Aluminum 6061-T6',
        densityGPerCm3: 2.7,
        machinabilityRatingPercent: 85,
        specificCuttingForceKc1_1: 750
      },
      initialVolumeMm3: 180000,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-A-AL6061'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-EM-10',
      name: 'Ø10mm 4-Flute Carbide Flat Endmill',
      cutterType: 'FLAT_ENDMILL',
      diameterMm: 10,
      cornerRadMm: 0,
      fluteLengthMm: 25,
      overallLengthMm: 75,
      shankDiameterMm: 10,
      fluteCount: 4,
      sha256Hash: 'SHA-TOOL-EM-10'
    };

    const segments: ToolpathSegment[] = [
      // Plunge into pocket
      {
        segmentIndex: 0,
        operationId: 'OP-POCKET-ROUGH',
        operationName: 'Pocket Plunge Z-5',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'P0',
          tcp: vec3(20, 20, 35),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 500,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'P1',
          tcp: vec3(20, 20, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 500,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 500,
        spindleRpm: 8000,
        motionType: 'LINEAR'
      },
      // Linear Slot Cut
      {
        segmentIndex: 1,
        operationId: 'OP-POCKET-ROUGH',
        operationName: 'Pocket Pass 1 X80',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'P1',
          tcp: vec3(20, 20, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 1200,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'P2',
          tcp: vec3(80, 20, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 1200,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 1200,
        spindleRpm: 8000,
        motionType: 'LINEAR'
      },
      // Linear Pass 2 Y40
      {
        segmentIndex: 2,
        operationId: 'OP-POCKET-ROUGH',
        operationName: 'Pocket Pass 2 Y40',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'P2',
          tcp: vec3(80, 20, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 1200,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'P3',
          tcp: vec3(80, 40, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 1200,
          spindleRpm: 8000,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 1200,
        spindleRpm: 8000,
        motionType: 'LINEAR'
      }
    ];

    const targetCad: TargetCadGeometry = {
      cadId: 'CAD-BM-A-POCKET',
      name: 'Nominal Part with Pocket',
      bounds: stock.bounds,
      targetVolumeMm3: 172000,
      triangles: [],
      sha256Hash: 'SHA-CAD-BM-A'
    };

    return StockSimulationEngine.executeSimulation(stock, segments, targetCad, 'DEXEL', 'STANDARD');
  }

  /**
   * Benchmark B — Through Hole Drilling
   */
  public static runBenchmarkB(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-B',
      name: 'Plate 80x80x20',
      geometryType: 'BOUNDING_BOX',
      dimensions: { lengthMm: 80, widthMm: 80, heightMm: 20 },
      bounds: { minX: 0, maxX: 80, minY: 0, maxY: 80, minZ: 0, maxZ: 20 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'STEEL1018',
        materialName: 'Low Carbon Steel 1018',
        densityGPerCm3: 7.85,
        machinabilityRatingPercent: 65,
        specificCuttingForceKc1_1: 1800
      },
      initialVolumeMm3: 128000,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-B'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-DRILL-12',
      name: 'Ø12mm Carbide Twist Drill',
      cutterType: 'DRILL',
      diameterMm: 12,
      cornerRadMm: 0,
      fluteLengthMm: 45,
      overallLengthMm: 90,
      shankDiameterMm: 12,
      tipAngleDeg: 118,
      fluteCount: 2,
      sha256Hash: 'SHA-TOOL-DRILL-12'
    };

    const segments: ToolpathSegment[] = [
      {
        segmentIndex: 0,
        operationId: 'OP-DRILL-HOLE',
        operationName: 'Drill Through Hole Z-3',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'D0',
          tcp: vec3(40, 40, 25),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 250,
          spindleRpm: 2200,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'D1',
          tcp: vec3(40, 40, -3), // Through past bottom Z0
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 250,
          spindleRpm: 2200,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 250,
        spindleRpm: 2200,
        motionType: 'LINEAR'
      }
    ];

    return StockSimulationEngine.executeSimulation(stock, segments, undefined, 'DEXEL', 'STANDARD');
  }

  /**
   * Benchmark D — 4-Axis Rotary Machining
   */
  public static runBenchmarkD(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-D',
      name: 'Rotary Billet Ø50x120',
      geometryType: 'CYLINDRICAL',
      dimensions: { diameterMm: 50, lengthMm: 120, heightMm: 50 },
      bounds: { minX: 0, maxX: 120, minY: -25, maxY: 25, minZ: -25, maxZ: 25 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'TI6AL4V',
        materialName: 'Titanium Grade 5',
        densityGPerCm3: 4.43,
        machinabilityRatingPercent: 35,
        specificCuttingForceKc1_1: 2200
      },
      initialVolumeMm3: 235619,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-D'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-BALL-8',
      name: 'Ø8mm Ball Endmill',
      cutterType: 'BALL_ENDMILL',
      diameterMm: 8,
      cornerRadMm: 4,
      fluteLengthMm: 20,
      overallLengthMm: 70,
      shankDiameterMm: 8,
      fluteCount: 2,
      sha256Hash: 'SHA-TOOL-BALL-8'
    };

    const segments: ToolpathSegment[] = [
      {
        segmentIndex: 0,
        operationId: 'OP-4AXIS-INDEX',
        operationName: 'Rotary Pass A0',
        stage: 'SEMI_FINISHING',
        startPose: {
          poseId: 'R0',
          tcp: vec3(10, 0, 20),
          toolAxis: vec3(0, 0, 1),
          machineJoints: { x: 10, y: 0, z: 20, a: 0 },
          feedRateMmMin: 800,
          spindleRpm: 6000,
          motionType: 'FOUR_AXIS_ROTARY'
        },
        endPose: {
          poseId: 'R1',
          tcp: vec3(100, 0, 20),
          toolAxis: vec3(0, 0, 1),
          machineJoints: { x: 100, y: 0, z: 20, a: 0 },
          feedRateMmMin: 800,
          spindleRpm: 6000,
          motionType: 'FOUR_AXIS_ROTARY'
        },
        tool,
        feedRateMmMin: 800,
        spindleRpm: 6000,
        motionType: 'FOUR_AXIS_ROTARY'
      }
    ];

    return StockSimulationEngine.executeSimulation(stock, segments, undefined, 'DEXEL', 'STANDARD');
  }

  /**
   * Benchmark E — 5-Axis Sculpted Surface Sweep
   */
  public static runBenchmarkE(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-E',
      name: 'Sculpted Block 100x100x40',
      geometryType: 'BOUNDING_BOX',
      dimensions: { lengthMm: 100, widthMm: 100, heightMm: 40 },
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 40 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'AL7075',
        materialName: 'Aluminum 7075-T6',
        densityGPerCm3: 2.81,
        machinabilityRatingPercent: 80,
        specificCuttingForceKc1_1: 850
      },
      initialVolumeMm3: 400000,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-E'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-BULL-10',
      name: 'Ø10mm Bullnose (R2) Endmill',
      cutterType: 'BULLNOSE',
      diameterMm: 10,
      cornerRadMm: 2,
      fluteLengthMm: 25,
      overallLengthMm: 80,
      shankDiameterMm: 10,
      fluteCount: 4,
      sha256Hash: 'SHA-TOOL-BULL-10'
    };

    const segments: ToolpathSegment[] = [
      {
        segmentIndex: 0,
        operationId: 'OP-5AXIS-SWARF',
        operationName: '5-Axis Simultaneous Flank Swarf',
        stage: 'FINISHING',
        startPose: {
          poseId: 'S0',
          tcp: vec3(20, 20, 35),
          toolAxis: vec3(0.2, 0.1, 0.974), // Tilted orientation
          machineJoints: { x: 20, y: 20, z: 35, a: 15, c: 30 },
          feedRateMmMin: 1500,
          spindleRpm: 10000,
          motionType: 'FIVE_AXIS_SIMULTANEOUS'
        },
        endPose: {
          poseId: 'S1',
          tcp: vec3(80, 80, 35),
          toolAxis: vec3(-0.2, 0.2, 0.959), // Smoothly varying orientation
          machineJoints: { x: 80, y: 80, z: 35, a: -15, c: 75 },
          feedRateMmMin: 1500,
          spindleRpm: 10000,
          motionType: 'FIVE_AXIS_SIMULTANEOUS'
        },
        tool,
        feedRateMmMin: 1500,
        spindleRpm: 10000,
        motionType: 'FIVE_AXIS_SIMULTANEOUS'
      }
    ];

    return StockSimulationEngine.executeSimulation(stock, segments, undefined, 'DEXEL', 'STANDARD');
  }

  /**
   * Benchmark F — Intentional Gouge Detection
   */
  public static runBenchmarkF(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-F',
      name: 'Test Block 100x60x30',
      geometryType: 'BOUNDING_BOX',
      dimensions: { lengthMm: 100, widthMm: 60, heightMm: 30 },
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 60, minZ: 0, maxZ: 30 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'AL6061',
        materialName: 'Aluminum 6061',
        densityGPerCm3: 2.7,
        machinabilityRatingPercent: 85,
        specificCuttingForceKc1_1: 750
      },
      initialVolumeMm3: 180000,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-F'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-EM-10',
      name: 'Ø10mm Flat Endmill',
      cutterType: 'FLAT_ENDMILL',
      diameterMm: 10,
      cornerRadMm: 0,
      fluteLengthMm: 25,
      overallLengthMm: 75,
      shankDiameterMm: 10,
      fluteCount: 4,
      sha256Hash: 'SHA-TOOL-EM-10'
    };

    // Deep plunge that gouges beyond nominal floor Z15
    const segments: ToolpathSegment[] = [
      {
        segmentIndex: 0,
        operationId: 'OP-GOUGE-FAULT',
        operationName: 'Erroneous Deep Cut Z12',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'G0',
          tcp: vec3(50, 30, 30),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 800,
          spindleRpm: 6000,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'G1',
          tcp: vec3(50, 30, 12), // 3mm below nominal floor Z15
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 800,
          spindleRpm: 6000,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 800,
        spindleRpm: 6000,
        motionType: 'LINEAR'
      }
    ];

    const targetCad: TargetCadGeometry = {
      cadId: 'CAD-BM-F-POCKET',
      name: 'Nominal Floor at Z15',
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 60, minZ: 15, maxZ: 30 },
      targetVolumeMm3: 150000,
      triangles: [],
      sha256Hash: 'SHA-CAD-BM-F'
    };

    return StockSimulationEngine.executeSimulation(stock, segments, targetCad, 'DEXEL', 'STANDARD');
  }

  /**
   * Benchmark G — Continuous CCD Between Points Removal
   */
  public static runBenchmarkG(): StockSimulationResult {
    const stock: StockDefinition = {
      stockId: 'STOCK-BM-G',
      name: 'Stock Wall 100x20x30',
      geometryType: 'BOUNDING_BOX',
      dimensions: { lengthMm: 100, widthMm: 20, heightMm: 30 },
      bounds: { minX: 0, maxX: 100, minY: 0, maxY: 20, minZ: 0, maxZ: 30 },
      coordinateSystem: StockCoordinateTransform.createCoordinateSystem(
        vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)
      ),
      materialMetadata: {
        materialId: 'AL6061',
        materialName: 'Aluminum 6061',
        densityGPerCm3: 2.7,
        machinabilityRatingPercent: 85,
        specificCuttingForceKc1_1: 750
      },
      initialVolumeMm3: 60000,
      resolutionMm: 1.0,
      toleranceMm: 0.05,
      sha256Hash: 'SHA-STOCK-BM-G'
    };

    const tool: ToolGeometry = {
      toolId: 'TOOL-EM-10',
      name: 'Ø10mm Flat Endmill',
      cutterType: 'FLAT_ENDMILL',
      diameterMm: 10,
      cornerRadMm: 0,
      fluteLengthMm: 25,
      overallLengthMm: 75,
      shankDiameterMm: 10,
      fluteCount: 4,
      sha256Hash: 'SHA-TOOL-EM-10'
    };

    // Fast 50mm single move across wall
    const segments: ToolpathSegment[] = [
      {
        segmentIndex: 0,
        operationId: 'OP-CCD-CONTINUOUS',
        operationName: 'High-speed Sweep Pass X10->X90',
        stage: 'ROUGHING',
        startPose: {
          poseId: 'C0',
          tcp: vec3(10, 10, 20),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 2000,
          spindleRpm: 12000,
          motionType: 'LINEAR'
        },
        endPose: {
          poseId: 'C1',
          tcp: vec3(90, 10, 20),
          toolAxis: vec3(0, 0, 1),
          feedRateMmMin: 2000,
          spindleRpm: 12000,
          motionType: 'LINEAR'
        },
        tool,
        feedRateMmMin: 2000,
        spindleRpm: 12000,
        motionType: 'LINEAR'
      }
    ];

    return StockSimulationEngine.executeSimulation(stock, segments, undefined, 'DEXEL', 'STANDARD');
  }
}
