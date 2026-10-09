export interface SECP083Tool {
  type: string;
  diameterMm: number;
  cornerRadiusMm: number;
  fluteLengthMm: number;
  holderLengthMm: number;
  gaugeLengthMm: number;
}

export class SECP083ToolGeometry {
  public static createStandardBallMill(diameter: number): SECP083Tool {
    return {
      type: 'BALL_MILL',
      diameterMm: diameter,
      cornerRadiusMm: diameter / 2,
      fluteLengthMm: diameter * 3,
      holderLengthMm: 50,
      gaugeLengthMm: 100
    };
  }
}
