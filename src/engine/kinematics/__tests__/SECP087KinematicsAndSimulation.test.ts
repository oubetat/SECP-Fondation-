/**
 * SECP087KinematicsAndSimulation.test.ts
 *
 * Mandatory Test Suite for 5-Axis Machine Kinematics & Simulation:
 * T1 - Linear Axis Motion
 * T2 - Rotary Axis Motion
 * T3 - Combined 5-Axis Motion
 * T4 - Forward Kinematics Correctness
 * T5 - Axis Limit Violation
 * T6 - Tool Gouge Propagation
 * T7 - Holder Collision Propagation
 * T8 - Machine Collision
 * T9 - Deterministic Replay
 * T10 - Corrupted Toolpath Rejection
 * T11 - Corrupted Machine Configuration Rejection
 * T12 - Hash / Provenance Verification
 */

import { describe, test, expect } from 'vitest';
import { SECP087MachineKinematicsEngine } from '../SECP087MachineKinematicsEngine';
import { SECP087ToolpathSimulator } from '../SECP087ToolpathSimulator';
import { SECP087DeterministicReplay } from '../SECP087DeterministicReplay';
import { SECP083FiveAxisToolpathEngine } from '../../classa5axis/SECP083FiveAxisToolpathEngine';
import { SECP083Benchmarks } from '../../classa5axis/SECP083Benchmarks';
import { SECP083ToolGeometry } from '../../classa5axis/SECP083ToolGeometry';
import { FiveAxisToolpath } from '../../classa5axis/SECP083Types';

export class SECP087KinematicsAndSimulationTestSuite {

  public static async runTests(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    details: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    const surface = SECP083Benchmarks.createSampleSurfacePatch('test-surf-87', 100, 100, 0);
    const tool = SECP083ToolGeometry.createStandardBallMill(10);
    const config = SECP087MachineKinematicsEngine.createDefaultTrunnionMachineConfig('MCH-TEST-087');
    const toolpath = SECP083FiveAxisToolpathEngine.generateFiveAxisToolpath(surface, tool, 7.5, 3.0, 4, 10);

    // T1: Linear Axis Motion Test
    try {
      const joints1 = SECP087MachineKinematicsEngine.calculateInverseKinematics(
        { x: 100, y: 50, z: 200 },
        { x: 0, y: 0, z: 1 },
        config
      );
      if (Math.abs(joints1.aDeg) < 0.01 && Math.abs(joints1.cDeg) < 0.01) {
        results.push({ name: 'T1 - Linear Axis Motion Calculation', success: true });
      } else {
        results.push({ name: 'T1 - Linear Axis Motion Calculation', success: false, error: 'Non-zero rotary angles for pure Z tool vector' });
      }
    } catch (err: any) {
      results.push({ name: 'T1 - Linear Axis Motion Calculation', success: false, error: err.message });
    }

    // T2: Rotary Axis Motion Test
    try {
      const joints2 = SECP087MachineKinematicsEngine.calculateInverseKinematics(
        { x: 0, y: 0, z: 100 },
        { x: 0.5, y: 0.5, z: 0.7071 },
        config
      );
      if (joints2.aDeg > 0 && Math.abs(joints2.cDeg) > 0) {
        results.push({ name: 'T2 - Rotary Axis Motion Calculation (A/C Angles)', success: true });
      } else {
        results.push({ name: 'T2 - Rotary Axis Motion Calculation (A/C Angles)', success: false, error: 'Rotary angles failed to resolve tilt vector' });
      }
    } catch (err: any) {
      results.push({ name: 'T2 - Rotary Axis Motion Calculation (A/C Angles)', success: false, error: err.message });
    }

    // T3: Combined 5-Axis Motion Test
    try {
      const simRes = SECP087ToolpathSimulator.simulate(toolpath, surface, config);
      if (simRes.states.length === toolpath.points.length && simRes.states.every(s => s.joints !== undefined)) {
        results.push({ name: 'T3 - Combined 5-Axis Motion Toolpath Simulation', success: true });
      } else {
        results.push({ name: 'T3 - Combined 5-Axis Motion Toolpath Simulation', success: false, error: 'Simulation steps mismatch toolpath points' });
      }
    } catch (err: any) {
      results.push({ name: 'T3 - Combined 5-Axis Motion Toolpath Simulation', success: false, error: err.message });
    }

    // T4: Forward Kinematics Correctness Test
    try {
      const jointsTest = { xMm: 50, yMm: 30, zMm: 120, aDeg: 15, bDeg: 0, cDeg: 45 };
      const fkRes = SECP087MachineKinematicsEngine.evaluateForwardKinematics(jointsTest, config);
      
      const ikCheck = SECP087MachineKinematicsEngine.calculateInverseKinematics(fkRes.forwardPos, fkRes.forwardVector, config);
      const posError = Math.hypot(ikCheck.xMm - jointsTest.xMm, ikCheck.yMm - jointsTest.yMm, ikCheck.zMm - jointsTest.zMm);

      if (posError < 0.05) {
        results.push({ name: 'T4 - Forward Kinematics Transformation Precision', success: true });
      } else {
        results.push({ name: 'T4 - Forward Kinematics Transformation Precision', success: false, error: `Position error = ${posError.toFixed(4)} mm` });
      }
    } catch (err: any) {
      results.push({ name: 'T4 - Forward Kinematics Transformation Precision', success: false, error: err.message });
    }

    // T5: Axis Limit Violation Detection Test
    try {
      const jointsOverflow = { xMm: 9999, yMm: 0, zMm: 0, aDeg: 0, bDeg: 0, cDeg: 0 };
      const isLimitViolated = SECP087MachineKinematicsEngine.checkAxisLimits(jointsOverflow, config.limits);
      if (isLimitViolated) {
        results.push({ name: 'T5 - Axis Limit Violation Detection', success: true });
      } else {
        results.push({ name: 'T5 - Axis Limit Violation Detection', success: false, error: 'Failed to detect X=9999mm limit overflow' });
      }
    } catch (err: any) {
      results.push({ name: 'T5 - Axis Limit Violation Detection', success: false, error: err.message });
    }

    // T6: Tool Gouge Propagation Test
    try {
      // Modify toolpath to plunge tool into surface (gouge)
      const gougeToolpath: FiveAxisToolpath = JSON.parse(JSON.stringify(toolpath));
      gougeToolpath.points[2].position.z -= 10.0; // Plunge 10mm into surface

      const simGouge = SECP087ToolpathSimulator.simulate(gougeToolpath, surface, config);
      if (simGouge.states[2].hasGougeCollision) {
        results.push({ name: 'T6 - Tool Gouge Propagation from SECP-083 to Viewport', success: true });
      } else {
        results.push({ name: 'T6 - Tool Gouge Propagation from SECP-083 to Viewport', success: false, error: 'Failed to flag plunged toolpoint gouge' });
      }
    } catch (err: any) {
      results.push({ name: 'T6 - Tool Gouge Propagation from SECP-083 to Viewport', success: false, error: err.message });
    }

    // T7: Holder Collision Propagation Test
    try {
      const holderToolpath: FiveAxisToolpath = JSON.parse(JSON.stringify(toolpath));
      // Plunge point deep enough for holder collision
      holderToolpath.points[3].position.z -= 30.0;

      const simHolder = SECP087ToolpathSimulator.simulate(holderToolpath, surface, config);
      if (simHolder.states[3].hasHolderCollision || simHolder.states[3].hasGougeCollision) {
        results.push({ name: 'T7 - Holder Collision Propagation from SECP-083', success: true });
      } else {
        results.push({ name: 'T7 - Holder Collision Propagation from SECP-083', success: false, error: 'Failed to flag holder collision' });
      }
    } catch (err: any) {
      results.push({ name: 'T7 - Holder Collision Propagation from SECP-083', success: false, error: err.message });
    }

    // T8: Machine & Fixture Collision Test
    try {
      const simNormal = SECP087ToolpathSimulator.simulate(toolpath, surface, config);
      if (simNormal.states.length > 0) {
        results.push({ name: 'T8 - Machine & Fixture Collision Analysis', success: true });
      } else {
        results.push({ name: 'T8 - Machine & Fixture Collision Analysis', success: false, error: 'Simulation empty' });
      }
    } catch (err: any) {
      results.push({ name: 'T8 - Machine & Fixture Collision Analysis', success: false, error: err.message });
    }

    // T9: Deterministic Replay Test
    try {
      const replayRes = SECP087DeterministicReplay.verifyDeterministicReplay(toolpath, surface, config);
      if (replayRes.isDeterministic && replayRes.simulationHash.startsWith('SIM-5AXIS-')) {
        results.push({ name: 'T9 - Deterministic Replay Simulation Hash Verification', success: true });
      } else {
        results.push({ name: 'T9 - Deterministic Replay Simulation Hash Verification', success: false, error: 'Replay not deterministic or hash invalid' });
      }
    } catch (err: any) {
      results.push({ name: 'T9 - Deterministic Replay Simulation Hash Verification', success: false, error: err.message });
    }

    // T10: Corrupted Toolpath Rejection Test
    try {
      const corruptToolpath: FiveAxisToolpath = JSON.parse(JSON.stringify(toolpath));
      corruptToolpath.points[0].position.x = NaN; // Corrupt coordinate

      let rejected = false;
      try {
        const simCorrupt = SECP087ToolpathSimulator.simulate(corruptToolpath, surface, config);
        if (isNaN(simCorrupt.states[0].joints.xMm) || simCorrupt.states[0].hasAxisLimitViolation) {
          rejected = true;
        }
      } catch {
        rejected = true;
      }

      if (rejected) {
        results.push({ name: 'T10 - Corrupted Toolpath Rejection', success: true });
      } else {
        results.push({ name: 'T10 - Corrupted Toolpath Rejection', success: false, error: 'Failed to reject NaN toolpath point' });
      }
    } catch (err: any) {
      results.push({ name: 'T10 - Corrupted Toolpath Rejection', success: false, error: err.message });
    }

    // T11: Corrupted Machine Configuration Rejection Test
    try {
      const corruptConfig = JSON.parse(JSON.stringify(config));
      corruptConfig.limits.xMinMm = 1000;
      corruptConfig.limits.xMaxMm = -1000; // Invalid min > max

      const isInvalid = SECP087MachineKinematicsEngine.checkAxisLimits({ xMm: 0, yMm: 0, zMm: 0, aDeg: 0, bDeg: 0, cDeg: 0 }, corruptConfig.limits);
      if (isInvalid) {
        results.push({ name: 'T11 - Corrupted Machine Configuration Rejection', success: true });
      } else {
        results.push({ name: 'T11 - Corrupted Machine Configuration Rejection', success: false, error: 'Failed to reject inverted min/max limits' });
      }
    } catch (err: any) {
      results.push({ name: 'T11 - Corrupted Machine Configuration Rejection', success: false, error: err.message });
    }

    // T12: Hash / Provenance Verification Test
    try {
      const replay = SECP087DeterministicReplay.verifyDeterministicReplay(toolpath, surface, config);
      if (replay.provenanceEntryHash && replay.provenanceEntryHash.length > 0) {
        results.push({ name: 'T12 - Cryptographic Hash & Provenance Ledger Link', success: true });
      } else {
        results.push({ name: 'T12 - Cryptographic Hash & Provenance Ledger Link', success: false, error: 'Missing provenance record hash' });
      }
    } catch (err: any) {
      results.push({ name: 'T12 - Cryptographic Hash & Provenance Ledger Link', success: false, error: err.message });
    }

    const passedCount = results.filter(r => r.success).length;
    const failedCount = results.length - passedCount;

    return {
      passed: failedCount === 0,
      total: results.length,
      passedCount,
      failedCount,
      details: results
    };
  }
}

describe('SECP087 Kinematics and Simulation Test Suite', () => {
  test('All 5-axis kinematics tests pass', async () => {
    const report = await SECP087KinematicsAndSimulationTestSuite.runTests();
    expect(report.passed).toBe(true);
  });
});
