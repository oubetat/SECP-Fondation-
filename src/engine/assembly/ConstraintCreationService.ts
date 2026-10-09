
import { 
  AssemblyConstraint, 
  AssemblyConstraintType, 
  GeometryReference, 
  TopologyType 
} from './AssemblyConstraintTypes';
import { AssemblyCore } from './AssemblyCore';

export interface ConstraintCreationRequest {
  type: AssemblyConstraintType;
  refA: GeometryReference;
  refB: GeometryReference;
  value?: number;
  flipAlignment?: boolean;
}

export class ConstraintCreationService {
  constructor(private engine: AssemblyCore) {}

  public createConstraint(request: ConstraintCreationRequest): AssemblyConstraint {
    const constraintId = `constr-${request.type.toLowerCase()}-${Date.now().toString(36)}`;
    
    const constraint: AssemblyConstraint = {
      constraintId,
      assemblyId: 'asm-root-001',
      name: `${request.type} Constraint ${constraintId.split('-').pop()}`,
      componentA: request.refA.componentId,
      componentB: request.refB.componentId,
      geometryRefA: request.refA,
      geometryRefB: request.refB,
      type: request.type,
      parameters: {
        offsetMm: request.value || 0,
        angleDeg: request.type === 'ANGLE' ? request.value : undefined,
        tolerance: 1e-4,
        flipAlignment: request.flipAlignment
      },
      status: 'UNRESOLVED',
      solverError: 0,
      revision: 1,
      suppressionState: 'ACTIVE'
    };

    this.engine.addConstraint(constraint);
    return constraint;
  }

  public validateReferences(refA: GeometryReference, refB: GeometryReference): boolean {
    // Basic validation: cannot constrain a component to itself
    if (refA.componentId === refB.componentId) return false;
    return true;
  }

  public suggestConstraintType(refA: GeometryReference, refB: GeometryReference): AssemblyConstraintType {
    if (refA.topologyType === 'PLANAR_FACE' && refB.topologyType === 'PLANAR_FACE') return 'MATE';
    if (refA.topologyType === 'AXIS' && refB.topologyType === 'AXIS') return 'ALIGN';
    if (refA.topologyType === 'CYLINDRICAL_FACE' && refB.topologyType === 'CYLINDRICAL_FACE') return 'CONCENTRIC';
    return 'MATE';
  }
}
