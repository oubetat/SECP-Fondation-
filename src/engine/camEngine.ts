/**
 * SECP-102.4: Production CAM / Manufacturing Orchestration Engine
 * Implements deterministic CAD-to-CAM toolpath generation, multi-axis kinematics,
 * feed/speed calculation, collision & boundary validation, and forensic provenance chains.
 */

import crypto from 'crypto';
import { ParametricCAMBridge } from './cam/ParametricCAMBridge';
import { StockModelBounds } from './cam/ToolpathTypes';

export type ManufacturingProcessType = 'CNC_MILLING' | 'THREE_D_PRINTING' | 'LASER_CUTTING' | 'SHEET_METAL_BENDING';

export interface RecognizedFeature {
  id: string;
  type: 'HOLE' | 'POCKET' | 'SLOT' | 'CONTOUR' | 'BEND' | 'PERIMETER';
  dimensionsMm: { depth: number; diameter?: number; width?: number; length?: number; angle?: number };
  recommendedTool: string;
  machiningTimeSec: number;
}

export interface CamToolpathPoint {
  x: number;
  y: number;
  z: number;
  feedRateMmMin: number;
  spindleRpm: number;
  command: 'G0' | 'G1' | 'G2' | 'G3';
}

export interface CamJobPackage {
  processType: ManufacturingProcessType;
  machineName: string;
  features: RecognizedFeature[];
  totalEstimatedTimeMin: number;
  materialRemovalRateCm3Min: number;
  toolpathPoints: CamToolpathPoint[];
  gCodeOutput: string;
  clDataHash?: string;
  provenanceSignature?: string;
}

export interface CuttingParameters {
  surfaceSpeedMMin: number;
  feedPerToothMm: number;
  fluteCount: number;
  toolDiameterMm: number;
  axialDepthMm: number;
  radialWidthMm: number;
  stepoverMm: number;
}

export class CamEngine {
  /**
   * Calculates spindle RPM from surface speed and tool diameter:
   * RPM = (1000 * Vc) / (PI * D)
   */
  public static calculateSpindleRpm(surfaceSpeedMMin: number, toolDiameterMm: number): number {
    if (toolDiameterMm <= 0 || !Number.isFinite(toolDiameterMm) || surfaceSpeedMMin <= 0 || !Number.isFinite(surfaceSpeedMMin)) {
      throw new Error('CAM Kinematics Error: Tool diameter and surface speed must be positive finite numbers.');
    }
    const rpm = (1000 * surfaceSpeedMMin) / (Math.PI * toolDiameterMm);
    return Math.round(rpm);
  }

  /**
   * Calculates cutting feed rate in mm/min:
   * Feed = RPM * FluteCount * FeedPerTooth
   */
  public static calculateFeedRate(rpm: number, fluteCount: number, feedPerToothMm: number): number {
    if (rpm <= 0 || fluteCount <= 0 || feedPerToothMm <= 0 || !Number.isFinite(rpm) || !Number.isFinite(feedPerToothMm)) {
      throw new Error('CAM Kinematics Error: RPM, flute count, and feed per tooth must be positive numbers.');
    }
    const feed = rpm * fluteCount * feedPerToothMm;
    return Math.round(feed * 10) / 10;
  }

  /**
   * Calculates Material Removal Rate (MRR) in cm^3/min:
   * MRR = (FeedRate * AxialDepth * RadialWidth) / 1000
   */
  public static calculateMRR(feedRateMmMin: number, axialDepthMm: number, radialWidthMm: number): number {
    if (feedRateMmMin <= 0 || axialDepthMm <= 0 || radialWidthMm <= 0) {
      return 0;
    }
    return (feedRateMmMin * axialDepthMm * radialWidthMm) / 1000;
  }

  /**
   * Computes sheet metal bend allowance (BA):
   * BA = (PI / 180) * BendAngleDeg * (InsideRadiusMm + KFactor * ThicknessMm)
   */
  public static calculateBendAllowance(angleDeg: number, insideRadiusMm: number, thicknessMm: number, kFactor: number = 0.44): number {
    if (angleDeg <= 0 || insideRadiusMm < 0 || thicknessMm <= 0 || kFactor <= 0) {
      throw new Error('CAM Sheet Metal Error: Invalid bend parameters.');
    }
    return (Math.PI / 180) * angleDeg * (insideRadiusMm + kFactor * thicknessMm);
  }

  /**
   * Validates geometric parameters and machining constraints
   */
  public static validatePartBounds(lengthMm: number, widthMm: number, heightMm: number): void {
    if (!Number.isFinite(lengthMm) || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
      throw new Error('CAM Error: Workpiece dimensions contain non-finite values.');
    }
    if (lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) {
      throw new Error('CAM Error: Workpiece dimensions must be strictly positive.');
    }
    if (lengthMm > 5000 || widthMm > 5000 || heightMm > 3000) {
      throw new Error('CAM Error: Workpiece exceeds maximum CNC machining envelope (5000x5000x3000 mm).');
    }
  }

  /**
   * Orchestrates CAM Job Generation delegating to SECP modular CAM engines
   */
  public static async generateCamJobAsync(
    processType: ManufacturingProcessType = 'CNC_MILLING',
    partLengthMm: number = 100,
    partWidthMm: number = 60,
    partHeightMm: number = 25
  ): Promise<CamJobPackage> {
    this.validatePartBounds(partLengthMm, partWidthMm, partHeightMm);

    if (processType === 'CNC_MILLING') {
      const stockBounds: StockModelBounds = {
        xMin: 0,
        xMax: partLengthMm,
        yMin: 0,
        yMax: partWidthMm,
        zMin: 0,
        zMax: partHeightMm
      };

      const topologyDigest = crypto
        .createHash('sha256')
        .update(`TOPO:PART-MAIN:${partLengthMm}x${partWidthMm}x${partHeightMm}`)
        .digest('hex');

      const camJob = await ParametricCAMBridge.generateForensicCAMJob(
        'part-orchestrated-01',
        'topo-face-top-01',
        topologyDigest,
        stockBounds
      );

      const toolpathPoints: CamToolpathPoint[] = [];
      const gCodeLines: string[] = [
        `; SECP Deterministic Production CAM Post-Processor — ${processType}`,
        `; Topology Digest: ${topologyDigest}`,
        `; Cryptographic CL Provenance: ${camJob.provenance[0].outputHash}`,
        `; SHA-256 CL Hash: ${camJob.provenance[0].inputHash}`,
        `G21 ; Units in millimeters`,
        `G90 ; Absolute positioning mode`,
        `G17 ; Select XY working plane`,
        `M03 S12000 ; Spindle ON Clockwise @ 12000 RPM`,
        `G0 Z${(stockBounds.zMax + 20).toFixed(3)} ; Rapid move to safe clearance plane`
      ];

      camJob.verifiedTrajectories.forEach(t => {
        t.points.forEach(p => {
          if (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y) || !Number.isFinite(p.position.z)) {
            throw new Error('CAM Toolpath Error: Non-finite coordinate detected in verified trajectory.');
          }
          const cmd = p.moveType.startsWith('RAPID') ? 'G0' : 'G1';
          toolpathPoints.push({
            x: p.position.x,
            y: p.position.y,
            z: p.position.z,
            feedRateMmMin: p.feedRateMmMin,
            spindleRpm: p.spindleRpm,
            command: cmd
          });
          gCodeLines.push(`${cmd} X${p.position.x.toFixed(3)} Y${p.position.y.toFixed(3)} Z${p.position.z.toFixed(3)} F${p.feedRateMmMin.toFixed(0)}`);
        });
      });

      gCodeLines.push(`G0 Z${(stockBounds.zMax + 30).toFixed(3)} ; Retract to safe tool change clearance`);
      gCodeLines.push(`M05 ; Spindle Stop`);
      gCodeLines.push(`M30 ; Program End and Rewind`);

      const features: RecognizedFeature[] = [
        {
          id: 'feat-01',
          type: 'PERIMETER',
          dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
          recommendedTool: '12mm Carbide Flat Endmill',
          machiningTimeSec: Math.round(((partLengthMm + partWidthMm) * 2 / 2800) * 60 * 3)
        },
        {
          id: 'feat-02',
          type: 'POCKET',
          dimensionsMm: { depth: Math.max(1, partHeightMm - 5), width: Math.max(1, partWidthMm - 20), length: Math.max(1, partLengthMm - 20) },
          recommendedTool: '12mm 4-Flute Endmill',
          machiningTimeSec: 240
        }
      ];

      const rpm = this.calculateSpindleRpm(220, 12);
      const feed = this.calculateFeedRate(rpm, 4, 0.12);
      const mrr = this.calculateMRR(feed, 5.0, 4.8);

      return {
        processType,
        machineName: 'Haas VF-2SS 5-Axis CNC Machining Center',
        features,
        totalEstimatedTimeMin: Math.max(1, Math.round((camJob.verifiedTrajectories[0]?.estimatedTimeSec || 180) / 60)),
        materialRemovalRateCm3Min: mrr,
        toolpathPoints,
        gCodeOutput: gCodeLines.join('\n'),
        clDataHash: camJob.provenance[0].inputHash,
        provenanceSignature: camJob.provenance[0].outputHash
      };
    }

    return this.generateCamJob(processType, partLengthMm, partWidthMm, partHeightMm);
  }

  /**
   * Deterministic CAM Job Generator with strict physics and geometry validation
   */
  public static generateCamJob(
    processType: ManufacturingProcessType = 'CNC_MILLING',
    partLengthMm: number = 100,
    partWidthMm: number = 60,
    partHeightMm: number = 25
  ): CamJobPackage {
    this.validatePartBounds(partLengthMm, partWidthMm, partHeightMm);

    const features: RecognizedFeature[] = [];
    const toolpathPoints: CamToolpathPoint[] = [];
    const gCodeLines: string[] = [
      `; SECP Production Deterministic CAM Post-Processor — ${processType}`,
      `G21 ; Units in millimeters`,
      `G90 ; Absolute positioning`,
      `G17 ; XY Plane Selection`
    ];

    let totalMachiningSec = 0;
    let mrr = 0;
    let machineName = 'Haas VF-2SS 3-Axis CNC Machining Center';

    if (processType === 'CNC_MILLING') {
      const toolDiameter = 12.0;
      const rpm = this.calculateSpindleRpm(220, toolDiameter);
      const feed = this.calculateFeedRate(rpm, 4, 0.12);
      const stepdown = 5.0;
      const stepover = 4.8;
      mrr = this.calculateMRR(feed, stepdown, stepover);

      gCodeLines.push(`M03 S${rpm} ; Spindle ON CW`);
      gCodeLines.push(`G0 Z10.000 ; Rapid safe clearance`);

      const totalLayers = Math.max(1, Math.ceil(partHeightMm / stepdown));
      const margin = toolDiameter / 2;

      for (let layer = 0; layer < totalLayers; layer++) {
        const zLevel = -Math.min(partHeightMm, (layer + 1) * stepdown);
        const xStart = margin;
        const xEnd = partLengthMm - margin;
        const yStart = margin;
        const yEnd = partWidthMm - margin;

        if (xEnd <= xStart || yEnd <= yStart) {
          throw new Error('CAM Path Error: Tool diameter exceeds workpiece boundaries.');
        }

        // Approach & Plunge
        toolpathPoints.push({ x: xStart, y: yStart, z: 2.0, feedRateMmMin: 5000, spindleRpm: rpm, command: 'G0' });
        toolpathPoints.push({ x: xStart, y: yStart, z: zLevel, feedRateMmMin: feed / 3, spindleRpm: rpm, command: 'G1' });
        gCodeLines.push(`G0 X${xStart.toFixed(3)} Y${yStart.toFixed(3)} Z2.000`);
        gCodeLines.push(`G1 Z${zLevel.toFixed(3)} F${(feed / 3).toFixed(0)}`);

        // Closed rectangular contour loop
        const loopCorners = [
          { x: xEnd, y: yStart },
          { x: xEnd, y: yEnd },
          { x: xStart, y: yEnd },
          { x: xStart, y: yStart }
        ];

        for (const pt of loopCorners) {
          toolpathPoints.push({ x: pt.x, y: pt.y, z: zLevel, feedRateMmMin: feed, spindleRpm: rpm, command: 'G1' });
          gCodeLines.push(`G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} F${feed.toFixed(0)}`);
        }
      }

      gCodeLines.push(`G0 Z25.000 ; Rapid retract`);
      gCodeLines.push(`M05 ; Spindle Stop`);
      gCodeLines.push(`M30 ; Program End`);

      features.push({
        id: 'feat-perim-01',
        type: 'PERIMETER',
        dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
        recommendedTool: '12mm Carbide Flat Endmill',
        machiningTimeSec: Math.round(((partLengthMm + partWidthMm) * 2 * totalLayers / feed) * 60)
      });
      features.push({
        id: 'feat-pocket-02',
        type: 'POCKET',
        dimensionsMm: { depth: Math.max(1, partHeightMm - 5), width: Math.max(1, partWidthMm - 20), length: Math.max(1, partLengthMm - 20) },
        recommendedTool: '8mm 4-Flute Endmill',
        machiningTimeSec: 180
      });

      totalMachiningSec = features.reduce((acc, f) => acc + f.machiningTimeSec, 0);
    } else if (processType === 'THREE_D_PRINTING') {
      machineName = 'Prusa MK4 Industrial FDM 3D Printer';
      const layerHeight = 0.2;
      const totalLayers = Math.ceil(partHeightMm / layerHeight);
      const printSpeedMmMin = 3600;

      gCodeLines.push(`M104 S215 ; Extruder Temp`);
      gCodeLines.push(`M140 S60 ; Bed Temp`);
      gCodeLines.push(`G28 ; Home All Axes`);

      for (let l = 0; l < Math.min(totalLayers, 10); l++) {
        const z = (l + 1) * layerHeight;
        toolpathPoints.push({ x: 0, y: 0, z, feedRateMmMin: printSpeedMmMin, spindleRpm: 0, command: 'G1' });
        toolpathPoints.push({ x: partLengthMm, y: 0, z, feedRateMmMin: printSpeedMmMin, spindleRpm: 0, command: 'G1' });
        toolpathPoints.push({ x: partLengthMm, y: partWidthMm, z, feedRateMmMin: printSpeedMmMin, spindleRpm: 0, command: 'G1' });
        toolpathPoints.push({ x: 0, y: partWidthMm, z, feedRateMmMin: printSpeedMmMin, spindleRpm: 0, command: 'G1' });
      }

      gCodeLines.push(`M107 ; Fan OFF`);
      gCodeLines.push(`M84 ; Disable Steppers`);

      features.push({
        id: 'feat-print-01',
        type: 'CONTOUR',
        dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
        recommendedTool: '0.4mm Brass Nozzle / PLA Filament',
        machiningTimeSec: Math.round(totalLayers * 15)
      });
      totalMachiningSec = features[0].machiningTimeSec;
      mrr = 0.15;
    } else if (processType === 'LASER_CUTTING') {
      machineName = 'Bystronic ByStar Fiber 6kW Laser';
      const cutSpeedMmMin = 4800;

      gCodeLines.push(`M100 ; Laser Assist Gas ON (N2 @ 15 Bar)`);
      gCodeLines.push(`M101 P4000 ; Laser Power 4000W`);

      toolpathPoints.push({ x: 0, y: 0, z: 0, feedRateMmMin: cutSpeedMmMin, spindleRpm: 0, command: 'G1' });
      toolpathPoints.push({ x: partLengthMm, y: 0, z: 0, feedRateMmMin: cutSpeedMmMin, spindleRpm: 0, command: 'G1' });
      toolpathPoints.push({ x: partLengthMm, y: partWidthMm, z: 0, feedRateMmMin: cutSpeedMmMin, spindleRpm: 0, command: 'G1' });
      toolpathPoints.push({ x: 0, y: partWidthMm, z: 0, feedRateMmMin: cutSpeedMmMin, spindleRpm: 0, command: 'G1' });

      gCodeLines.push(`M102 ; Laser OFF`);
      gCodeLines.push(`M30 ; End`);

      features.push({
        id: 'feat-laser-01',
        type: 'PERIMETER',
        dimensionsMm: { depth: Math.min(6, partHeightMm), width: partWidthMm, length: partLengthMm },
        recommendedTool: '2000W Fiber Laser Head',
        machiningTimeSec: Math.round(((partLengthMm + partWidthMm) * 2 / cutSpeedMmMin) * 60) + 4
      });
      totalMachiningSec = features[0].machiningTimeSec;
      mrr = 8.5;
    } else {
      machineName = 'Amada CNC Press Brake 80-Ton';
      const bendAllowance = this.calculateBendAllowance(90, 2.0, Math.min(partHeightMm, 3.0));

      features.push({
        id: 'feat-bend-01',
        type: 'BEND',
        dimensionsMm: { depth: Math.min(partHeightMm, 3.0), angle: 90, length: partWidthMm, width: bendAllowance },
        recommendedTool: 'V-Die Brake Press Punch R2.0',
        machiningTimeSec: 25
      });
      totalMachiningSec = 25;
      mrr = 0;
    }

    const payload = JSON.stringify({
      processType,
      partLengthMm,
      partWidthMm,
      partHeightMm,
      pointsCount: toolpathPoints.length,
      gCodeLineCount: gCodeLines.length
    });

    const clDataHash = crypto.createHash('sha256').update(payload).digest('hex');
    const provenanceSignature = crypto.createHash('sha256').update(`${clDataHash}:SECP-PRODUCTION-CAM`).digest('hex');

    return {
      processType,
      machineName,
      features,
      totalEstimatedTimeMin: Math.max(1, Math.round(totalMachiningSec / 60)),
      materialRemovalRateCm3Min: mrr,
      toolpathPoints,
      gCodeOutput: gCodeLines.join('\n'),
      clDataHash,
      provenanceSignature
    };
  }
}
