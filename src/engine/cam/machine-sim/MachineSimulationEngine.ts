/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Central Orchestrator: Comprehensive CNC Machine Execution & Verification Simulator
 */

import {
  MachineSimulationInput,
  MachineSimulationResult,
  SimulationTolerances,
  SimulationVerdict,
  AxisPositionState,
  Vector3D,
} from './MachineSimulationTypes';
import { NCInterpreter } from './NCInterpreter';
import { MachineKinematicModel } from './MachineKinematicModel';
import { AxisSimulator } from './AxisSimulator';
import { MachineEnvelopeChecker } from './MachineEnvelopeChecker';
import { ToolAssemblyModel } from './ToolAssemblyModel';
import { MachineCollisionEngine } from './MachineCollisionEngine';
import { MaterialRemovalEngine } from './MaterialRemovalEngine';
import { KinematicContinuityAnalyzer } from './KinematicContinuityAnalyzer';
import { CycleTimeCalculator } from './CycleTimeCalculator';
import { SimulationRecorder } from './SimulationTimeline';
import { MachineSimulationValidator } from './MachineSimulationValidator';
import { SimulationEvidenceGenerator } from './SimulationEvidenceGenerator';

export class MachineSimulationEngine {
  private defaultTolerances: SimulationTolerances = {
    collisionClearanceMm: 1.0,
    holderClearanceMm: 2.0,
    fixtureClearanceMm: 2.0,
    stockDeviationToleranceMm: 0.05,
    gougeToleranceMm: 0.01,
    angularDiscontinuityThresholdDeg: 15.0,
    singularityAngleThresholdDeg: 0.5,
    minSamplingStepMm: 0.5,
    maxSamplingStepMm: 5.0,
    adaptiveSubdivisionLevel: 2,
  };

  /**
   * Executes the full end-to-end Machine Simulation
   */
  public runSimulation(input: MachineSimulationInput): MachineSimulationResult {
    const startTimeMs = Date.now();
    const tolerances: SimulationTolerances = {
      ...this.defaultTolerances,
      ...input.tolerances,
    };

    // 1. Preflight Validation
    const preflight = MachineSimulationValidator.validateInput(input);
    if (!preflight.valid && preflight.verdict) {
      return this.buildBlockedOrFailedResult(input, preflight.verdict, preflight.message, startTimeMs);
    }

    // 2. Initialize Subsystems
    const interpreter = new NCInterpreter(input.controller);
    const kinematicModel = new MachineKinematicModel(input.machine);
    const axisSimulator = new AxisSimulator(input.machine);
    const envelopeChecker = new MachineEnvelopeChecker(input.machine);
    const collisionEngine = new MachineCollisionEngine(tolerances);
    const materialRemoval = new MaterialRemovalEngine(input.stock, tolerances);
    const continuityAnalyzer = new KinematicContinuityAnalyzer(tolerances);
    const cycleTimeCalc = new CycleTimeCalculator(input.machine);
    const recorder = new SimulationRecorder();

    // Active tool state
    let activeToolNumber = 1;
    let activeToolAssembly = new ToolAssemblyModel(
      input.tools.get(activeToolNumber) || {
        id: 'T01_DEFAULT',
        name: 'Default Endmill',
        type: 'FLAT_ENDMILL',
        cuttingDiameter: 10,
        fluteLength: 25,
        overallLength: 75,
        flutesCount: 4,
        cornerType: 'SHARP',
      },
      input.holders.get(activeToolNumber)
    );

    const wcsOffset: Vector3D = input.wcsOffsets[interpreter.getModalState().activeWcs] || { x: 0, y: 0, z: 0 };
    let currentAxes: AxisPositionState = axisSimulator.getHomePositions();
    let currentTimestampSec = 0;
    let totalRemovedVolMm3 = 0;

    const lines = input.ncProgram.split('\n');

    // 3. Line-by-Line Execution Loop
    for (let blockIdx = 0; blockIdx < lines.length; blockIdx++) {
      const rawLine = lines[blockIdx].trim();
      if (!rawLine) continue;

      const command = interpreter.interpretLine(rawLine, blockIdx);
      const modal = interpreter.getModalState();

      // Tool Change Handling
      if (command.commandType === 'TOOL_CHANGE' && command.toolNumber) {
        activeToolNumber = command.toolNumber;
        const toolDef = input.tools.get(activeToolNumber) || {
          id: `T${activeToolNumber}`,
          name: `Tool ${activeToolNumber}`,
          type: 'FLAT_ENDMILL',
          cuttingDiameter: 10,
          fluteLength: 25,
          overallLength: 75,
          flutesCount: 4,
          cornerType: 'SHARP',
        };
        activeToolAssembly = new ToolAssemblyModel(toolDef, input.holders.get(activeToolNumber));
        cycleTimeCalc.addToolChange();
        currentTimestampSec += input.machine.toolChanger.toolChangeTimeSec;
      }

      // Spindle & Dwell Handling
      if (command.commandType === 'SPINDLE_CHANGE') {
        cycleTimeCalc.addSpindleRampTime();
        currentTimestampSec += input.machine.spindle.accelerationTimeSec;
        if (command.spindleRpm) {
          const spinViolation = envelopeChecker.checkSpindleLimit(command.spindleRpm, blockIdx, currentTimestampSec, rawLine);
          if (spinViolation) recorder.recordViolation(spinViolation);
        }
      }

      if (command.commandType === 'DWELL' && command.dwellSec) {
        cycleTimeCalc.addAuxiliaryTime(command.dwellSec);
        currentTimestampSec += command.dwellSec;
      }

      // Motion Handling & Interpolation
      if (command.commandType === 'MOTION') {
        const feedrate = command.feedrate || modal.feedrate || 1000;
        const isRapid = command.isRapid;

        if (!isRapid) {
          const feedViolation = envelopeChecker.checkFeedLimit(feedrate, blockIdx, currentTimestampSec, rawLine);
          if (feedViolation) recorder.recordViolation(feedViolation);
        }

        const subSteps = axisSimulator.interpolateMotion(
          currentAxes,
          command.targetAxes,
          feedrate,
          isRapid,
          tolerances
        );

        for (const step of subSteps) {
          currentAxes = { ...step.axes };
          currentTimestampSec += step.durationSec;

          if (step.isRapid) {
            cycleTimeCalc.addRapidTime(step.durationSec);
          } else {
            cycleTimeCalc.addCuttingTime(step.durationSec);
          }

          // Compute Forward Kinematic Pose
          const toolGauge = activeToolAssembly.getTool().overallLength + (activeToolAssembly.getHolder()?.gaugeLength || 60);
          const pose = kinematicModel.computeForwardKinematics(currentAxes, toolGauge, wcsOffset);

          // 1. Envelope & Stroke Check
          const strokeViolations = envelopeChecker.checkAxisLimits(currentAxes, blockIdx, currentTimestampSec, rawLine);
          for (const viol of strokeViolations) {
            recorder.recordViolation(viol);
          }

          // 2. Collision Detection
          const stepCollisions = collisionEngine.evaluatePoseCollisions(
            pose,
            activeToolAssembly,
            input.fixture,
            input.stock,
            step.isRapid,
            blockIdx,
            currentTimestampSec,
            rawLine
          );
          for (const coll of stepCollisions) {
            recorder.recordCollision(coll);
          }

          // 3. Material Removal & Gouge Detection
          const removedThisStep = materialRemoval.removeMaterial(pose, activeToolAssembly, command.isCutting && modal.spindleState !== 'STOPPED');
          totalRemovedVolMm3 += removedThisStep;

          // 4. Kinematic Continuity & Singularity Analysis
          const anomalies = continuityAnalyzer.analyzePoseContinuity(pose, blockIdx, currentTimestampSec);
          for (const anom of anomalies) {
            recorder.recordAnomaly(anom);
          }

          // 5. Record Machine State Snapshot
          recorder.recordSnapshot({
            stepIndex: recorder.getSnapshots().length,
            blockIndex: blockIdx,
            timestampSec: currentTimestampSec,
            rawGCodeLine: rawLine,
            modal: { ...modal },
            pose,
            feedActualMmMin: step.segmentFeedrateMmMin,
            isCutting: command.isCutting,
            materialRemovedMm3: removedThisStep,
            totalMaterialRemovedMm3: totalRemovedVolMm3,
            activeCollisions: stepCollisions,
            activeViolations: strokeViolations,
          });
        }
      }
    }

    const endTimeMs = Date.now();
    const stockResult = materialRemoval.getFinalStockResult();
    const cycleTime = cycleTimeCalc.computeBreakdown();
    const collisions = recorder.getCollisions();
    const violations = recorder.getViolations();
    const anomalies = recorder.getAnomalies();

    // 4. Evaluate Verdict
    const verdict = this.determineVerdict(collisions, violations, stockResult, anomalies, tolerances);

    const result: MachineSimulationResult = {
      id: `MSIM-${Date.now().toString(36).toUpperCase()}`,
      verdict,
      executionStatus: 'COMPLETED',
      startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - startTimeMs,
      totalBlocks: lines.length,
      totalSimulationSteps: recorder.getSnapshots().length,
      cycleTime,
      collisions,
      limitViolations: violations,
      kinematicAnomalies: anomalies,
      stockResult,
      toolChangesCount: 1,
      snapshots: recorder.getSnapshots(),
      evidenceDigest: '',
      summary: {
        passed: verdict === 'SIMULATION_PASSED' || verdict === 'PASSED_WITH_WARNINGS',
        collisionFree: collisions.length === 0,
        limitsRespected: violations.length === 0,
        stockWithinTolerance: stockResult.maxGougeDepthMm <= tolerances.gougeToleranceMm,
        kinematicContinuous: anomalies.filter(a => a.severity === 'ERROR').length === 0,
        verdictMessage: this.getVerdictMessage(verdict, collisions.length, violations.length, stockResult.gougeCount),
      },
    };

    // 5. Generate Cryptographic Evidence
    const evidence = SimulationEvidenceGenerator.generateEvidence(input, result, tolerances);
    result.evidenceDigest = evidence.cryptographicSignature;

    return result;
  }

  private determineVerdict(
    collisions: any[],
    violations: any[],
    stock: any,
    anomalies: any[],
    tolerances: SimulationTolerances
  ): SimulationVerdict {
    if (collisions.length > 0) return 'COLLISION_DETECTED';
    if (violations.some(v => v.limitType === 'HARD_LIMIT' || v.limitType === 'ROTARY_LIMIT')) return 'AXIS_LIMIT_FAILURE';
    if (stock.maxGougeDepthMm > tolerances.gougeToleranceMm) return 'STOCK_DEVIATION';
    if (anomalies.some(a => a.severity === 'ERROR')) return 'KINEMATIC_FAILURE';
    if (violations.length > 0 || anomalies.length > 0) return 'PASSED_WITH_WARNINGS';
    return 'SIMULATION_PASSED';
  }

  private getVerdictMessage(verdict: SimulationVerdict, collCount: number, violCount: number, gougeCount: number): string {
    switch (verdict) {
      case 'SIMULATION_PASSED':
        return 'Machine Simulation verified completely: 0 collisions, 0 axis limit violations, and 0 stock gouges.';
      case 'PASSED_WITH_WARNINGS':
        return `Simulation completed with minor warnings (${violCount} soft-limit/speed warnings).`;
      case 'COLLISION_DETECTED':
        return `Machine collision detected: ${collCount} interference event(s) recorded. Execution unsafe.`;
      case 'AXIS_LIMIT_FAILURE':
        return `Axis travel limits exceeded (${violCount} violation(s)). Program exceeds physical machine stroke.`;
      case 'STOCK_DEVIATION':
        return `Workpiece gouge detected: Cutter exceeded finished surface tolerance (${gougeCount} gouge point(s)).`;
      case 'KINEMATIC_FAILURE':
        return 'Kinematic anomaly failure: Rotary flip or orientation discontinuity detected.';
      case 'MACHINE_SIMULATION_BLOCKED':
        return 'Simulation blocked due to failed preflight or G-code verification gate.';
      default:
        return `Simulation ended with verdict ${verdict}.`;
    }
  }

  private buildBlockedOrFailedResult(
    input: MachineSimulationInput,
    verdict: SimulationVerdict,
    message: string,
    startTimeMs: number
  ): MachineSimulationResult {
    const endTimeMs = Date.now();
    return {
      id: `MSIM-BLOCKED-${Date.now().toString(36).toUpperCase()}`,
      verdict,
      executionStatus: verdict === 'MACHINE_SIMULATION_BLOCKED' ? 'BLOCKED' : 'DIAGNOSTIC_TERMINATED',
      startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - startTimeMs,
      totalBlocks: 0,
      totalSimulationSteps: 0,
      cycleTime: {
        rapidTimeSec: 0,
        cuttingTimeSec: 0,
        toolChangeTimeSec: 0,
        auxiliaryTimeSec: 0,
        idleTimeSec: 0,
        totalTimeSec: 0,
        cuttingPercentage: 0,
        rapidPercentage: 0,
        toolChangePercentage: 0,
      },
      collisions: [],
      limitViolations: [],
      kinematicAnomalies: [],
      stockResult: {
        initialHash: input.stock?.initialHash || 'STK-0000',
        finalHash: input.stock?.initialHash || 'STK-0000',
        totalVolumeRemovedMm3: 0,
        initialStockVolumeMm3: 0,
        remainingStockVolumeMm3: 0,
        maxGougeDepthMm: 0,
        gougeCount: 0,
        meanDeviationMm: 0,
        maxDeviationMm: 0,
        gougeLocations: [],
      },
      toolChangesCount: 0,
      snapshots: [],
      evidenceDigest: 'BLOCKED_BY_GATE',
      summary: {
        passed: false,
        collisionFree: false,
        limitsRespected: false,
        stockWithinTolerance: false,
        kinematicContinuous: false,
        verdictMessage: message,
      },
    };
  }
}
