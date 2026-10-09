import { EngineeringCapability, ResolvedCapability, CapabilityProvider, CapabilityStatus, CapabilityExecutionMode } from './types';
import { CapabilityRegistry } from './CapabilityRegistry';
import { CapabilityGraph } from './CapabilityGraph';
import { CapabilityQualificationService } from './CapabilityQualificationService';

export class CapabilityResolver {
  private readonly registry: CapabilityRegistry;
  private readonly qualificationService: CapabilityQualificationService;
  private readonly providers: Map<string, CapabilityProvider> = new Map();

  constructor(registry: CapabilityRegistry, qualificationService: CapabilityQualificationService) {
    this.registry = registry;
    this.qualificationService = qualificationService;
  }

  public registerProvider(provider: CapabilityProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProviderFor(capabilityId: string): CapabilityProvider | undefined {
    for (const provider of Array.from(this.providers.values())) {
      if (provider.canProvide(capabilityId)) {
        return provider;
      }
    }
    return undefined;
  }

  public removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  public clearProviders(): void {
    this.providers.clear();
  }

  /**
   * Determine whether a capability can be executed in the current runtime context.
   * Performs recursive dependency checks and handles status propagation.
   */
  public resolve(capabilityId: string): ResolvedCapability {
    const capability = this.registry.get(capabilityId);
    
    // 1. If not registered, return UNAVAILABLE
    if (!capability) {
      return {
        capabilityId,
        status: 'UNAVAILABLE',
        executable: false,
        providerId: null,
        executionMode: 'LOCAL',
        missingRequirements: ['CAPABILITY_REGISTRATION_MISSING'],
        evidenceIds: [],
        qualificationPath: ['START_RESOLUTION', 'CAPABILITY_NOT_FOUND_IN_REGISTRY']
      };
    }

    const qualificationPath: string[] = ['START_RESOLUTION'];
    const missingRequirements: string[] = [];

    // 2. Build Capability Graph to evaluate dependencies & check for cycles
    const graph = CapabilityGraph.buildFromRegistry(this.registry);
    if (graph.hasCycle()) {
      return {
        capabilityId,
        status: 'UNAVAILABLE',
        executable: false,
        providerId: null,
        executionMode: capability.executionMode,
        missingRequirements: ['CIRCULAR_DEPENDENCY_PREVENTS_EXECUTION'],
        evidenceIds: [],
        qualificationPath: ['CIRCULAR_DEPENDENCY_DETECTED']
      };
    }

    // 3. Resolve all direct and transitive dependencies first
    const transitiveDeps = graph.getTransitiveDependencies(capabilityId);
    for (const depId of transitiveDeps) {
      // Resolve each dependency
      const depResolution = this.resolve(depId);
      if (depResolution.status === 'UNAVAILABLE') {
        qualificationPath.push(`DEPENDENCY_UNAVAILABLE::${depId}`);
        missingRequirements.push(`UNSATISFIED_DEPENDENCY::${depId}`);
        return {
          capabilityId,
          status: 'UNAVAILABLE',
          executable: false,
          providerId: null,
          executionMode: capability.executionMode,
          missingRequirements,
          evidenceIds: [...capability.evidenceIds],
          qualificationPath
        };
      }
    }

    // 4. Find the matching provider for this capability
    const provider = this.getProviderFor(capabilityId);

    // 5. Run the qualification service to assess evidence, fallbacks, and physical hardware validation
    const qualification = this.qualificationService.qualify(capability, provider);

    const isExecutable =
      capability.enabled &&
      provider !== undefined &&
      (qualification.status === 'PROVEN' || qualification.status === 'PARTIAL');

    return {
      capabilityId,
      status: qualification.status,
      executable: isExecutable,
      providerId: provider ? provider.id : null,
      executionMode: capability.executionMode,
      missingRequirements: [...missingRequirements, ...qualification.missingRequirements],
      evidenceIds: [...capability.evidenceIds],
      qualificationPath: [...qualificationPath, ...qualification.qualificationPath]
    };
  }

  /**
   * Evaluates if a capability can operate on a specific Engineering Object model.
   */
  public canOperateOn(capability: EngineeringCapability, object: any): { allowed: boolean; reason?: string } {
    if (!capability.supportedObjectTypes.includes(object.objectType)) {
      return {
        allowed: false,
        reason: `CAPABILITY_REJECTION: Object type '${object.objectType}' is not supported by capability '${capability.id}'. Supported types: [${capability.supportedObjectTypes.join(', ')}].`
      };
    }

    if (object.status === 'INVALIDATED') {
      return {
        allowed: false,
        reason: `CAPABILITY_REJECTION: Object '${object.id}' is in INVALIDATED state and cannot be processed.`
      };
    }

    if (object.status === 'ARCHIVED') {
      return {
        allowed: false,
        reason: `CAPABILITY_REJECTION: Object '${object.id}' is ARCHIVED.`
      };
    }

    return { allowed: true };
  }

  /**
   * Helper builder to construct CapabilityGraph from Registry.
   */
  public static buildGraph(registry: CapabilityRegistry): CapabilityGraph {
    return CapabilityGraph.buildFromRegistry(registry);
  }
}

