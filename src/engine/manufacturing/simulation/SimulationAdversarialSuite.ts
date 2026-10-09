import { ToolpathSimulationEngine } from "./ToolpathSimulationEngine";
import { 
  ToolpathSimulationContract, 
  SimulationModel, 
  RemovalRepresentation, 
  SimulationVerdict 
} from "./types";
import { MachineProfileEngine } from "../post/MachineProfileEngine";
import { ControllerProfileEngine } from "../post/ControllerProfileEngine";
import { MachineLibrary } from "../kinematics/MachineLibrary";
import { SpindleDirection } from "../post/types";

export interface AdversarialSimulationResult {
  testId: string;
  name: string;
  expectedVerdict: SimulationVerdict;
  actualVerdict: SimulationVerdict;
  passed: boolean;
  notes: string;
}

export class SimulationAdversarialSuite {
  public async runSuite(): Promise<{ results: AdversarialSimulationResult[]; allPassed: boolean }> {
    const results: AdversarialSimulationResult[] = [];

    const machineLib = new MachineLibrary();
    const machine = machineLib.getMachine("HERMLE_C32")!;
    const controller = ControllerProfileEngine.createFanucLikeProfile();

    const baseContract: ToolpathSimulationContract = {
      simulationId: "ADV_TEST",
      simulationRevision: 1,
      toolpathId: "TP_ADV",
      toolpathRevision: 1,
      machineProfileId: machine.machineId,
      controllerProfileId: controller.controllerId,
      toolAssemblyId: "TOOL_ADV",
      stockModelId: "STOCK_ADV",
      fixtureModelId: "FIX_ADV",
      workpieceModelId: "WP_ADV",
      simulationPolicy: {
        representation: RemovalRepresentation.VOXEL,
        timeStep: 0.1,
        adaptiveSubdivision: true,
        precisionMM: 1.0
      },
      collisionPolicy: {
        enabled: true,
        stopOnCollision: true,
        clearanceThresholdMM: 2.0
      },
      tolerancePolicy: {
        gougeToleranceMM: 0.1,
        excessToleranceMM: 0.5
      },
      samplingPolicy: {
        minStepMM: 0.1,
        maxStepMM: 5.0,
        maxAngularStepDeg: 1.0
      }
    };

    const baseModel: SimulationModel = {
      machine,
      controller,
      tool: { id: "T1", name: "End Mill", geometry: { diameter: 10, fluteLength: 30 } } as any,
      holder: { objectId: "H1", name: "ER32 Holder", type: "TOOL_HOLDER", isActive: true, aabb: { min: { x: -20, y: -20, z: 0 }, max: { x: 20, y: 20, z: 60 } } } as any,
      spindle: { objectId: "S1", name: "Main Spindle", type: "SPINDLE", isActive: true, aabb: { min: { x: -60, y: -60, z: 60 }, max: { x: 60, y: 60, z: 260 } } } as any,
      stock: {
        stockId: "S1",
        type: "BOX",
        geometry: { objectId: "S1_G", type: "BOX", isActive: true, aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } } } as any,
        representation: RemovalRepresentation.VOXEL,
        resolution: 1.0,
        boundingBox: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } },
        volume: 100 * 100 * 50,
        coordinateSystem: "G54",
        fingerprint: "STOCK_01"
      },
      workpiece: { objectId: "WP1", type: "WORKPIECE", isActive: true, aabb: { min: { x: -40, y: -40, z: -40 }, max: { x: 40, y: 40, z: 0 } } } as any,
      fixture: [{ objectId: "F1", name: "Vise", type: "FIXTURE", isActive: true, aabb: { min: { x: -60, y: -60, z: -90 }, max: { x: 60, y: 60, z: -50 } } }] as any,
      coordinateSystems: {},
      toolpath: {
        toolpathId: "TP1",
        revision: 1,
        machineId: machine.machineId,
        points: [],
        tolerance: 0.01,
        coordinateSystem: "WORK_PIECE",
        provenance: {} as any
      }
    };

    // Test 1: Collision Detection
    const collisionTP = { ...baseModel.toolpath, points: [
      { position: { x: 0, y: 0, z: 100 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 1000, spindleSpeed: 0, spindleDirection: SpindleDirection.STOP, coolantState: {} as any, sequenceNumber: 1, toolNumber: 1, motionType: "RAPID" as const },
      { position: { x: 0, y: 0, z: -20 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 1000, spindleSpeed: 0, spindleDirection: SpindleDirection.STOP, coolantState: {} as any, sequenceNumber: 2, toolNumber: 1, motionType: "RAPID" as const }
    ] };
    // Adjust holder to be in a position where it hits fixture
    const collisionModel = { ...baseModel, toolpath: collisionTP };
    const engine1 = new ToolpathSimulationEngine(baseContract, collisionModel);
    const report1 = await engine1.runSimulation();
    results.push({
      testId: "SIM_ADV_01",
      name: "Collision with fixture detection",
      expectedVerdict: SimulationVerdict.COLLISION_DETECTED,
      actualVerdict: report1.verdict,
      passed: report1.verdict === SimulationVerdict.COLLISION_DETECTED,
      notes: "Detected collision between tool assembly and fixture"
    });

    // Test 2: Gouge Detection
    const gougeTP = { ...baseModel.toolpath, points: [
      { position: { x: 0, y: 0, z: 10 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 1000, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 1, toolNumber: 1, motionType: "RAPID" as const },
      { position: { x: 0, y: 0, z: -60 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 100, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 2, toolNumber: 1, motionType: "LINEAR" as const }
    ] };
    const gougeModel = { ...baseModel, toolpath: gougeTP };
    const engine2 = new ToolpathSimulationEngine(baseContract, gougeModel);
    const report2 = await engine2.runSimulation();
    results.push({
      testId: "SIM_ADV_02",
      name: "Excessive gouge detection",
      expectedVerdict: SimulationVerdict.GOUGE,
      actualVerdict: report2.verdict,
      passed: report2.verdict === SimulationVerdict.GOUGE,
      notes: "Detected tool going deeper than stock boundaries significantly"
    });

    // Test 3: Input Integrity
    const invalidModel = { ...baseModel, toolpath: { ...baseModel.toolpath, points: [] } };
    const engine3 = new ToolpathSimulationEngine(baseContract, invalidModel);
    const report3 = await engine3.runSimulation();
    results.push({
      testId: "SIM_ADV_03",
      name: "Invalid input integrity check",
      expectedVerdict: SimulationVerdict.INVALID,
      actualVerdict: report3.verdict,
      passed: report3.verdict === SimulationVerdict.INVALID,
      notes: "Detected empty toolpath before simulation"
    });

    return { results, allPassed: results.every(r => r.passed) };
  }
}

class KinematicMath {
  public static createIdentity() { return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]; }
}
