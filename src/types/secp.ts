export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Point3D;
  max: Point3D;
}

export interface ProvenanceRecord {
  id: string;
  timestamp: string;
  action: string;
  author: string;
  hash: string;
  status: 'VERIFIED' | 'PENDING' | 'REVOKED';
  metadata?: Record<string, unknown>;
}

export interface MonorepoNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  language?: 'cpp' | 'typescript' | 'sql' | 'cmake' | 'json' | 'markdown';
  content?: string;
  children?: MonorepoNode[];
}

export interface AcceptanceCriterion {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'RUNNING' | 'PENDING';
  category: string;
  details: string;
  timestamp: string;
}

export interface CppEngineStatus {
  name: string;
  language: string;
  cmakeTarget: string;
  status: 'COMPILED' | 'BUILDING' | 'READY';
  version: string;
  features: string[];
}

export interface DatabaseStatus {
  connected: boolean;
  databaseName: string;
  host: string;
  port: number;
  activePools: number;
  maxPools: number;
  latencyMs: number;
  tables: Array<{
    tableName: string;
    rowCount: number;
    sizeKb: number;
  }>;
}

export interface TestResult {
  id: string;
  name: string;
  category: 'TYPES' | 'GEOMETRY' | 'PROVENANCE' | 'CPP_BRIDGE' | 'DATABASE';
  passed: boolean;
  durationMs: number;
  details: string;
}
