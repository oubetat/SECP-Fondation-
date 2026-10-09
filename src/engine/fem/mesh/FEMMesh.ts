import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';
import { FEMConnectivity } from './FEMConnectivity';
import { FEMBoundary } from './FEMBoundary';
import { FEMRegion } from './FEMRegion';

export class FEMMesh {
  id: string = '';
  nodes: FEMNode[] = [];
  elements: FEMElement[] = [];
  boundaries: FEMBoundary[] = [];
  regions: FEMRegion[] = [];
  connectivity?: FEMConnectivity;
  
  // Hash outputs for security/deterministic verification
  meshHash?: string;
  topologyHash?: string;
  geometryHash?: string;
  qualityHash?: string;
  
  // Performance and statistics metadata
  diagnostics?: string;
  timestamp: number = Date.now();

  constructor(init?: Partial<FEMMesh>) {
    if (init) Object.assign(this, init);
  }
}
