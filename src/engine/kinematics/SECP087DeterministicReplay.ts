/**
 * SECP087DeterministicReplay.ts
 *
 * Deterministic Replay Engine for 5-Axis Machine Simulation.
 * Guarantees: Same Toolpath + Same Machine Configuration = Same State Sequence & Hash Digest.
 */

import { FiveAxisToolpath, NurbsSurfacePatch } from '../classa5axis/SECP083Types';
import { DeterministicReplayResult, MachineConfiguration } from './SECP087Types';
import { SECP087ToolpathSimulator } from './SECP087ToolpathSimulator';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';
import { SystemProvenanceEngine } from '../validation/SystemProvenanceEngine';

export class SECP087DeterministicReplay {

  /**
   * Run simulation twice and verify 100% state hash equality & deterministic reproducibility
   */
  public static verifyDeterministicReplay(
    toolpath: FiveAxisToolpath,
    surface: NurbsSurfacePatch,
    config: MachineConfiguration
  ): DeterministicReplayResult {
    // Run 1
    const sim1 = SECP087ToolpathSimulator.simulate(toolpath, surface, config);

    // Run 2
    const sim2 = SECP087ToolpathSimulator.simulate(toolpath, surface, config);

    // Compare states
    let isDeterministic = sim1.states.length === sim2.states.length;
    if (isDeterministic) {
      for (let i = 0; i < sim1.states.length; i++) {
        if (sim1.states[i].stateHash !== sim2.states[i].stateHash) {
          isDeterministic = false;
          break;
        }
      }
    }

    // Compute Overall Simulation Hash
    const simInputStr = `${config.configHash}:${sim1.toolpathHash}:${sim1.kinematicStateHash}:${sim1.totalSteps}:${sim1.totalDurationSec}`;
    const simHashHex = TelemetryHasher.hashString(simInputStr).substring(0, 16).toUpperCase();
    const simulationHash = `SIM-5AXIS-${simHashHex}`;

    let limitViolationCount = 0;
    let gougeCollisionCount = 0;
    let holderCollisionCount = 0;
    let machineCollisionCount = 0;

    for (const st of sim1.states) {
      if (st.hasAxisLimitViolation) limitViolationCount++;
      if (st.hasGougeCollision) gougeCollisionCount++;
      if (st.hasHolderCollision) holderCollisionCount++;
      if (st.hasMachineCollision) machineCollisionCount++;
    }

    // Register into SystemProvenanceEngine
    const provRecord = SystemProvenanceEngine.recordStage('SECP087_5AXIS_SIMULATION', {
      machineConfigHash: config.configHash,
      toolpathHash: sim1.toolpathHash,
      kinematicStateHash: sim1.kinematicStateHash,
      simulationHash,
      totalSteps: sim1.totalSteps,
      isDeterministic
    });

    return {
      machineConfigHash: config.configHash,
      toolpathHash: sim1.toolpathHash,
      kinematicStateHash: sim1.kinematicStateHash,
      simulationHash,
      totalSteps: sim1.totalSteps,
      totalDurationSec: sim1.totalDurationSec,
      limitViolationCount,
      gougeCollisionCount,
      holderCollisionCount,
      machineCollisionCount,
      isDeterministic,
      provenanceEntryHash: provRecord.recordHash
    };
  }
}
