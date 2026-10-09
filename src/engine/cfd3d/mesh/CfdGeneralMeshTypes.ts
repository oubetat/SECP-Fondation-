/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — General CFD Mesh Interface
 */

export enum CfdCellType {
  TETRAHEDRON = 'TETRAHEDRON',
  HEXAHEDRON = 'HEXAHEDRON',
  PRISM = 'PRISM',
  PYRAMID = 'PYRAMID',
  POLYHEDRON = 'POLYHEDRON'
}

export enum CfdBoundaryType {
  INLET = 'INLET',
  OUTLET = 'OUTLET',
  WALL = 'WALL',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export class CfdNode {
  constructor(
    public readonly id: string,
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  public toVector(): Vector3 {
    return { x: this.x, y: this.y, z: this.z };
  }
}

export class CfdFace {
  public ownerCellId: string = '';
  public neighbourCellId: string | null = null; // null for boundary faces
  public center: Vector3 = { x: 0, y: 0, z: 0 };
  public area: number = 0;
  public normal: Vector3 = { x: 0, y: 0, z: 1 };
  public boundaryPatchId: string | null = null;

  constructor(
    public readonly id: string,
    public readonly nodeIds: string[]
  ) {}

  public isBoundary(): boolean {
    return this.neighbourCellId === null;
  }
}

export class CfdCell {
  public center: Vector3 = { x: 0, y: 0, z: 0 };
  public volume: number = 0;
  public faceIds: string[] = [];
  
  constructor(
    public readonly id: string,
    public readonly nodeIds: string[],
    public readonly type: CfdCellType = CfdCellType.TETRAHEDRON
  ) {}
}

export interface CfdBoundaryPatch {
  id: string;
  name: string;
  type: CfdBoundaryType;
  faceIds: string[];
}
