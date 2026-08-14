/**
 * PATCH-SECP-057 — Manufacturing / Computer-Aided Manufacturing (CAM) Orchestrator Facade
 * Orchestrates modular CAM engines (CAMStockModel, CuttingToolModel, ThreeAxisToolpathEngine,
 * AdaptiveRoughingEngine, FinishingToolpathEngine, DrillingCycleEngine, MultiAxisToolpathEngine,
 * ToolpathVerificationEngine, CutterLocationDataEngine, ParametricCAMBridge).
 */

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

export class CamEngine {
  /**
   * Orchestrates CAM Job Generation delegating to SECP-057 modular CAM engines
   */
  public static async generateCamJobAsync(
    processType: ManufacturingProcessType = 'CNC_MILLING',
    partLengthMm: number = 100,
    partWidthMm: number = 60,
    partHeightMm: number = 25
  ): Promise<CamJobPackage> {
    if (processType === 'CNC_MILLING') {
      const stockBounds: StockModelBounds = {
        xMin: 0,
        xMax: partLengthMm,
        yMin: 0,
        yMax: partWidthMm,
        zMin: 0,
        zMax: partHeightMm
      };

      const featureBounds = {
        xMin: 10,
        xMax: partLengthMm - 10,
        yMin: 10,
        yMax: partWidthMm - 10,
        bottomZ: 5,
        topZ: partHeightMm
      };

      const clPackage = await ParametricCAMBridge.generateFullCAMThread(
        'part-orchestrated-01',
        'topo-face-top-01',
        'feat-pocket-01',
        featureBounds,
        stockBounds
      );

      const toolpathPoints: CamToolpathPoint[] = [];
      const gCodeLines: string[] = [
        `; SECP-057 Deterministic CAM Post-Processor Output — ${processType}`,
        `; Cryptographic CL Provenance: ${clPackage.provenanceSignature}`,
        `; SHA-256 CL Hash: ${clPackage.clDataHash}`,
        `G21 ; Millimeters`,
        `G90 ; Absolute positioning`,
        `G17 ; XY Plane`,
        `M03 S12000 ; Spindle ON`,
        `G0 Z${stockBounds.zMax + 20} ; Rapid to Clearance`
      ];

      clPackage.trajectories.forEach(t => {
        t.points.forEach(p => {
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

      gCodeLines.push(`G0 Z${stockBounds.zMax + 30} ; Retract`);
      gCodeLines.push(`M05 ; Spindle Stop`);
      gCodeLines.push(`M30 ; End of Program`);

      const features: RecognizedFeature[] = [
        {
          id: 'feat-01',
          type: 'PERIMETER',
          dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
          recommendedTool: '12mm Carbide Flat Endmill',
          machiningTimeSec: 180
        },
        {
          id: 'feat-02',
          type: 'POCKET',
          dimensionsMm: { depth: partHeightMm - 5, width: partWidthMm - 20, length: partLengthMm - 20 },
          recommendedTool: '12mm 4-Flute Endmill',
          machiningTimeSec: 240
        }
      ];

      return {
        processType,
        machineName: 'Haas VF-2SS 5-Axis CNC Machining Center',
        features,
        totalEstimatedTimeMin: Math.max(1, Math.round(clPackage.totalMachiningTimeSec / 60)),
        materialRemovalRateCm3Min: 42.5,
        toolpathPoints,
        gCodeOutput: gCodeLines.join('\n'),
        clDataHash: clPackage.clDataHash,
        provenanceSignature: clPackage.provenanceSignature
      };
    }

    // Synchronous fallback wrapper for non-CNC processes
    return this.generateCamJob(processType, partLengthMm, partWidthMm, partHeightMm);
  }

  /**
   * Synchronous legacy entry point
   */
  public static generateCamJob(
    processType: ManufacturingProcessType = 'CNC_MILLING',
    partLengthMm: number = 100,
    partWidthMm: number = 60,
    partHeightMm: number = 25
  ): CamJobPackage {
    const features: RecognizedFeature[] = [];

    if (processType === 'CNC_MILLING') {
      features.push({
        id: 'feat-01',
        type: 'PERIMETER',
        dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
        recommendedTool: '12mm Carbide Flat Endmill',
        machiningTimeSec: 180
      });
      features.push({
        id: 'feat-02',
        type: 'POCKET',
        dimensionsMm: { depth: 12, width: 35, length: 50 },
        recommendedTool: '8mm 4-Flute Endmill',
        machiningTimeSec: 240
      });
    } else if (processType === 'THREE_D_PRINTING') {
      features.push({
        id: 'feat-01',
        type: 'CONTOUR',
        dimensionsMm: { depth: partHeightMm, width: partWidthMm, length: partLengthMm },
        recommendedTool: '0.4mm Brass Nozzle / PLA Filament',
        machiningTimeSec: 4200
      });
    } else if (processType === 'LASER_CUTTING') {
      features.push({
        id: 'feat-01',
        type: 'PERIMETER',
        dimensionsMm: { depth: 3, width: partWidthMm, length: partLengthMm },
        recommendedTool: '2000W Fiber Laser Head',
        machiningTimeSec: 35
      });
    } else {
      features.push({
        id: 'feat-01',
        type: 'BEND',
        dimensionsMm: { depth: 2, angle: 90, length: partWidthMm },
        recommendedTool: 'V-Die Brake Press Punch',
        machiningTimeSec: 20
      });
    }

    const toolpathPoints: CamToolpathPoint[] = [];
    const gCodeLines: string[] = [
      `; SECP CAM Post-Processor Output — ${processType}`,
      `G21 ; Millimeters`,
      `G90 ; Absolute positioning`,
      `G17 ; XY Plane Selection`,
      `M03 S12000 ; Spindle ON CW @ 12,000 RPM`,
      `G0 Z10.0 ; Rapid retract`
    ];

    const feed = 1200;
    const rpm = 12000;
    const steps = 6;

    for (let i = 0; i < steps; i++) {
      const zLayer = -(i * 2);
      toolpathPoints.push({ x: 10, y: 10, z: zLayer, feedRateMmMin: feed, spindleRpm: rpm, command: 'G1' });
      toolpathPoints.push({ x: partLengthMm - 10, y: 10, z: zLayer, feedRateMmMin: feed, spindleRpm: rpm, command: 'G1' });
      toolpathPoints.push({ x: partLengthMm - 10, y: partWidthMm - 10, z: zLayer, feedRateMmMin: feed, spindleRpm: rpm, command: 'G1' });
      toolpathPoints.push({ x: 10, y: partWidthMm - 10, z: zLayer, feedRateMmMin: feed, spindleRpm: rpm, command: 'G1' });

      gCodeLines.push(`G1 Z${zLayer.toFixed(2)} F${feed/2}`);
      gCodeLines.push(`G1 X10.00 Y10.00 F${feed}`);
      gCodeLines.push(`G1 X${(partLengthMm - 10).toFixed(2)} Y10.00`);
      gCodeLines.push(`G1 X${(partLengthMm - 10).toFixed(2)} Y${(partWidthMm - 10).toFixed(2)}`);
      gCodeLines.push(`G1 X10.00 Y${(partWidthMm - 10).toFixed(2)}`);
    }

    gCodeLines.push(`G0 Z25.0 ; Rapid retract`);
    gCodeLines.push(`M05 ; Spindle Stop`);
    gCodeLines.push(`M30 ; Program End & Reset`);

    const totalSecs = features.reduce((acc, f) => acc + f.machiningTimeSec, 0);

    return {
      processType,
      machineName:
        processType === 'CNC_MILLING'
          ? 'Haas VF-2SS 3-Axis CNC Machining Center'
          : processType === 'THREE_D_PRINTING'
          ? 'Prusa MK4 Industrial FDM 3D Printer'
          : processType === 'LASER_CUTTING'
          ? 'Bystronic ByStar Fiber 6kW Laser'
          : 'Amada CNC Press Brake 80-Ton',
      features,
      totalEstimatedTimeMin: Math.max(1, Math.round(totalSecs / 60)),
      materialRemovalRateCm3Min: 42.5,
      toolpathPoints,
      gCodeOutput: gCodeLines.join('\n')
    };
  }
}
