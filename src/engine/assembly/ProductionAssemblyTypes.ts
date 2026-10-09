export interface AssemblyNode {
  id: string;
  name: string;
  isRoot: boolean;
  childInstanceIds: string[];
  subassemblyIds: string[];
  revision: number;
}

export interface ComponentInstance {
  id: string;
  name: string;
  type: string;
  partDefinitionId: string;
  parentAssemblyId: string;
  activeConfigurationId: string;
  transform: any;
  isFixed: boolean;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  persistentTopologyPath: string;
}

export interface AssemblyMate {
  id: string;
  name: string;
  type: string;
  primaryRef: {
    componentInstanceId: string;
    partId: string;
    topologyType: string;
    persistentTopologyId: string;
    canonicalPath: string;
  };
  secondaryRef: {
    componentInstanceId: string;
    partId: string;
    topologyType: string;
    persistentTopologyId: string;
    canonicalPath: string;
  };
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  offsetMm?: number;
  angleDeg?: number;
  ratio?: number;
}

export interface AssemblyKinematicJoint {
  id: string;
  mateId: string;
  jointType: string;
  drivenComponentId: string;
  dofCount: number;
  currentValue: number;
  minRange: number;
  maxRange: number;
}

export interface AssemblyGraphValidationResult {
  isValid: boolean;
  danglingComponentCount: number;
  hasCircularDependency: boolean;
  duplicateInstanceIdsCount: number;
  invalidReferenceCount: number;
  errors: string[];
}

export interface AssemblyDOFAnalysis {
  totalComponents: number;
  totalMates: number;
  rigidBodyDOF: number;
  constrainedDOF: number;
  netSystemDOF: number;
  isFullyConstrained: boolean;
  isOverConstrained: boolean;
  jointDOFs: Record<string, number>;
}

export type InterferenceResultType = 'NO_INTERFERENCE' | 'INTERFERENCE_DETECTED' | 'CLEARANCE_VIOLATION';

export interface AssemblyInterferenceReport {
  instanceAId: string;
  instanceBId: string;
  resultType: InterferenceResultType;
  interferenceVolumeMm3: number;
  minClearanceDistanceMm: number;
  requiredClearanceMm: number;
  contactPoint?: {
    x: number;
    y: number;
    z: number;
  };
}
