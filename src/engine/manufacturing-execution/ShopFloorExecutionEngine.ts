/**
 * PATCH-SECP-060 — Shop Floor Execution Engine
 * High-level cohesive coordinator that glues together sessions, machines,
 * tool consumption, material lots, events, safety checking, and part instances.
 */

import { 
  ManufacturingExecutionSession, 
  MachineExecutionState, 
  OperationExecutionState, 
  ToolConsumptionRecord, 
  MaterialLotRecord, 
  ManufacturedPartInstance, 
  ManufacturingExecutionEvent, 
  ExecutionSafetyGateReport 
} from './ManufacturingExecutionTypes';
import { ExecutionSessionEngine } from './ExecutionSessionEngine';
import { MachineExecutionStateEngine } from './MachineExecutionStateEngine';
import { OperationExecutionEngine } from './OperationExecutionEngine';
import { ToolConsumptionEngine } from './ToolConsumptionEngine';
import { MaterialTraceabilityEngine } from './MaterialTraceabilityEngine';
import { ExecutionEventEngine } from './ExecutionEventEngine';
import { ExecutionProvenanceEngine } from './ExecutionProvenanceEngine';

import { ManufacturingJob } from '../manufacturing-job/ManufacturingJobTypes';
import { ManufacturingExecutionPackage } from '../nc/NCExecutionTypes';

export class ShopFloorExecutionEngine {
  /**
   * Complete standard factory simulation sequence representing all steps of SECP-060:
   * 1. Initialize session
   * 2. Scan & Load raw stock material certificate
   * 3. Machine setup stage
   * 4. Safe tool setup and baseline wear loading
   * 5. Perform Safety Execution Gate Check
   * 6. Shift machine to READY, then RUNNING
   * 7. Cycle operations (OP10 to OP50) with events
   * 8. Trigger physical fault simulation & recover
   * 9. Complete cycle, sign physical parts, record wear, seal log chain
   */
  public static runFullExecutionSimulation(
    sessionId: string,
    job: ManufacturingJob,
    execPackage: ManufacturingExecutionPackage,
    operatorId: string,
    scannedMaterialLotId: string,
    scannedMillCert: string,
    scannedNCOrPackageHash: string
  ): {
    session: ManufacturingExecutionSession;
    events: ManufacturingExecutionEvent[];
    safetyGate: ExecutionSafetyGateReport;
    producedParts: ManufacturedPartInstance[];
    sealedChainHash: string;
  } {
    const events: ManufacturingExecutionEvent[] = [];

    // Step 1: Session init
    const session = ExecutionSessionEngine.initializeSession(
      sessionId,
      job,
      operatorId,
      scannedNCOrPackageHash
    );

    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-init`,
        sessionId,
        job.jobId,
        session.machineId,
        'SESSION_INITIALIZED',
        'OPERATOR_CONSOLE',
        undefined,
        'ACTIVE',
        undefined,
        'Session initialization on shop floor'
      )
    );

    // Step 2: Material verification (060-E)
    const lot = MaterialTraceabilityEngine.createMaterialLot(
      scannedMaterialLotId,
      job.materialType,
      '50mm x 50mm x 150mm',
      scannedMillCert,
      120 // Brinell Hardness
    );
    session.verifiedMaterialLot = lot;

    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-material-lot`,
        sessionId,
        job.jobId,
        session.machineId,
        'MATERIAL_LOT_VERIFIED',
        'BARCODE_SCANNER',
        undefined,
        lot.materialLotId,
        undefined,
        JSON.stringify(lot)
      )
    );

    // Step 3: Machine Setup (060-B)
    const prevMachineState = session.machineState;
    session.machineState = MachineExecutionStateEngine.transitionState(prevMachineState, 'SETUP');

    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-setup`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_STATE_SHIFT',
        'CNC_CONTROLLER',
        prevMachineState,
        'SETUP'
      )
    );

    // Step 4: Map Tool Setup Wear Baselines (060-E)
    const clPkg = execPackage.verifiedCLData;
    clPkg.trajectories.forEach((traj, idx) => {
      const tId = traj.tool.toolId;
      session.toolConsumption[tId] = ToolConsumptionEngine.createToolRecord(
        tId,
        'REV-A',
        3600 // 1 hour threshold
      );

      // Record base setup offsets
      session.toolConsumption[tId] = ToolConsumptionEngine.updateMeasuredOffset(
        session.toolConsumption[tId],
        0.002 // 2 microns setup wear offset
      );

      events.push(
        ExecutionEventEngine.createEvent(
          `ev-${sessionId}-tool-setup-${idx}`,
          sessionId,
          job.jobId,
          session.machineId,
          'TOOL_CONSUMED',
          'OPERATOR_CONSOLE',
          undefined,
          tId,
          undefined,
          JSON.stringify(session.toolConsumption[tId])
        )
      );
    });

    // Step 5: Run safety gate check (060-G)
    const isOperatorCertified = true;
    const isJobActive = true;
    const unresolvedECNs = 0;
    const safetyGate = ExecutionSessionEngine.runSafetyGateCheck(
      session,
      execPackage,
      isOperatorCertified,
      isJobActive,
      unresolvedECNs
    );

    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-safety-gate`,
        sessionId,
        job.jobId,
        session.machineId,
        'SAFETY_GATE_TRIGGERED',
        'SAFETY_GATE_DAEMON',
        undefined,
        safetyGate.isReadyToRun ? 'PASS' : 'FAIL',
        undefined,
        JSON.stringify(safetyGate)
      )
    );

    if (!safetyGate.isReadyToRun) {
      session.sessionStatus = 'HALTED';
      session.machineState = 'OFFLINE';
      return {
        session,
        events,
        safetyGate,
        producedParts: [],
        sealedChainHash: 'SECP-060-SEAL-BLOCKED'
      };
    }

    // Step 6: Shift machine to READY then RUNNING (060-B)
    session.machineState = MachineExecutionStateEngine.transitionState(session.machineState, 'READY');
    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-ready`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_STATE_SHIFT',
        'CNC_CONTROLLER',
        'SETUP',
        'READY'
      )
    );

    session.machineState = MachineExecutionStateEngine.transitionState(session.machineState, 'RUNNING');
    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-running`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_STATE_SHIFT',
        'CNC_CONTROLLER',
        'READY',
        'RUNNING'
      )
    );

    // Step 7: Process Operations Sequences with Events (060-C)
    job.routing.forEach(op => {
      session.currentOperationId = op.operationId;
      session.currentOperationState = 'STARTED';

      events.push(
        ExecutionEventEngine.createEvent(
          `ev-${sessionId}-op-${op.sequenceNumber}-started`,
          sessionId,
          job.jobId,
          session.machineId,
          'OPERATION_STATE_SHIFT',
          'OPERATOR_CONSOLE',
          'NOT_STARTED',
          'STARTED',
          op.operationId
        )
      );

      session.currentOperationState = 'RUNNING';
      events.push(
        ExecutionEventEngine.createEvent(
          `ev-${sessionId}-op-${op.sequenceNumber}-running`,
          sessionId,
          job.jobId,
          session.machineId,
          'OPERATION_STATE_SHIFT',
          'CNC_CONTROLLER',
          'STARTED',
          'RUNNING',
          op.operationId
        )
      );

      // Simulate a tool usage incremental feed (wear accumulation) (060-E)
      const opToolId = op.resources.toolIds[0];
      if (opToolId && session.toolConsumption[opToolId]) {
        session.toolConsumption[opToolId] = ToolConsumptionEngine.incrementUsage(
          session.toolConsumption[opToolId],
          450 // 7.5 mins active spindle run
        );
      }

      session.currentOperationState = 'COMPLETED';
      events.push(
        ExecutionEventEngine.createEvent(
          `ev-${sessionId}-op-${op.sequenceNumber}-completed`,
          sessionId,
          job.jobId,
          session.machineId,
          'OPERATION_STATE_SHIFT',
          'CNC_CONTROLLER',
          'RUNNING',
          'COMPLETED',
          op.operationId
        )
      );
    });

    // Step 8: Physical spindle fault simulation & recover (060-H)
    session.machineState = MachineExecutionStateEngine.transitionState(session.machineState, 'FAULT');
    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-fault`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_FAULT_RECORDED',
        'CNC_CONTROLLER',
        'RUNNING',
        'FAULT',
        undefined,
        'Spindle torque over-current warning'
      )
    );

    // Recovery path
    session.machineState = MachineExecutionStateEngine.transitionState(session.machineState, 'RUNNING');
    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-recover`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_FAULT_RECOVERED',
        'CNC_CONTROLLER',
        'FAULT',
        'RUNNING',
        undefined,
        'Torque limits reset and recovery complete'
      )
    );

    // Step 9: Complete execution session, sign physical manufactured parts (060-I)
    session.machineState = MachineExecutionStateEngine.transitionState(session.machineState, 'COMPLETED');
    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-mach-completed`,
        sessionId,
        job.jobId,
        session.machineId,
        'MACHINE_STATE_SHIFT',
        'CNC_CONTROLLER',
        'RUNNING',
        'COMPLETED'
      )
    );

    const producedParts: ManufacturedPartInstance[] = [];
    const unitCountToProduce = 3; // Produce 3 serialized units
    for (let i = 1; i <= unitCountToProduce; i++) {
      const pInstance = ExecutionProvenanceEngine.signPartInstance(
        `part-${sessionId}-unit-${i}`,
        job.partId,
        job.partRevision,
        job.jobId,
        `SN-${lot.materialType}-060-${i}`,
        lot.materialLotId,
        Object.keys(session.toolConsumption),
        session.machineId,
        execPackage.clDataHash,
        execPackage.ncProgramHash
      );
      producedParts.push(pInstance);
      session.partInstances.push(pInstance);

      events.push(
        ExecutionEventEngine.createEvent(
          `ev-${sessionId}-part-serial-${i}`,
          sessionId,
          job.jobId,
          session.machineId,
          'PART_INSTANCE_COMPLETED',
          'BARCODE_SCANNER',
          undefined,
          pInstance.partInstanceId,
          undefined,
          JSON.stringify(pInstance)
        )
      );
    }

    session.sessionStatus = 'COMPLETED';
    session.timestampEnd = new Date().toISOString();

    events.push(
      ExecutionEventEngine.createEvent(
        `ev-${sessionId}-session-end`,
        sessionId,
        job.jobId,
        session.machineId,
        'SESSION_FINALIZED',
        'OPERATOR_CONSOLE',
        'ACTIVE',
        'COMPLETED'
      )
    );

    const sealedChainHash = ExecutionProvenanceEngine.sealSessionLogs(events);

    return {
      session,
      events,
      safetyGate,
      producedParts,
      sealedChainHash
    };
  }
}
