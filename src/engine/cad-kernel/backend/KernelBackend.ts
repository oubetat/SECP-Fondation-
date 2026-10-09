/**
 * SECP CAD Kernel — Backend Boundary
 */

export interface GeometryBackend {
  name: string;
}

export interface TopologyBackend {
  name: string;
}

export interface BooleanBackend {
  name: string;
}

export interface BRepBackend {
  name: string;
}

export interface ImportBackend {
  name: string;
}

export interface ExportBackend {
  name: string;
}

export interface CADKernelBackend {
  name: string;
  version: string;
  geometry?: GeometryBackend;
  topology?: TopologyBackend;
  boolean?: BooleanBackend;
  brep?: BRepBackend;
  import?: ImportBackend;
  export?: ExportBackend;
}
