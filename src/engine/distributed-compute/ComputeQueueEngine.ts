/**
 * PATCH-SECP-068: Compute Queue Engine
 * Manages job ordering and idempotency.
 */

import { EngineeringJob } from './EngineeringComputeTypes';

export class ComputeQueueEngine {
  private static queue: EngineeringJob[] = [];
  private static processedHashes: Set<string> = new Set();

  public static enqueue(job: EngineeringJob): boolean {
    // Idempotency check
    if (this.processedHashes.has(job.payloadHash)) {
      return false;
    }

    this.queue.push(job);
    this.processedHashes.add(job.payloadHash);
    return true;
  }

  public static dequeue(): EngineeringJob | undefined {
    return this.queue.shift();
  }

  public static getLength(): number {
    return this.queue.length;
  }
}
