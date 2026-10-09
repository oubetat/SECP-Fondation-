export type DigitalThreadNodeType = 'REQUIREMENT' | 'PART' | 'ASSEMBLY' | 'SIMULATION' | 'BOM' | 'PROCESS' | 'DIGITAL_TWIN' | 'ECO';
export type ThreadProjectionView = 'ENGINEERING' | 'MANUFACTURING' | 'SUPPLIER' | 'EXECUTIVE';

export interface DigitalThreadNode {
  id: string;
  name: string;
  type: DigitalThreadNodeType;
  revision: string;
  status: string;
  owner: string;
  timestamp: string;
  stale?: boolean;
}

export interface DigitalThreadEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'SATISFIES' | 'DERIVED_FROM' | 'VALIDATES' | 'PRODUCES' | 'MONITORS';
}
