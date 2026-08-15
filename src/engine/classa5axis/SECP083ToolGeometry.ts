/**
 * PATCH-SECP-083: 5-Axis Tool Assembly & Cutter Geometry Model
 * 
 * Defines cutters (Ball-end, Flat-end, Tapered), shanks, holders, and spindle geometries.
 */

import { ToolAssembly } from './SECP083Types';

export class SECP083ToolGeometry {

  public static createStandardBallMill(diameterMm: number = 10.0, fluteLengthMm: number = 25.0): ToolAssembly {
    return {
      toolId: `ball-${diameterMm}mm`,
      type: 'BALL_END',
      diameterMm,
      cornerRadiusMm: diameterMm / 2,
      fluteLengthMm,
      overallLengthMm: 75.0,
      shankDiameterMm: diameterMm,
      holderDiameterMm: 40.0,
      holderLengthMm: 60.0,
      gaugeLengthMm: 100.0
    };
  }

  public static createStandardFlatMill(diameterMm: number = 12.0, fluteLengthMm: number = 30.0): ToolAssembly {
    return {
      toolId: `flat-${diameterMm}mm`,
      type: 'FLAT_END',
      diameterMm,
      cornerRadiusMm: 0.0,
      fluteLengthMm,
      overallLengthMm: 80.0,
      shankDiameterMm: diameterMm,
      holderDiameterMm: 45.0,
      holderLengthMm: 65.0,
      gaugeLengthMm: 110.0
    };
  }

  public static createStandardTaperedMill(diameterMm: number = 8.0, cornerRadiusMm: number = 2.0): ToolAssembly {
    return {
      toolId: `tapered-${diameterMm}mm`,
      type: 'TAPERED',
      diameterMm,
      cornerRadiusMm,
      fluteLengthMm: 20.0,
      overallLengthMm: 70.0,
      shankDiameterMm: 12.0,
      holderDiameterMm: 40.0,
      holderLengthMm: 55.0,
      gaugeLengthMm: 95.0
    };
  }
}
