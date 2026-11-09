import { AssemblyComponent, AssemblyConstraint, KinematicJoint, AssemblyConfiguration } from './AssemblyConstraintTypes';

/**
 * PATCH-SECP-046-E — Assembly Configuration States
 * Manages multiple design or operational states (e.g., OPEN, CLOSED, TRANSPORT) 
 * without mutating the underlying B-Rep geometry.
 */
export class AssemblyConfigurationManager {
  private configurations: Map<string, AssemblyConfiguration> = new Map();
  private currentConfigId: string | null = null;

  constructor() {}

  /**
   * Adds or updates a configuration
   */
  public saveConfiguration(config: AssemblyConfiguration): void {
    this.configurations.set(config.id, config);
  }

  /**
   * Applies a configuration to the active assembly components and constraints
   */
  public applyConfiguration(
    configId: string,
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[],
    joints: KinematicJoint[]
  ): { success: boolean; message: string } {
    const config = this.configurations.get(configId);
    if (!config) {
      return { success: false, message: `Configuration ${configId} not found.` };
    }

    this.currentConfigId = configId;

    // 1. Apply Suppression to Components
    for (const comp of components) {
      const override = config.componentOverrides ? config.componentOverrides[comp.instanceId] : undefined;
      if (override && override.suppressed !== undefined) {
        comp.suppressed = override.suppressed;
      }
      
      if (override && (override as any).placementTransform) {
         comp.placementTransform = (override as any).placementTransform;
      }
    }

    // 2. Apply Suppression to Constraints
    const suppConstraints = config.constraintOverrides
      ? Object.keys(config.constraintOverrides).filter(k => config.constraintOverrides[k]?.suppressed)
      : (config as any).suppressedConstraints || [];

    for (const constraint of constraints) {
      const cId = constraint.constraintId || constraint.id || '';
      if (cId && suppConstraints.includes(cId)) {
        constraint.suppressionState = 'SUPPRESSED';
        constraint.status = 'SUPPRESSED';
      } else {
        constraint.suppressionState = 'ACTIVE';
        // status will be updated by solver
      }
    }

    // 3. Apply Suppression to Joints
    const suppJoints = (config as any).suppressedJoints || [];
    for (const joint of joints) {
      const jId = joint.jointId || joint.id || '';
      if (jId && suppJoints.includes(jId)) {
        joint.suppressionState = 'SUPPRESSED';
      } else {
        joint.suppressionState = 'ACTIVE';
      }
    }

    return { success: true, message: `Applied configuration: ${config.name}` };
  }

  public getConfiguration(id: string): AssemblyConfiguration | undefined {
    return this.configurations.get(id);
  }

  public listConfigurations(): { id: string, name: string }[] {
    return Array.from(this.configurations.values()).map(c => ({ id: c.id, name: c.name }));
  }

  public getCurrentConfigId(): string | null {
    return this.currentConfigId;
  }
}
