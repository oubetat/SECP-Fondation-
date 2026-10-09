import { Vector3D, vec3, ToolPose, ToolGeometry } from './StockTypes';

export interface SweptSamplePoint {
  center: Vector3D;
  radius: number;
  cornerRad: number;
  cutterType: string;
  fluteLength: number;
}

export class SweptCutterVolume {
  constructor(
    public segmentIndex: number,
    public startPose: ToolPose,
    public endPose: ToolPose,
    public tool: ToolGeometry,
    public boundingMin: Vector3D,
    public boundingMax: Vector3D,
    public subSegmentCount: number,
    public sweptLengthMm: number
  ) {}
}

export class SweptCutterEngine {
  public static computeSweptVolume(
    segmentIndex: number,
    startPose: ToolPose,
    endPose: ToolPose,
    tool: ToolGeometry,
    resolutionMm: number = 0.5
  ): SweptCutterVolume {
    const r = tool.diameterMm / 2;
    const p1 = startPose.tcp;
    const p2 = endPose.tcp;

    const minX = Math.min(p1.x, p2.x) - r;
    const maxX = Math.max(p1.x, p2.x) + r;
    const minY = Math.min(p1.y, p2.y) - r;
    const maxY = Math.max(p1.y, p2.y) + r;
    const minZ = Math.min(p1.z, p2.z);
    const maxZ = Math.max(p1.z, p2.z) + tool.fluteLengthMm;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const subCount = Math.max(1, Math.ceil(length / resolutionMm));

    return new SweptCutterVolume(
      segmentIndex,
      startPose,
      endPose,
      tool,
      vec3(minX, minY, minZ),
      vec3(maxX, maxY, maxZ),
      subCount,
      length
    );
  }

  public static generateSweptSamples(sv: SweptCutterVolume): SweptSamplePoint[] {
    const samples: SweptSamplePoint[] = [];
    const n = sv.subSegmentCount;
    const p1 = sv.startPose.tcp;
    const p2 = sv.endPose.tcp;

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      const z = p1.z + (p2.z - p1.z) * t;

      samples.push({
        center: vec3(x, y, z),
        radius: sv.tool.diameterMm / 2,
        cornerRad: sv.tool.cornerRadMm,
        cutterType: sv.tool.cutterType,
        fluteLength: sv.tool.fluteLengthMm
      });
    }
    return samples;
  }

  public static pointCutterDistance(point: Vector3D, sample: SweptSamplePoint): number {
    const dx = point.x - sample.center.x;
    const dy = point.y - sample.center.y;
    const dz = point.z - sample.center.z;
    const dist2D = Math.sqrt(dx * dx + dy * dy);

    if (dist2D > sample.radius) return 1.0; // Outside

    // Very simplified signed distance
    if (dz < 0) return dz; // Below tool
    if (dz > sample.fluteLength) return dz - sample.fluteLength; // Above flutes

    return dist2D - sample.radius; // Inside cylinder
  }
}
