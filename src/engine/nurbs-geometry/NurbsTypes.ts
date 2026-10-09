export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ControlPoint3D {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface NurbsCurve1D {
  id: string;
  degree: number;
  controlPoints: ControlPoint3D[];
  knots: number[];
}

export interface TrimCurveUV {
  id: string;
  degree: number;
  controlPointsUV: ControlPoint3D[];
  knots: number[];
  isOuterLoop: boolean;
}

export interface NurbsSurface {
  id: string;
  degreeU: number;
  degreeV: number;
  controlPoints: ControlPoint3D[][];
  knotsU: number[];
  knotsV: number[];
  trimCurves?: TrimCurveUV[];
}
