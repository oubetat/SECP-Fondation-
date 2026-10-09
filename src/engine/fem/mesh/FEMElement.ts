export type FEMElementType = 'BAR' | 'TRI' | 'QUAD' | 'TET' | 'HEX';

export interface FEMElement {
  id: string;
  type: FEMElementType;
  nodeIds: string[];
  regionId: string;
  materialId: string;
  integrationOrder?: number;
  localCoordinates?: number[][]; // local integration coordinates
  qualityMetrics?: Record<string, number>;
}
