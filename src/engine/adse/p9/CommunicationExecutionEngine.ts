/**
 * SECP — ADSE-P9 Communication Execution Engine
 * 
 * Interacts with CoreExecutionAuthority to dispatch communication analysis,
 * seal execution envelopes, and record provenance and evidence.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationAnalysisEngine } from './CommunicationAnalysisEngine';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { GenericExecutionEnvelope } from '../../execution/CoreExecutionTypes';

export class CommunicationExecutionEngine {
  private registry: CommunicationRegistry;
  private analysisEngine: CommunicationAnalysisEngine;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
    this.analysisEngine = new CommunicationAnalysisEngine(registry);
  }

  /**
   * Dispatches solver execution for a Communication Request
   */
  public solve(request: any, snapshot: any) {
    const commSystemId = request.parameters.communicationSystemId;
    if (!commSystemId) {
      throw new Error('INVALID_COMM_EXECUTION_REQUEST: Missing communicationSystemId in parameters.');
    }

    const analysis = this.analysisEngine.analyzeCommunicationSystem(commSystemId);

    const solvedAt = new Date().toISOString();
    const rawResults: Record<string, any> = {
      revisionId: request.revisionId || 'UNKNOWN',
      busBandwidthMbps: snapshot?.busBandwidthMbps || 100,
      bandwidthBudget: analysis.bandwidthBudget,
      latencyBudget: analysis.latencyBudget,
      queueAnalysis: analysis.queueAnalysis,
      reliabilityAvailability: analysis.reliabilityAvailability,
      findingsCount: analysis.findings.length,
      overallVerdict: analysis.overallVerdict
    };

    return {
      status: 'SUCCESS' as const,
      rawResults,
      solvedAt,
      artifactContentHash: request.executionId || 'COMM-HASH-ARTIFACT',
      scalarOutputs: {
        allocatedBandwidthMbps: parseFloat((analysis.bandwidthBudget.allocatedBps / 1e6).toFixed(2)),
        totalLatencyMs: analysis.latencyBudget.totalLatencyMs,
        pathReliabilityPct: parseFloat((analysis.reliabilityAvailability.pathReliability * 100).toFixed(2))
      },
      executionDurationMs: 10
    };
  }

  /**
   * High-level entry point to execute communication analysis through CoreExecutionAuthority
   */
  public async runExecution(params: {
    executionId: string;
    communicationSystemId: string;
    scenarioId: string;
    durationSeconds?: number;
  }): Promise<GenericExecutionEnvelope> {
    const commSystem = this.registry.getSystem(params.communicationSystemId);
    if (!commSystem) {
      throw new Error(`COMM_SYSTEM_NOT_FOUND: '${params.communicationSystemId}'`);
    }

    const envelope = await CoreExecutionAuthority.execute({
      requestId: `req-exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pluginId: 'adse-p9-communications',
      pluginVersion: '1.0.0',
      engineeringObjectId: commSystem.p3ArchitectureId,
      executionKind: 'communication-analysis',
      revisionId: commSystem.revisionId,
      parameters: {
        communicationSystemId: params.communicationSystemId,
        scenarioId: params.scenarioId
      }
    });

    return envelope;
  }
}
