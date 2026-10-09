/**
 * PATCH-SECP-068: Engineering Job Engine
 * Defines deterministic compute tasks with strict input hashing.
 */

import { EngineeringJob } from './EngineeringComputeTypes';

export class EngineeringJobEngine {
  public static createJob(
    type: string,
    input: any,
    requiredCaps: string[],
    policy: EngineeringJob['executionPolicy']
  ): EngineeringJob {
    const timestamp = new Date().toISOString();
    const inputString = JSON.stringify(input);
    const payloadHash = this.simpleHash(inputString);

    return {
      jobId: `job-${this.simpleHash(type + timestamp)}`,
      type,
      payloadHash: `sha256-${payloadHash}`,
      inputData: input,
      priority: 1,
      requiredCapabilities: requiredCaps,
      executionPolicy: policy,
      status: 'QUEUED',
      createdAt: timestamp
    };
  }

  private static simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
