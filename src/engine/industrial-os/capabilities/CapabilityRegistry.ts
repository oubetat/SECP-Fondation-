import { EngineeringCapability } from './types';
import { CapabilityIdentity } from './CapabilityIdentity';
import { CapabilityGraph } from './CapabilityGraph';

export class CapabilityRegistry {
  private readonly capabilities: Map<string, EngineeringCapability> = new Map();

  public register(capability: EngineeringCapability): void {
    // 1. Validate capability Identity
    try {
      CapabilityIdentity.parse(capability.id, capability.version);
    } catch (e: any) {
      throw new Error(`Capability registration failed: ${e.message}`);
    }

    // 2. Prevent duplicates
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability registration rejected: Duplicate ID '${capability.id}' detected.`);
    }

    // 3. Validate executionMode
    const validModes = ['LOCAL', 'WORKER', 'NATIVE', 'GPU', 'WASM', 'REMOTE', 'HYBRID', 'SIMULATED'];
    if (!validModes.includes(capability.executionMode)) {
      throw new Error(`Capability registration rejected: Invalid executionMode '${capability.executionMode}'.`);
    }

    // 4. Validate initial status
    const validStatuses = ['PROVEN', 'PARTIAL', 'UNPROVEN', 'UNAVAILABLE'];
    if (!validStatuses.includes(capability.status)) {
      throw new Error(`Capability registration rejected: Invalid status '${capability.status}'.`);
    }

    // 5. Build a provisional graph to test for circular dependencies
    const tempGraph = new CapabilityGraph();
    // Register existing capabilities
    for (const cap of Array.from(this.capabilities.values())) {
      tempGraph.addNode(cap.id);
      for (const dep of cap.requiredCapabilities) {
        tempGraph.addEdge(cap.id, dep);
      }
    }
    // Provisionally add the new capability and its dependencies
    tempGraph.addNode(capability.id);
    for (const dep of capability.requiredCapabilities) {
      // Allow depending on yet-to-be-registered capabilities in the graph structure (they will be qualified as UNAVAILABLE dynamically at runtime)
      tempGraph.addEdge(capability.id, dep);
    }

    // Check for circular dependencies
    if (tempGraph.hasCycle()) {
      throw new Error(`Capability registration rejected: Circular dependency detected for '${capability.id}'.`);
    }

    // 6. Ensure metadata is parsed or exists
    const safeMetadata = capability.metadata || {};

    // 7. Store frozen copy
    const frozenCap = Object.freeze({
      ...capability,
      providerIds: Object.freeze([...(capability.providerIds || [])]),
      requiredCapabilities: Object.freeze([...(capability.requiredCapabilities || [])]),
      supportedObjectTypes: Object.freeze([...(capability.supportedObjectTypes || [])]),
      requiredPolicies: Object.freeze([...(capability.requiredPolicies || [])]),
      evidenceIds: Object.freeze([...(capability.evidenceIds || [])]),
      metadata: Object.freeze({ ...safeMetadata })
    });

    this.capabilities.set(capability.id, frozenCap);
  }

  public get(capabilityId: string): EngineeringCapability | undefined {
    return this.capabilities.get(capabilityId);
  }

  public has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  public list(): EngineeringCapability[] {
    return Array.from(this.capabilities.values());
  }

  public resolve(capabilityId: string): EngineeringCapability | undefined {
    return this.get(capabilityId);
  }

  public remove(capabilityId: string): void {
    this.capabilities.delete(capabilityId);
  }

  public clear(): void {
    this.capabilities.clear();
  }
}
