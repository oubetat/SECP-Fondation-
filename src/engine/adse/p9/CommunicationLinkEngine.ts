/**
 * SECP — ADSE-P9 Communication Link Engine
 * 
 * Manages link capacity, physical interface bindings, propagation delay,
 * and link reliability/availability calculations.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationLink } from './types';

export class CommunicationLinkEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Computes propagation delay for a given link in milliseconds
   */
  public computeLinkPropagationDelayMs(linkId: string): number {
    const link = this.registry.getLink(linkId);
    if (!link) throw new Error(`Link '${linkId}' not found.`);

    if (link.propagationSpeedMps <= 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Non-positive propagation speed in link '${linkId}'`);
    }

    const propDelaySeconds = link.lengthMeters / link.propagationSpeedMps;
    return propDelaySeconds * 1000;
  }

  /**
   * Computes transmission delay for a message of given size in bytes over a link in milliseconds
   */
  public computeTransmissionDelayMs(linkId: string, messageSizeBytes: number): number {
    const link = this.registry.getLink(linkId);
    if (!link) throw new Error(`Link '${linkId}' not found.`);

    if (link.linkCapacityBps <= 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Non-positive link capacity in link '${linkId}'`);
    }

    const messageBits = messageSizeBytes * 8;
    const transmissionSeconds = messageBits / link.linkCapacityBps;
    return transmissionSeconds * 1000;
  }
}
