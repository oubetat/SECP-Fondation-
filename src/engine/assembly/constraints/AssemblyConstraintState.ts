import { AssemblyConstraint, AssemblyComponentPose } from './AssemblyConstraintModel';

export class AssemblyConstraintState {
  private assemblyId: string;
  private currentRevisionId: string;
  private components: Map<string, AssemblyComponentPose> = new Map();
  private constraints: Map<string, AssemblyConstraint> = new Map();
  private groundedComponentId?: string;

  constructor(assemblyId: string, revisionId: string) {
    this.assemblyId = assemblyId;
    this.currentRevisionId = revisionId;
  }

  public getAssemblyId(): string {
    return this.assemblyId;
  }

  public getCurrentRevisionId(): string {
    return this.currentRevisionId;
  }

  public setCurrentRevisionId(revisionId: string): void {
    this.currentRevisionId = revisionId;
  }

  public addComponent(pose: AssemblyComponentPose): void {
    this.components.set(pose.instanceId, pose);
  }

  public removeComponent(componentId: string): void {
    this.components.delete(componentId);
    if (this.groundedComponentId === componentId) {
      this.groundedComponentId = undefined;
    }
  }

  public getComponent(componentId: string): AssemblyComponentPose | undefined {
    return this.components.get(componentId);
  }

  public getAllComponents(): AssemblyComponentPose[] {
    return Array.from(this.components.values());
  }

  public addConstraint(constraint: AssemblyConstraint): void {
    this.constraints.set(constraint.constraintId, constraint);
  }

  public removeConstraint(constraintId: string): void {
    this.constraints.delete(constraintId);
  }

  public getConstraint(constraintId: string): AssemblyConstraint | undefined {
    return this.constraints.get(constraintId);
  }

  public getAllConstraints(): AssemblyConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * Set ground component anchor.
   * If there's already a grounded component and it's different, it creates a conflict error!
   */
  public setGroundedComponent(componentId: string): void {
    if (this.groundedComponentId && this.groundedComponentId !== componentId) {
      throw new Error(`CONFLICT: Multiple ground components are not allowed in a single group (Current ground: ${this.groundedComponentId}, New: ${componentId}).`);
    }
    this.groundedComponentId = componentId;
  }

  public getGroundedComponent(): string | undefined {
    return this.groundedComponentId;
  }

  /**
   * Deep clones the state
   */
  public clone(): AssemblyConstraintState {
    const cloned = new AssemblyConstraintState(this.assemblyId, this.currentRevisionId);
    cloned.groundedComponentId = this.groundedComponentId;
    
    for (const [id, pose] of this.components.entries()) {
      cloned.components.set(id, {
        instanceId: pose.instanceId,
        position: { ...pose.position },
        orientation: { ...pose.orientation },
        transform: pose.transform.map(row => [...row]),
        degreesOfFreedom: {
          initialDOF: pose.degreesOfFreedom.initialDOF,
          remainingDOF: pose.degreesOfFreedom.remainingDOF,
          constrainedDOF: pose.degreesOfFreedom.constrainedDOF,
          redundantDOF: pose.degreesOfFreedom.redundantDOF,
          conflictingDOF: pose.degreesOfFreedom.conflictingDOF,
          unconstrainedDirections: [...pose.degreesOfFreedom.unconstrainedDirections],
        },
      });
    }

    for (const [id, c] of this.constraints.entries()) {
      cloned.constraints.set(id, {
        constraintId: c.constraintId,
        assemblyId: c.assemblyId,
        parentRevisionId: c.parentRevisionId,
        componentA: c.componentA,
        componentB: c.componentB,
        geometryReferenceA: c.geometryReferenceA ? {
          componentId: c.geometryReferenceA.componentId,
          topologyType: c.geometryReferenceA.topologyType,
          topologyIndex: c.geometryReferenceA.topologyIndex,
          geometricSignature: c.geometryReferenceA.geometricSignature,
          cachedNormal: c.geometryReferenceA.cachedNormal ? { ...c.geometryReferenceA.cachedNormal } : undefined,
          cachedPoint: c.geometryReferenceA.cachedPoint ? { ...c.geometryReferenceA.cachedPoint } : undefined,
        } : ({} as any),
        geometryReferenceB: c.geometryReferenceB ? {
          componentId: c.geometryReferenceB.componentId,
          topologyType: c.geometryReferenceB.topologyType,
          topologyIndex: c.geometryReferenceB.topologyIndex,
          geometricSignature: c.geometryReferenceB.geometricSignature,
          cachedNormal: c.geometryReferenceB.cachedNormal ? { ...c.geometryReferenceB.cachedNormal } : undefined,
          cachedPoint: c.geometryReferenceB.cachedPoint ? { ...c.geometryReferenceB.cachedPoint } : undefined,
        } : ({} as any),
        constraintType: c.constraintType,
        parameters: { ...c.parameters },
        tolerance: c.tolerance,
        suppressed: c.suppressed,
        enabled: c.enabled,
        priority: c.priority,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
      });
    }

    return cloned;
  }
}
