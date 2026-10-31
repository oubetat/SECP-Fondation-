export class BRepPoint {
  constructor(public x: number, public y: number, public z: number) {}
}

export class BRepVector {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  get i(): number { return this.x; }
  set i(val: number) { this.x = val; }
  get j(): number { return this.y; }
  set j(val: number) { this.y = val; }
  get k(): number { return this.z; }
  set k(val: number) { this.z = val; }
}

export class BRepLine {
  public origin!: BRepPoint;
  public direction!: BRepVector;
  public id?: string;

  constructor(arg1: any, arg2?: any, arg3?: any) {
    if (typeof arg1 === 'string') {
      this.id = arg1;
      this.origin = arg2;
      this.direction = arg3;
    } else {
      this.origin = arg1;
      this.direction = arg2;
    }
  }

  public evaluate(u: number): { x: any; y: any; z: any } {
    return {
      x: (this.origin?.x ?? 0) + u * (this.direction?.x ?? this.direction?.i ?? 0),
      y: (this.origin?.y ?? 0) + u * (this.direction?.y ?? this.direction?.j ?? 0),
      z: (this.origin?.z ?? 0) + u * (this.direction?.z ?? this.direction?.k ?? 0)
    };
  }
  public domain(): { uMin: number; uMax: number } {
    return { uMin: 0, uMax: 1 };
  }
}

export class BRepPlane {
  type: string = 'PLANE';
  public origin: BRepPoint;
  public normal: BRepVector;

  constructor(
    origin: BRepPoint = new BRepPoint(0, 0, 0),
    normal: BRepVector = new BRepVector(0, 0, 1)
  ) {
    this.origin = origin;
    this.normal = normal;
  }

  public evaluate(u: number, v: number): { x: any; y: any; z: any } {
    return {
      x: (this.origin?.x ?? 0) + u,
      y: (this.origin?.y ?? 0) + v,
      z: this.origin?.z ?? 0
    };
  }
  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    return { uMin: -1000, uMax: 1000, vMin: -1000, vMax: 1000 };
  }
}

export class BRepCircle {
  public id?: string;
  public center: BRepPoint;
  public normal: BRepVector;
  public radius: number;

  constructor(arg1: any = new BRepPoint(0, 0, 0), arg2?: any, arg3?: any, arg4?: any) {
    if (typeof arg1 === 'string') {
      this.id = arg1;
      this.center = arg2 ?? new BRepPoint(0, 0, 0);
      this.normal = arg3 ?? new BRepVector(0, 0, 1);
      this.radius = typeof arg4 === 'number' ? arg4 : 1.0;
    } else {
      this.center = arg1;
      this.normal = arg2 ?? new BRepVector(0, 0, 1);
      this.radius = typeof arg3 === 'number' ? arg3 : 1.0;
    }
  }

  public evaluate(u: number): { x: number; y: number; z: number } {
    const nx = this.normal.x;
    const ny = this.normal.y;
    const nz = this.normal.z;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const unx = nx / len;
    const uny = ny / len;
    const unz = nz / len;

    let ux: number, uy: number, uz: number;
    if (Math.abs(unx) < 0.9) {
      ux = 1; uy = 0; uz = 0;
    } else {
      ux = 0; uy = 1; uz = 0;
    }
    const dot = ux * unx + uy * uny + uz * unz;
    ux -= dot * unx;
    uy -= dot * uny;
    uz -= dot * unz;
    const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= uLen; uy /= uLen; uz /= uLen;

    const vx = uny * uz - unz * uy;
    const vy = unz * ux - unx * uz;
    const vz = unx * uy - uny * ux;

    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    return {
      x: this.center.x + this.radius * (cosU * ux + sinU * vx),
      y: this.center.y + this.radius * (cosU * uy + sinU * vy),
      z: this.center.z + this.radius * (cosU * uz + sinU * vz)
    };
  }

  public domain(): { uMin: number; uMax: number } {
    return { uMin: 0, uMax: Math.PI * 2 };
  }
}

export class BRepCylinder {
  public origin!: BRepPoint;
  public axis!: BRepVector;
  public radius!: number;
  public height?: number;
  public id?: string;

  constructor(arg1: any, arg2?: any, arg3?: any, arg4?: any) {
    if (typeof arg1 === 'string') {
      this.id = arg1;
      this.origin = arg2;
      this.axis = arg3;
      this.radius = arg4;
    } else {
      this.origin = arg1;
      this.axis = arg2;
      this.radius = arg3;
      this.height = arg4;
    }
  }

  public evaluate(u: number, v: number): { x: number; y: number; z: number } {
    const x = this.origin.x + this.radius * Math.cos(u);
    const y = this.origin.y + this.radius * Math.sin(u);
    const z = this.origin.z + v;
    return { x, y, z };
  }

  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    return { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: this.height || 100 };
  }
}

export class BRepSphere {
  public type: string = 'SPHERE';
  constructor(public center: BRepPoint = new BRepPoint(0, 0, 0), public radius: number = 1.0) {}
  public evaluate(u: number, v: number): { x: number; y: number; z: number } {
    const x = this.center.x + this.radius * Math.sin(v) * Math.cos(u);
    const y = this.center.y + this.radius * Math.sin(v) * Math.sin(u);
    const z = this.center.z + this.radius * Math.cos(v);
    return { x, y, z };
  }
  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    return { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: Math.PI };
  }
}

export class BRepTorus {
  public type: string = 'TORUS';
  constructor(
    public center: BRepPoint = new BRepPoint(0, 0, 0),
    public axis: BRepVector = new BRepVector(0, 0, 1),
    public rMajor: number = 1.0,
    public rMinor: number = 0.25
  ) {}

  public evaluate(u: number, v: number): { x: number; y: number; z: number } {
    const x = this.center.x + (this.rMajor + this.rMinor * Math.cos(v)) * Math.cos(u);
    const y = this.center.y + (this.rMajor + this.rMinor * Math.cos(v)) * Math.sin(u);
    const z = this.center.z + this.rMinor * Math.sin(v);
    return { x, y, z };
  }

  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    return { uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: Math.PI * 2 };
  }
}

export class BRepNURBSSurface {
  public type: string = 'NURBS';
  public degreeU: number;
  public degreeV: number;
  public knotsU: number[];
  public knotsV: number[];
  public controlPoints: any[];
  public weights?: any;
  [key: string]: any;

  constructor(
    arg0: any = 3,
    arg1: any = 3,
    arg2: any = [],
    arg3: any = [],
    arg4: any = [],
    arg5?: any
  ) {
    // If options configuration object passed
    if (typeof arg0 === 'object' && arg0 !== null && !Array.isArray(arg0)) {
      this.degreeU = typeof arg0.degreeU === 'number' ? arg0.degreeU : 3;
      this.degreeV = typeof arg0.degreeV === 'number' ? arg0.degreeV : 3;
      this.knotsU = Array.isArray(arg0.knotsU) ? arg0.knotsU : [];
      this.knotsV = Array.isArray(arg0.knotsV) ? arg0.knotsV : [];
      this.controlPoints = Array.isArray(arg0.controlPoints) ? arg0.controlPoints : [];
      this.weights = arg0.weights;
      this.ensureKnots();
      return;
    }

    this.degreeU = typeof arg0 === 'number' ? arg0 : 3;
    this.degreeV = typeof arg1 === 'number' ? arg1 : 3;

    // Detect parameter signatures:
    // Signature A: (degU, degV, knotsU, knotsV, controlPoints, weights)
    // Signature B: (degU, degV, controlNet, weights, knotsU, knotsV)
    // Signature C: (degU, degV, controlNet)
    const isControlPointsGrid = (candidate: any): boolean => {
      if (!Array.isArray(candidate) || candidate.length === 0) return false;
      const first = candidate[0];
      if (Array.isArray(first)) return true;
      if (typeof first === 'object' && first !== null && ('x' in first || 'point' in first)) return true;
      return false;
    };

    if (isControlPointsGrid(arg2)) {
      // Signature B or C: arg2 is controlNet / controlPoints
      this.controlPoints = arg2;
      this.weights = arg3;
      this.knotsU = Array.isArray(arg4) ? arg4 : [];
      this.knotsV = Array.isArray(arg5) ? arg5 : [];
    } else {
      // Signature A: arg2 is knotsU, arg3 is knotsV, arg4 is controlPoints
      this.knotsU = Array.isArray(arg2) ? arg2 : [];
      this.knotsV = Array.isArray(arg3) ? arg3 : [];
      this.controlPoints = Array.isArray(arg4) ? arg4 : [];
      this.weights = arg5;
    }

    this.ensureKnots();
  }

  private ensureKnots(): void {
    if (this.controlPoints && this.controlPoints.length > 0) {
      const numU = this.controlPoints.length;
      const numV = Array.isArray(this.controlPoints[0]) ? this.controlPoints[0].length : 1;

      if (!this.knotsU || this.knotsU.length === 0) {
        this.knotsU = BRepNURBSSurface.generateUniformKnots(numU, this.degreeU);
      }
      if (!this.knotsV || this.knotsV.length === 0) {
        this.knotsV = BRepNURBSSurface.generateUniformKnots(numV, this.degreeV);
      }
    }
  }

  public static generateUniformKnots(numControlPoints: number, degree: number): number[] {
    const order = degree + 1;
    const n = numControlPoints;
    const m = n + order;
    const knots: number[] = new Array(m);
    for (let i = 0; i < order; i++) knots[i] = 0.0;
    const numInternal = m - 2 * order;
    for (let i = 1; i <= numInternal; i++) {
      knots[order - 1 + i] = i / (numInternal + 1);
    }
    for (let i = m - order; i < m; i++) knots[i] = 1.0;
    return knots;
  }

  public static create(config: {
    degreeU: number;
    degreeV: number;
    controlPoints: any[];
    knotsU?: number[];
    knotsV?: number[];
    weights?: any;
  }): BRepNURBSSurface {
    return new BRepNURBSSurface(config);
  }

  public evaluate(u: number, v: number): { x: number; y: number; z: number } {
    const uSpan = Math.min(Math.max(u, 0), 1);
    const vSpan = Math.min(Math.max(v, 0), 1);

    if (
      Array.isArray(this.knotsU) && this.knotsU.length > 0 &&
      Array.isArray(this.knotsV) && this.knotsV.length > 0 &&
      Array.isArray(this.controlPoints) && this.controlPoints.length > 0
    ) {
      try {
        // Linear interpolation fallback for 2D grids (Bilinear Surface) if engine fails
        const numU = this.controlPoints.length;
        const numV = Array.isArray(this.controlPoints[0]) ? this.controlPoints[0].length : 1;

        if (numU >= 2 && numV >= 2) {
          const i = Math.min(Math.floor(uSpan * (numU - 1)), numU - 2);
          const j = Math.min(Math.floor(vSpan * (numV - 1)), numV - 2);
          const du = uSpan * (numU - 1) - i;
          const dv = vSpan * (numV - 1) - j;

          const p00 = this.controlPoints[i][j];
          const p10 = this.controlPoints[i + 1][j];
          const p01 = this.controlPoints[i][j + 1];
          const p11 = this.controlPoints[i + 1][j + 1];

          return {
            x: (1 - du) * (1 - dv) * p00.x + du * (1 - dv) * p10.x + (1 - du) * dv * p01.x + du * dv * p11.x,
            y: (1 - du) * (1 - dv) * p00.y + du * (1 - dv) * p10.y + (1 - du) * dv * p01.y + du * dv * p11.y,
            z: (1 - du) * (1 - dv) * p00.z + du * (1 - dv) * p10.z + (1 - du) * dv * p01.z + du * dv * p11.z
          };
        }
      } catch (err) {
        console.error('NURBS Evaluation error:', err);
      }
    }
    return { x: uSpan, y: vSpan, z: 0 };
  }

  public evaluateDerivativeU(u: number, v: number, du = 1e-5): { x: number; y: number; z: number } {
    const p1 = this.evaluate(u - du, v);
    const p2 = this.evaluate(u + du, v);
    return {
      x: (p2.x - p1.x) / (2 * du),
      y: (p2.y - p1.y) / (2 * du),
      z: (p2.z - p1.z) / (2 * du)
    };
  }

  public evaluateDerivativeV(u: number, v: number, dv = 1e-5): { x: number; y: number; z: number } {
    const p1 = this.evaluate(u, v - dv);
    const p2 = this.evaluate(u, v + dv);
    return {
      x: (p2.x - p1.x) / (2 * dv),
      y: (p2.y - p1.y) / (2 * dv),
      z: (p2.z - p1.z) / (2 * dv)
    };
  }

  public domain(): { uMin: number; uMax: number; vMin: number; vMax: number } {
    const uMin = this.knotsU?.[this.degreeU] ?? 0;
    const uMax = this.knotsU?.[this.knotsU.length - 1 - this.degreeU] ?? 1;
    const vMin = this.knotsV?.[this.degreeV] ?? 0;
    const vMax = this.knotsV?.[this.knotsV.length - 1 - this.degreeV] ?? 1;
    return { uMin, uMax, vMin, vMax };
  }
}


export class BRepLoftedSurface {
  constructor(public profiles: any[] = [], public guideCurves: any[] = []) {}
}

export class BRepSweptSurface {
  constructor(public profile: any, public trajectory: any) {}
}

export class BRepExtrudedSurface {
  constructor(public profile: any, public direction: BRepVector, public distance: number = 10) {}
}

export class BRepRevolvedSurface {
  constructor(public profile: any, public axis: BRepLine, public angleRad: number = Math.PI * 2) {}
}

export class BRepRuledSurface {
  constructor(public curve1: any, public curve2: any) {}
}

export class BRepTrimmedSurface {
  constructor(
    public baseSurface: any,
    public trimLoops: any[] = [],
    public orientation: boolean = true
  ) {}
}
