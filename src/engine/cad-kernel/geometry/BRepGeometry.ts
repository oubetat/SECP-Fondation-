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
  constructor(public center: BRepPoint, public radius: number) {}
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

export class BRepNURBSSurface {
  public evaluate(u: number, v: number): any {
    return { x: u, y: v, z: 0 };
  }
  public domain(): any {
    return { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  }
  [key: string]: any;
  constructor(
    public degreeU: any = 3,
    public degreeV: any = 3,
    public knotsU: any = [],
    public knotsV: any = [],
    public controlPoints: any = [],
    public weights?: any
  ) {}
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
