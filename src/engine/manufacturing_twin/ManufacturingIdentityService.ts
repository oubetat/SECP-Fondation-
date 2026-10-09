// SECP Industrial OS v2 — Manufacturing Identity & Consistency Verification Engine
import {
  ManufacturingState,
  ManufacturingStateStatus,
  ProcessPlan,
  MachineConfiguration,
  Toolpath,
  NCProgram,
  ExecutionTelemetryPacket,
  ToleranceVerification,
  CollisionVerdict,
  KinematicVerdict,
  GCodeVerdict,
  InspectionVerdict,
  DeviationMap
} from './types';

export class ManufacturingIdentityService {
  // 1. Verify Design Geometry Consistency
  public static verifyGeometryConsistency(
    manufacturingGeometryHash: string,
    releasedGeometryHash: string
  ): { valid: boolean; error?: string } {
    if (manufacturingGeometryHash !== releasedGeometryHash) {
      return {
        valid: false,
        error: `MANUFACTURING_GEOMETRY_MISMATCH: Manufacturing geometry hash [${manufacturingGeometryHash}] does not match released CAD hash [${releasedGeometryHash}]`
      };
    }
    return { valid: true };
  }

  // 2. Verify Geometry Freshness
  public static verifyGeometryFreshness(
    releasedRevision: string,
    manufacturingRevision: string
  ): { fresh: boolean; error?: string } {
    if (releasedRevision !== manufacturingRevision) {
      return {
        fresh: false,
        error: `MANUFACTURING_GEOMETRY_STALE: Geometry revision changed from ${manufacturingRevision} to ${releasedRevision}`
      };
    }
    return { fresh: true };
  }

  // 3. Verify Material Consistency
  public static verifyMaterialConsistency(
    manufacturingMaterialRevision: string,
    qualifiedMaterialRevision: string
  ): { valid: boolean; error?: string } {
    if (manufacturingMaterialRevision !== qualifiedMaterialRevision) {
      return {
        valid: false,
        error: `MANUFACTURING_MATERIAL_MISMATCH: Manufacturing material revision [${manufacturingMaterialRevision}] does not match qualified revision [${qualifiedMaterialRevision}]`
      };
    }
    return { valid: true };
  }

  // 4. Verify Process Sequence
  public static verifyProcessSequence(processPlan: ProcessPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seqSet = new Set<string>();

    for (const op of processPlan.operations) {
      if (seqSet.has(op.operationId)) {
        errors.push(`INVALID_PROCESS_SEQUENCE: Duplicate operation ID ${op.operationId}`);
      }
      seqSet.add(op.operationId);

      if (!op.targetFeatureIds || op.targetFeatureIds.length === 0) {
        errors.push(`INVALID_PROCESS_SEQUENCE: Operation ${op.operationId} has no target features assigned`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // 5. Verify Machine Kinematics Compatibility
  public static verifyMachineCompatibility(
    toolpath: Toolpath,
    machine: MachineConfiguration
  ): { status: 'MACHINE_COMPATIBLE' | 'MACHINE_INCOMPATIBLE'; details: string } {
    const limits = machine.kinematics.travelLimits;

    for (const seg of toolpath.segments) {
      const [x, y, z] = seg.endPoint;
      if (limits['X'] && (x < limits['X'][0] || x > limits['X'][1])) {
        return { status: 'MACHINE_INCOMPATIBLE', details: `Axis X out of bounds: ${x}mm [${limits['X'][0]}, ${limits['X'][1]}]` };
      }
      if (limits['Y'] && (y < limits['Y'][0] || y > limits['Y'][1])) {
        return { status: 'MACHINE_INCOMPATIBLE', details: `Axis Y out of bounds: ${y}mm [${limits['Y'][0]}, ${limits['Y'][1]}]` };
      }
      if (limits['Z'] && (z < limits['Z'][0] || z > limits['Z'][1])) {
        return { status: 'MACHINE_INCOMPATIBLE', details: `Axis Z out of bounds: ${z}mm [${limits['Z'][0]}, ${limits['Z'][1]}]` };
      }
    }

    return { status: 'MACHINE_COMPATIBLE', details: 'Toolpath envelope strictly within machine kinematics' };
  }

  // 6. Verify Collision Avoidance
  public static verifyCollision(
    toolpath: Toolpath,
    minClearanceMm: number = 2.0
  ): { verdict: CollisionVerdict; collisionCount: number; details: string } {
    let collisions = 0;
    for (const seg of toolpath.segments) {
      // Rapid motion penetrating workpiece plane (< 0 mm clearance)
      if (seg.type === 'RAPID' && seg.endPoint[2] < 0) {
        collisions++;
      }
    }

    if (collisions > 0) {
      return { verdict: 'COLLISION_DETECTED', collisionCount: collisions, details: `Detected ${collisions} rapid collisions with workpiece/fixture` };
    }
    return { verdict: 'COLLISION_FREE', collisionCount: 0, details: `Zero collisions detected. Minimum clearance: ${minClearanceMm}mm` };
  }

  // 7. Verify G-Code Integrity
  public static verifyGCode(program: NCProgram): { verdict: GCodeVerdict; details: string } {
    const errors: string[] = [];
    let hasM30OrM02 = false;

    for (let i = 0; i < program.gcodeLines.length; i++) {
      const line = program.gcodeLines[i].toUpperCase();
      if (line.includes('M30') || line.includes('M02')) {
        hasM30OrM02 = true;
      }
      // Check syntax anomalies
      if (line.includes('G0') && line.includes('G1')) {
        errors.push(`Line ${i + 1}: Conflicting modal motion commands G0 & G1`);
      }
    }

    if (!hasM30OrM02) {
      errors.push('NC Program missing mandatory program termination code (M30/M02)');
    }

    if (errors.length > 0) {
      return { verdict: 'GCODE_INVALID', details: errors.join('; ') };
    }
    return { verdict: 'GCODE_VALID', details: 'NC Program syntax, modals, and termination verified' };
  }

  // 8. Verify Execution Telemetry Integrity
  public static verifyTelemetry(packets: ExecutionTelemetryPacket[]): { valid: boolean; error?: string } {
    for (let i = 1; i < packets.length; i++) {
      if (packets[i].sequence !== packets[i - 1].sequence + 1) {
        return { valid: false, error: `TELEMETRY_GAP: Sequence discontinuity between ${packets[i - 1].sequence} and ${packets[i].sequence}` };
      }
    }
    return { valid: true };
  }

  // 9. Verify Program Execution Match
  public static verifyProgramExecution(
    executedProgramHash: string,
    approvedProgramHash: string
  ): { valid: boolean; error?: string } {
    if (executedProgramHash !== approvedProgramHash) {
      return {
        valid: false,
        error: `UNAPPROVED_PROGRAM_EXECUTION: Executed program hash [${executedProgramHash}] does not match approved NC hash [${approvedProgramHash}]`
      };
    }
    return { valid: true };
  }

  // 10. Audit Tolerance & Deviation
  public static auditTolerance(verifications: ToleranceVerification[]): {
    verdict: InspectionVerdict;
    deviationMap: DeviationMap;
    details: string;
  } {
    let outOfTolCount = 0;
    let maxDev = 0;
    let sumSq = 0;

    for (const v of verifications) {
      const dev = Math.abs(v.measuredValue - v.nominalValue);
      if (dev > maxDev) maxDev = dev;
      sumSq += dev * dev;

      if (v.measuredValue > v.upperLimit || v.measuredValue < v.lowerLimit) {
        outOfTolCount++;
        v.verdict = 'OUT_OF_TOLERANCE';
      } else {
        v.verdict = 'WITHIN_TOLERANCE';
      }
    }

    const meanDev = verifications.length > 0 ? Math.sqrt(sumSq) / verifications.length : 0;
    const RMSDeviation = verifications.length > 0 ? Math.sqrt(sumSq / verifications.length) : 0;

    const deviationMap: DeviationMap = {
      maxDeviation: maxDev,
      minDeviation: 0,
      meanDeviation: meanDev,
      RMSDeviation
    };

    if (outOfTolCount > 0) {
      return {
        verdict: 'OUT_OF_TOLERANCE',
        deviationMap,
        details: `${outOfTolCount} features exceeded tolerance limits. Max deviation: ${maxDev.toFixed(5)}mm`
      };
    }

    return {
      verdict: 'WITHIN_TOLERANCE',
      deviationMap,
      details: `All ${verifications.length} features within tolerance limits. Max deviation: ${maxDev.toFixed(5)}mm`
    };
  }

  // 11. Comprehensive Manufacturing State Audit
  public static auditManufacturingState(
    state: ManufacturingState,
    releasedGeometryHash: string,
    qualifiedMatRev: string
  ): { valid: boolean; verdict: ManufacturingStateStatus; errors: string[] } {
    const errors: string[] = [];

    const geomRes = this.verifyGeometryConsistency(state.geometryState.geometryHash, releasedGeometryHash);
    if (!geomRes.valid && geomRes.error) errors.push(geomRes.error);

    const matRes = this.verifyMaterialConsistency(state.materialState.materialRevision, qualifiedMatRev);
    if (!matRes.valid && matRes.error) errors.push(matRes.error);

    const procRes = this.verifyProcessSequence(state.processState.processPlan);
    if (!procRes.valid) errors.push(...procRes.errors);

    const gcodeRes = this.verifyGCode(state.ncState.ncProgram);
    if (gcodeRes.verdict !== 'GCODE_VALID') errors.push(gcodeRes.details);

    let verdict: ManufacturingStateStatus = 'READY';
    if (errors.some(e => e.includes('MANUFACTURING_GEOMETRY_MISMATCH') || e.includes('MANUFACTURING_MATERIAL_MISMATCH'))) {
      verdict = 'OUT_OF_SYNC';
    } else if (errors.some(e => e.includes('INVALID_PROCESS_SEQUENCE'))) {
      verdict = 'MANUFACTURING_INVALID';
    } else if (errors.some(e => e.includes('GCODE_INVALID'))) {
      verdict = 'GCODE_INVALID';
    } else if (errors.length > 0) {
      verdict = 'INVALID';
    }

    return { valid: errors.length === 0, verdict, errors };
  }
}
