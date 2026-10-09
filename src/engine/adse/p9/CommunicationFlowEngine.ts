/**
 * SECP — ADSE-P9 Communication Flow Engine
 * 
 * Manages data flows, messages, protocol validation, and traffic generation.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationDataFlow, FlowPriority, CommunicationProtocol } from './types';

export class CommunicationFlowEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Calculates total required bandwidth across all data flows in a communication system
   */
  public calculateTotalFlowBandwidth(communicationSystemId: string): number {
    const flows = this.registry.getAllDataFlows().filter(
      f => f.communicationSystemId === communicationSystemId
    );

    return flows.reduce((acc, f) => acc + f.requiredBandwidthBps, 0);
  }

  /**
   * Validates that all data flows have valid source/destination nodes and non-zero traffic rates
   */
  public validateFlows(communicationSystemId: string): {
    isValid: boolean;
    errors: string[];
  } {
    const flows = this.registry.getAllDataFlows().filter(
      f => f.communicationSystemId === communicationSystemId
    );

    const errors: string[] = [];

    for (const flow of flows) {
      const src = this.registry.getNode(flow.sourceNodeId);
      const dst = this.registry.getNode(flow.destinationNodeId);

      if (!src || !dst) {
        errors.push(`Data flow '${flow.id}' references invalid source ('${flow.sourceNodeId}') or destination ('${flow.destinationNodeId}').`);
      }

      if (flow.messageRateHz <= 0) {
        errors.push(`Data flow '${flow.id}' has non-positive message rate (${flow.messageRateHz} Hz).`);
      }

      if (flow.messageSizeBytes <= 0) {
        errors.push(`Data flow '${flow.id}' has non-positive message size (${flow.messageSizeBytes} bytes).`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
