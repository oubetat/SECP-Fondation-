import { ConfigurationRegistry } from './ConfigurationRegistry';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { ConfigurationItem, ConfigurationDependency } from './types';

export interface ImpactReport {
  affectedItemIds: string[];
  impactedMechanicalNodes: string[];
  impactedSystemNodes: string[];
  impactedRequirements: string[];
  impactedInterfaces: string[];
  impactedSimulations: string[];
  impactedManufacturingSteps: string[];
  impactedMetrologyRecords: string[];
  impactedSafetyClaims: string[];
  impactedVerificationGates: string[];
  impactedEvidenceRefs: string[];
}

export class ConfigurationImpactEngine {
  private registry: ConfigurationRegistry;
  private digitalThread: DigitalThreadRegistry;

  constructor(registry: ConfigurationRegistry, digitalThread: DigitalThreadRegistry) {
    this.registry = registry;
    this.digitalThread = digitalThread;
  }

  /**
   * Performs deep, multi-domain configuration impact analysis across the SECP Digital Thread.
   * Walks down the dependency graph, tracking mechanical, system, requirement, interface,
   * simulation, manufacturing, metrology, and safety impacts.
   */
  public analyzeImpact(affectedItemIds: string[]): ImpactReport {
    const report: ImpactReport = {
      affectedItemIds: [...affectedItemIds],
      impactedMechanicalNodes: [],
      impactedSystemNodes: [],
      impactedRequirements: [],
      impactedInterfaces: [],
      impactedSimulations: [],
      impactedManufacturingSteps: [],
      impactedMetrologyRecords: [],
      impactedSafetyClaims: [],
      impactedVerificationGates: [],
      impactedEvidenceRefs: []
    };

    const visited = new Set<string>();
    const queue = [...affectedItemIds];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // 1. Direct local dependencies from registry
      const localDeps = Array.from(this.registry.dependencies.values()).filter(
        d => d.sourceId === currentId || d.targetId === currentId
      );

      for (const d of localDeps) {
        const otherId = d.sourceId === currentId ? d.targetId : d.sourceId;
        if (!visited.has(otherId)) {
          queue.push(otherId);
        }

        switch (d.dependencyType) {
          case 'MECHANICAL':
            report.impactedMechanicalNodes.push(otherId);
            break;
          case 'SYSTEM':
            report.impactedSystemNodes.push(otherId);
            break;
          case 'REQUIREMENT':
            report.impactedRequirements.push(otherId);
            break;
          case 'INTERFACE':
            report.impactedInterfaces.push(otherId);
            break;
          case 'SIMULATION':
            report.impactedSimulations.push(otherId);
            break;
          case 'MANUFACTURING':
            report.impactedManufacturingSteps.push(otherId);
            break;
          case 'METROLOGY':
            report.impactedMetrologyRecords.push(otherId);
            break;
          case 'SAFETY':
            report.impactedSafetyClaims.push(otherId);
            break;
        }
      }

      // 2. Walk Digital Thread nodes and edges
      // Query edges connected to currentId's Thread Node representation
      const threadNodeId = `thread:config-item:${currentId}`;
      const edges = this.digitalThread.getAllEdges ? this.digitalThread.getAllEdges() : [];
      
      for (const edge of edges) {
        if (edge.sourceNodeId === threadNodeId || edge.targetNodeId === threadNodeId) {
          const neighborId = edge.sourceNodeId === threadNodeId ? edge.targetNodeId : edge.sourceNodeId;
          const canonicalNeighborId = neighborId.split(':').pop() || '';

          if (edge.edgeType === 'AFFECTS' || edge.edgeType === 'DEPENDS_ON' || edge.edgeType === 'CONFIGURES') {
            if (!visited.has(canonicalNeighborId)) {
              queue.push(canonicalNeighborId);
            }
          }

          if (neighborId.startsWith('thread:requirement:')) {
            report.impactedRequirements.push(canonicalNeighborId);
          } else if (neighborId.startsWith('thread:safety-claim:')) {
            report.impactedSafetyClaims.push(canonicalNeighborId);
          } else if (neighborId.startsWith('thread:safety-hazard:')) {
            report.impactedSafetyClaims.push(`hazard:${canonicalNeighborId}`);
          } else if (neighborId.startsWith('thread:verification:')) {
            report.impactedVerificationGates.push(canonicalNeighborId);
          }
        }
      }
    }

    // Deduplicate lists
    report.impactedMechanicalNodes = [...new Set(report.impactedMechanicalNodes)];
    report.impactedSystemNodes = [...new Set(report.impactedSystemNodes)];
    report.impactedRequirements = [...new Set(report.impactedRequirements)];
    report.impactedInterfaces = [...new Set(report.impactedInterfaces)];
    report.impactedSimulations = [...new Set(report.impactedSimulations)];
    report.impactedManufacturingSteps = [...new Set(report.impactedManufacturingSteps)];
    report.impactedMetrologyRecords = [...new Set(report.impactedMetrologyRecords)];
    report.impactedSafetyClaims = [...new Set(report.impactedSafetyClaims)];
    report.impactedVerificationGates = [...new Set(report.impactedVerificationGates)];
    report.impactedEvidenceRefs = [...new Set(report.impactedEvidenceRefs)];

    return report;
  }
}
