import { createHash } from 'crypto';
import { 
  EngineeringChangeOrder, 
  ECOImpactGraph, 
  AffectedImpactNode, 
  ImpactCategory, 
  ImpactSeverity, 
  ImpactAnalysisStatus, 
  ChangeReason 
} from './types';

export interface GraphDependency {
  sourceId: string;
  targetId: string;
  type: 'ASSEMBLY' | 'BOM' | 'MATERIAL' | 'MANUFACTURING' | 'CONFIGURATION';
}

export class ECOImpactAnalyzer {

  public static analyzeImpact(
    eco: EngineeringChangeOrder,
    dependencies: GraphDependency[] = []
  ): ECOImpactGraph {
    const nodes: AffectedImpactNode[] = [];
    const visited = new Set<string>();

    // 1. Direct Impact for listed affected entities
    for (const entityId of eco.affectedEntityIds) {
      if (!visited.has(entityId)) {
        visited.add(entityId);
        nodes.push({
          entityId,
          category: ImpactCategory.DIRECT,
          severity: eco.reason === ChangeReason.SAFETY ? ImpactSeverity.SAFETY_CRITICAL : ImpactSeverity.HIGH,
          reason: `Directly specified target entity in ECO ${eco.ecoNumber}`
        });
      }
    }

    // 2. Traversal for Downstream / Upstream / BOM / Configuration / Manufacturing impacts
    let frontier = [...eco.affectedEntityIds];
    while (frontier.length > 0) {
      const current = frontier.shift()!;
      const linked = dependencies.filter(d => d.targetId === current || d.sourceId === current);

      for (const dep of linked) {
        const isDownstream = dep.targetId === current;
        const neighborId = isDownstream ? dep.sourceId : dep.targetId;

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          frontier.push(neighborId);

          let category = ImpactCategory.INDIRECT;
          if (dep.type === 'ASSEMBLY') {
            category = isDownstream ? ImpactCategory.DOWNSTREAM : ImpactCategory.UPSTREAM;
          } else if (dep.type === 'BOM') {
            category = ImpactCategory.DOWNSTREAM;
          } else if (dep.type === 'CONFIGURATION') {
            category = ImpactCategory.CONFIGURATION;
          } else if (dep.type === 'MANUFACTURING') {
            category = ImpactCategory.MANUFACTURING;
          } else if (dep.type === 'MATERIAL') {
            category = ImpactCategory.MATERIAL;
          }

          const severity = category === ImpactCategory.DOWNSTREAM ? ImpactSeverity.HIGH : ImpactSeverity.MEDIUM;

          nodes.push({
            entityId: neighborId,
            category,
            severity,
            reason: `Linked via ${dep.type} graph dependency from ${current}`
          });
        }
      }
    }

    // Verify completeness: check if all mandatory affected items are categorized
    const isComplete = nodes.length >= eco.affectedEntityIds.length && nodes.some(n => n.category === ImpactCategory.DIRECT);

    const hashSuffix = createHash('sha256').update(`${eco.ecoId}:${nodes.length}:${isComplete}`).digest('hex').slice(0, 8).toUpperCase();
    return {
      impactAnalysisId: `IMP-${eco.ecoId}-${hashSuffix}`,
      ecoId: eco.ecoId,
      nodes,
      status: isComplete ? ImpactAnalysisStatus.COMPLETE : ImpactAnalysisStatus.INCOMPLETE,
      analyzedAt: new Date().toISOString()
    };
  }
}
