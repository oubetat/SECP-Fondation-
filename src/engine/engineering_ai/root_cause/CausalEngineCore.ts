import { FailureSignature, FailureCategory } from './types';
import { ForensicSimulationRecord } from '../simulation/types';

export class FailureNormalizer {
  public static normalize(record: ForensicSimulationRecord): FailureSignature[] {
    const signatures: FailureSignature[] = [];

    // Extract from diagnostics
    record.diagnostics.forEach(diag => {
      signatures.push({
        failureId: `FAIL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        domain: 'SIMULATION',
        category: this.mapEventToCategory(diag.event),
        observable: diag.event,
        metric: 'DIAGNOSTIC_VERDICT',
        observedValue: diag.verdict === 'FAILED' ? 1 : 0,
        expectedRange: [0, 0],
        threshold: 0,
        severity: diag.severity as any || 'MAJOR',
        source: 'DIAGNOSTIC_ENGINE'
      });
    });

    // Extract from timeline
    record.timeline.filter(t => t.event === 'FAILURE' || (t.details && t.details.verdict === 'PHYSICS_VIOLATION')).forEach(t => {
      signatures.push({
        failureId: `FAIL-TL-${Date.now()}`,
        domain: 'TIMELINE',
        category: t.event === 'FAILURE' ? 'SOLVER_FAILURE' : 'MODEL_FAILURE',
        observable: t.event,
        metric: 'TIMELINE_EVENT',
        observedValue: 1,
        expectedRange: [0, 0],
        threshold: 0,
        severity: 'CRITICAL',
        source: 'SIMULATION_TIMELINE'
      });
    });

    return signatures;
  }

  private static mapEventToCategory(event: string): FailureCategory {
    if (event.includes('MESH')) return 'MESH_FAILURE';
    if (event.includes('PHYSICS')) return 'MODEL_FAILURE';
    if (event.includes('CONVERGENCE')) return 'CONVERGENCE_FAILURE';
    if (event.includes('INPUT')) return 'INPUT_FAILURE';
    return 'SOLVER_FAILURE';
  }
}

export class CausalGraph {
  private nodes: Map<string, any> = new Map();
  private edges: any[] = [];

  public addNode(id: string, type: string, label: string, metadata: Record<string, any> = {}) {
    this.nodes.set(id, { id, type, label, metadata });
  }

  public addEdge(sourceId: string, targetId: string, relation: string, mechanism: string, evidenceId?: string) {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      throw new Error(`Node not found: ${sourceId} or ${targetId}`);
    }
    this.edges.push({ sourceId, targetId, relation, mechanism, evidenceId });
  }

  public getGraphData() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  public getHash(): string {
    const data = JSON.stringify(this.getGraphData());
    // Using a simple hash for internal representation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}
