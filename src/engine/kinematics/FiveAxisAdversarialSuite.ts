import { FiveAxisKinematicsEngine } from './FiveAxisKinematicsEngine';
import { CollisionEngine } from './CollisionEngine';
import { FiveAxisVerificationEngine } from './FiveAxisVerificationEngine';
import { MachineKinematicConfig, FiveAxisToolpath } from './KinematicTypes';

export class FiveAxisAdversarialSuite {
  
  public static async runSuiteAsync(): Promise<{ passes: string[], failures: string[] }> {
    const results = { passes: [] as string[], failures: [] as string[] };
    
    const validConfig: MachineKinematicConfig = {
      id: 'AC-TABLE-TABLE',
      linearAxes: [
        { id: 'X', type: 'LINEAR', minLimit: -500, maxLimit: 500, home: 0, resolution: 0.001, direction: 1 },
        { id: 'Y', type: 'LINEAR', minLimit: -500, maxLimit: 500, home: 0, resolution: 0.001, direction: 1 },
        { id: 'Z', type: 'LINEAR', minLimit: 0, maxLimit: 500, home: 500, resolution: 0.001, direction: 1 }
      ],
      rotaryAxes: [
        { id: 'A', type: 'ROTARY', minLimit: -120, maxLimit: 120, home: 0, resolution: 0.001, direction: 1, axisVector: {x:1,y:0,z:0}, center: {x:0,y:0,z:0} },
        { id: 'C', type: 'ROTARY', minLimit: -360, maxLimit: 360, home: 0, resolution: 0.001, direction: 1, axisVector: {x:0,y:0,z:1}, center: {x:0,y:0,z:0} }
      ]
    };

    const collisionConfig = {
      workpieceBounds: { xMin: -50, xMax: 50, yMin: -50, yMax: 50, zMin: -20, zMax: 20 },
      toolLength: 50,
      toolDiameter: 10,
      safeClearance: 5
    };

    const verifier = new FiveAxisVerificationEngine(validConfig, collisionConfig);

    // 1. NaN coordinate
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-1',
        points: [{ position: { x: NaN, y: 0, z: 0 }, toolOrientation: { i: 0, j: 0, k: 1 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.rejectedPoseCount === 1) results.passes.push('Reject NaN Cartesian coordinate');
      else results.failures.push('Failed to reject NaN Cartesian coordinate');
    } catch(e) { results.passes.push('Reject NaN Cartesian coordinate'); }

    // 2. Infinity coordinate
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-2',
        points: [{ position: { x: Infinity, y: 0, z: 0 }, toolOrientation: { i: 0, j: 0, k: 1 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.rejectedPoseCount === 1) results.passes.push('Reject Infinity coordinate');
      else results.failures.push('Failed to reject Infinity coordinate');
    } catch(e) { results.passes.push('Reject Infinity coordinate'); }

    // 3. Zero-length tool orientation
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-3',
        points: [{ position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0, j: 0, k: 0 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.rejectedPoseCount === 1) results.passes.push('Reject zero-length tool orientation');
      else results.failures.push('Failed to reject zero-length tool orientation');
    } catch(e) { results.passes.push('Reject zero-length tool orientation'); }

    // 4. Invalid machine configuration / axis limits
    try {
      const badConfig = JSON.parse(JSON.stringify(validConfig));
      badConfig.linearAxes[0].minLimit = 100;
      badConfig.linearAxes[0].maxLimit = 0; // Invalid
      new FiveAxisKinematicsEngine(badConfig);
      results.failures.push('Failed to reject invalid machine axis limits');
    } catch (e) {
      results.passes.push('Reject invalid machine axis limits');
    }

    // 5. Axis limit violation
    try {
      // Kinematics solver outputs Machine Z directly mapping from position z in simple table-table offset=0
      const tp: FiveAxisToolpath = {
        operationId: 'adv-5',
        points: [{ position: { x: 0, y: 0, z: -100 }, toolOrientation: { i: 0, j: 0, k: 1 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.limitViolations.length > 0) results.passes.push('Reject axis-limit violation');
      else results.failures.push('Failed to reject axis-limit violation');
    } catch(e) { results.passes.push('Reject axis-limit violation'); }

    // 6. Singularity
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-6',
        points: [{ position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0, j: 0, k: 1 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.singularityEvents.length > 0) results.passes.push('Detect singular configuration');
      else results.failures.push('Failed to detect singular configuration');
    } catch(e) { results.failures.push(`Detect singular configuration errored: ${e}`); }

    // 7. Cartesian Discontinuity
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-7',
        points: [
          { position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0.1, j: 0, k: 0.99 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 },
          { position: { x: 100, y: 0, z: 50 }, toolOrientation: { i: 0.1, j: 0, k: 0.99 }, moveType: 'CUTTING', feed: 100, sourceIndex: 1 }
        ],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.cartesianContinuityGapCount > 0) results.passes.push('Detect Cartesian discontinuity');
      else results.failures.push('Failed to detect Cartesian discontinuity');
    } catch(e) { results.failures.push(`Cartesian discontinuity errored: ${e}`); }

    // 8. Orientation Discontinuity
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-8',
        points: [
          { position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0.1, j: 0, k: 0.99 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 },
          { position: { x: 1, y: 0, z: 50 }, toolOrientation: { i: 0.99, j: 0, k: 0.1 }, moveType: 'CUTTING', feed: 100, sourceIndex: 1 }
        ],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.orientationDiscontinuityCount > 0) results.passes.push('Detect orientation discontinuity');
      else results.failures.push('Failed to detect orientation discontinuity');
    } catch(e) { results.failures.push(`Orientation discontinuity errored: ${e}`); }

    // 9. Machine Axis Discontinuity
    try {
      // Small change in tool orientation near singularity causes large C-axis rotation
      const tp: FiveAxisToolpath = {
        operationId: 'adv-9',
        points: [
          { position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0.001, j: 0, k: 0.999999 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 },
          { position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: -0.001, j: 0, k: 0.999999 }, moveType: 'CUTTING', feed: 100, sourceIndex: 1 }
        ],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.metrics.machineAxisDiscontinuityCount > 0) results.passes.push('Detect machine-axis discontinuity');
      else results.failures.push('Failed to detect machine-axis discontinuity');
    } catch(e) { results.failures.push(`Machine axis discontinuity errored: ${e}`); }

    // 10. Tool/Workpiece Collision & 12. Gouging
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-10',
        points: [{ position: { x: 0, y: 0, z: -10 }, toolOrientation: { i: 0.1, j: 0, k: 0.99 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.collisionEvents.length > 0 && res.gougingEvents.length > 0) {
        results.passes.push('Detect tool/workpiece collision');
        results.passes.push('Detect gouging condition');
      } else {
        results.failures.push('Failed to detect collision/gouging');
      }
    } catch(e) { results.failures.push(`Collision/gouging errored: ${e}`); }

    // 11. Clearance Violation
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-11',
        points: [{ position: { x: 52, y: 0, z: 0 }, toolOrientation: { i: 0.1, j: 0, k: 0.99 }, moveType: 'RAPID', feed: 100, sourceIndex: 0 }],
        provenance: {}
      };
      const res = await verifier.verifyToolpathAsync(tp, {secp096Hash:'', secp097Hash:'', secp098Hash:''});
      if (res.clearanceResult.violations > 0) results.passes.push('Detect clearance violation');
      else results.failures.push('Failed to detect clearance violation');
    } catch(e) { results.failures.push(`Clearance errored: ${e}`); }

    // 13. Invalid Machine Configuration
    try {
      const badConfig = JSON.parse(JSON.stringify(validConfig));
      badConfig.linearAxes.push(badConfig.linearAxes[0]); // Duplicate X
      new FiveAxisKinematicsEngine(badConfig);
      results.failures.push('Failed to reject invalid machine configuration');
    } catch (e) {
      results.passes.push('Reject invalid machine configuration');
    }

    // 14. Deterministic Replay
    try {
      const tp: FiveAxisToolpath = {
        operationId: 'adv-14',
        points: [
          { position: { x: 0, y: 0, z: 50 }, toolOrientation: { i: 0.1, j: 0.1, k: 0.9899 }, moveType: 'CUTTING', feed: 100, sourceIndex: 0 },
          { position: { x: 1, y: 0, z: 50 }, toolOrientation: { i: 0.1, j: 0.1, k: 0.9899 }, moveType: 'CUTTING', feed: 100, sourceIndex: 1 }
        ],
        provenance: {}
      };
      const res1 = await verifier.verifyToolpathAsync(tp, {secp096Hash:'A', secp097Hash:'B', secp098Hash:'C'});
      const res2 = await verifier.verifyToolpathAsync(tp, {secp096Hash:'A', secp097Hash:'B', secp098Hash:'C'});
      
      if (res1.provenanceHash === res2.provenanceHash) results.passes.push('Deterministic replay produces identical hashes');
      else results.failures.push('Deterministic replay hashes differed');
    } catch(e) { results.failures.push(`Replay errored: ${e}`); }

    return results;
  }
}
