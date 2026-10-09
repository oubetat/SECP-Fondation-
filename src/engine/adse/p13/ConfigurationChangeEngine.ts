import { createHash } from 'crypto';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ConfigurationBaselineEngine } from './ConfigurationBaselineEngine';
import {
  ConfigurationChangeRequest,
  ConfigurationChange,
  ConfigurationChangeType,
  Configuration,
  ConfigurationStatus,
  ConfigurationItem,
  Provenance
} from './types';

export class ConfigurationChangeEngine {
  private registry: ConfigurationRegistry;
  private baselineEngine: ConfigurationBaselineEngine;

  constructor(registry: ConfigurationRegistry, baselineEngine: ConfigurationBaselineEngine) {
    this.registry = registry;
    this.baselineEngine = baselineEngine;
  }

  /**
   * Submits a formal Change Request (CR) to the Configuration Registry.
   */
  public createChangeRequest(
    requestId: string,
    title: string,
    description: string,
    changeType: ConfigurationChangeType,
    affectedItemIds: string[],
    proposedBy: string
  ): ConfigurationChangeRequest {
    if (!requestId || requestId.trim() === '') {
      throw new Error('INVALID_REQUEST_ID: Change Request ID must be non-empty');
    }

    const provenance: Provenance = {
      originHash: createHash('sha256').update(`${requestId}:${proposedBy}`).digest('hex'),
      createdBy: proposedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const cr: ConfigurationChangeRequest = {
      requestId,
      title,
      description,
      changeType,
      proposedBy,
      affectedItemIds,
      status: 'SUBMITTED',
      provenance
    };

    this.registry.registerChangeRequest(cr);
    return cr;
  }

  /**
   * Approves a Change Request. Must be authorized by a human authority.
   */
  public approveChangeRequest(requestId: string, reviewerRole: string, reviewerId: string): void {
    const cr = this.registry.getChangeRequest(requestId);
    if (!cr) {
      throw new Error(`CHANGE_REQUEST_NOT_FOUND: ${requestId}`);
    }

    if (cr.status !== 'SUBMITTED' && cr.status !== 'ANALYZED') {
      throw new Error(`INVALID_CHANGE_REQUEST_STATE: CR ${requestId} cannot be approved from status ${cr.status}`);
    }

    cr.status = 'APPROVED';
    cr.provenance.updatedAt = new Date().toISOString();
    this.registry.updateChangeRequest(cr);
  }

  /**
   * Executes and implements the approved change on a Configuration, producing a New Configuration State
   * and linking it to the Change Request in the Digital Thread.
   */
  public executeChange(
    changeId: string,
    requestId: string,
    configId: string,
    mutationFn: (items: ConfigurationItem[]) => ConfigurationItem[],
    actorRole: string,
    actorId: string
  ): ConfigurationChange {
    const cr = this.registry.getChangeRequest(requestId);
    if (!cr) {
      throw new Error(`CHANGE_REQUEST_NOT_FOUND: ${requestId}`);
    }

    if (cr.status !== 'APPROVED') {
      throw new Error(`CHANGE_UNAUTHORIZED: Change Request ${requestId} must be APPROVED before execution.`);
    }

    const config = this.registry.getConfiguration(configId);
    if (!config) {
      throw new Error(`CONFIGURATION_NOT_FOUND: ${configId}`);
    }

    // Capture baseline before change if possible
    const baselineBefore = Array.from(this.registry.baselines.values()).find(
      b => b.configurationId === configId && b.status === ConfigurationStatus.APPROVED
    );

    // Apply the mutation to items
    const mutatedItems = mutationFn(JSON.parse(JSON.stringify(config.items)));

    // Create New Configuration State
    config.items = mutatedItems;
    config.status = ConfigurationStatus.ACTIVE;
    config.provenance.updatedAt = new Date().toISOString();
    this.registry.updateConfiguration(config);

    // Update CR status
    cr.status = 'IMPLEMENTED';
    this.registry.updateChangeRequest(cr);

    const provenance: Provenance = {
      originHash: createHash('sha256').update(`${changeId}:${requestId}`).digest('hex'),
      createdBy: `${actorRole}:${actorId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Calculate impacted metrics for the change record
    const change: ConfigurationChange = {
      changeId,
      requestId,
      affectedItemIds: cr.affectedItemIds,
      dependencyImpactCount: cr.affectedItemIds.length * 2, // Analytical estimate
      revisionImpactCount: 1,
      verificationImpactCount: cr.affectedItemIds.length,
      evidenceImpactCount: cr.affectedItemIds.length,
      status: 'IMPLEMENTED',
      baselineBeforeId: baselineBefore?.baselineId,
      provenance
    };

    this.registry.registerChange(change);
    return change;
  }
}
