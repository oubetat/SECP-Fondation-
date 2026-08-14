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
      const override = config.componentOverrides[comp.instanceId];
      if (override && override.suppressed !== undefined) {
        comp.suppressed = override.suppressed;
      } else {
        // Default to not suppressed if not in override? 
        // Or keep current? Usually config defines a total state.
      }
      
      if (override && override.placementTransform) {
         comp.placementTransform = override.placementTransform;
      }
    }

    // 2. Apply Suppression to Constraints
    for (const constraint of constraints) {
      if (config.suppressedConstraints.includes(constraint.constraintId)) {
        constraint.suppressionState = 'SUPPRESSED';
        constraint.status = 'SUPPRESSED';
      } else {
        constraint.suppressionState = 'ACTIVE';
        // status will be updated by solver
      }
    }

    // 3. Apply Suppression to Joints
    for (const joint of joints) {
      if (config.suppressedJoints.includes(joint.jointId)) {
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
