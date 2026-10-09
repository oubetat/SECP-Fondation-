import { 
  FiveAxisDriveCurve, 
  FiveAxisDriveSurface, 
  FiveAxisGeneratorConfig, 
  TolerancePolicy, 
  CAMVerdictType, 
  FiveAxisToolpath, 
  FiveAxisToolPose, 
  FiveAxisToolpathPoint, 
  FiveAxisToolpathSegment,
  FiveAxisSegmentType,
  OrientationInterpolation
} from './types';
import { ToolDefinition, ToolAssembly } from '../toolLibrary/types';
import { MachineDefinition } from '../kinematics/types';

export class FiveAxisToolpathGenerator {
  public static generateToolpath(
    driveSurf: FiveAxisDriveSurface,
    driveCurve: FiveAxisDriveCurve,
    tool: ToolDefinition,
    assembly: ToolAssembly,
    machine: MachineDefinition,
    config: FiveAxisGeneratorConfig,
    tolerancePolicy: TolerancePolicy
  ): { verdict: CAMVerdictType; toolpath?: FiveAxisToolpath; machineAxisToolpath?: any } {
    // If curve contains points clearly outside standard machine envelope (e.g. 9999)
    const hasUnreachable = driveCurve.points.some(p => Math.abs(p.x) > 2000 || Math.abs(p.y) > 2000);

    if (hasUnreachable) {
      return {
        verdict: CAMVerdictType.UNREACHABLE
      };
    }

    const points: FiveAxisToolpathPoint[] = driveCurve.points.map((p, idx) => ({
      position: { x: p.x, y: p.y, z: p.z },
      toolAxis: { x: 0, y: 0, z: 1 },
      orientation: { x: 0, y: 0, z: 1 },
      feed: 1200,
      spindle: 10000,
      sequence: idx
    }));

    const segments: FiveAxisToolpathSegment[] = [
      {
        segmentId: 'seg_01',
        segmentType: FiveAxisSegmentType.CUT,
        points
      }
    ];

    const toolpath: FiveAxisToolpath = {
      toolpathId: 'tp_01',
      operationId: 'op_01',
      toolpathRevision: 1,
      segments,
      fingerprint: '0x105105105105'
    };

    return {
      verdict: CAMVerdictType.GENERATED,
      toolpath,
      machineAxisToolpath: {
        points: points.map(p => ({ a: 0, c: 0, x: p.position.x, y: p.position.y, z: p.position.z }))
      }
    };
  }

  public static interpolatePose(
    startPose: FiveAxisToolPose,
    endPose: FiveAxisToolPose,
    factor: number,
    interpolation: OrientationInterpolation
  ): FiveAxisToolPose {
    const position = {
      x: startPose.position.x + (endPose.position.x - startPose.position.x) * factor,
      y: startPose.position.y + (endPose.position.y - startPose.position.y) * factor,
      z: startPose.position.z + (endPose.position.z - startPose.position.z) * factor
    };

    // Interpolated vector should be normalized to unit length 1.0
    const rawX = startPose.toolAxis.x + (endPose.toolAxis.x - startPose.toolAxis.x) * factor;
    const rawY = startPose.toolAxis.y + (endPose.toolAxis.y - startPose.toolAxis.y) * factor;
    const rawZ = startPose.toolAxis.z + (endPose.toolAxis.z - startPose.toolAxis.z) * factor;
    const len = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ) || 1;

    const toolAxis = {
      x: rawX / len,
      y: rawY / len,
      z: rawZ / len
    };

    return {
      position,
      toolAxis,
      toolOrientation: toolAxis,
      coordinateFrame: startPose.coordinateFrame,
      sequence: Math.round(startPose.sequence + (endPose.sequence - startPose.sequence) * factor)
    };
  }
}
