/**
 * SECP — ADSE-P9 Communication Analysis Engine
 * 
 * Performs deterministic engineering computations for Communications Integration:
 * - Bandwidth Budgeting
 * - Latency Budgeting
 * - Queue & Buffer Analysis
 * - Reliability & Availability Modeling
 * - Path Integrity & Flow Consistency Evaluation
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import {
  BandwidthBudget,
  LatencyBudget,
  QueueAnalysis,
  ReliabilityAvailabilityResult,
  CommunicationFinding,
  CommunicationExecutionResult
} from './types';

export class CommunicationAnalysisEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Performs complete communication engineering analysis for a given system
   */
  public analyzeCommunicationSystem(communicationSystemId: string): {
    bandwidthBudget: BandwidthBudget;
    latencyBudget: LatencyBudget;
    queueAnalysis: QueueAnalysis;
    reliabilityAvailability: ReliabilityAvailabilityResult;
    findings: CommunicationFinding[];
    overallVerdict: 'PASS' | 'FAIL';
  } {
    const findings: CommunicationFinding[] = [];

    // 1. Bandwidth Budget Analysis
    const links = this.registry.getAllLinks().filter(l => l.communicationSystemId === communicationSystemId);
    const flows = this.registry.getAllDataFlows().filter(f => f.communicationSystemId === communicationSystemId);

    const totalCapacityBps = links.reduce((sum, l) => sum + l.linkCapacityBps, 0);
    const allocatedBps = flows.reduce((sum, f) => sum + f.requiredBandwidthBps, 0);
    const remainingBps = totalCapacityBps - allocatedBps;
    const marginPct = totalCapacityBps > 0 ? (remainingBps / totalCapacityBps) * 100 : -100;
    const isOverflow = allocatedBps > totalCapacityBps;

    if (isOverflow) {
      findings.push({
        findingId: `FIND-BW-OVERFLOW-${communicationSystemId}`,
        category: 'BANDWIDTH',
        severity: 'CRITICAL',
        message: `Total data flow bandwidth demand (${(allocatedBps / 1e6).toFixed(2)} Mbps) exceeds available link capacity (${(totalCapacityBps / 1e6).toFixed(2)} Mbps).`,
        affectedEntityId: communicationSystemId
      });
    }

    const bandwidthBudget: BandwidthBudget = {
      totalCapacityBps,
      allocatedBps,
      remainingBps,
      marginPct: parseFloat(marginPct.toFixed(2)),
      isOverflow
    };

    // 2. Latency Budget Analysis
    let totalSourceDelay = 0;
    let totalQueueDelay = 0;
    let totalTransmissionDelay = 0;
    let totalProcessingDelay = 0;
    let totalPropagationDelay = 0;
    let maxAllowedLatency = Infinity;

    const nodes = this.registry.getAllNodes().filter(n => n.communicationSystemId === communicationSystemId);
    totalProcessingDelay = nodes.reduce((sum, n) => sum + n.processingDelayMs, 0);

    for (const link of links) {
      const propDelaySec = link.lengthMeters / link.propagationSpeedMps;
      totalPropagationDelay += propDelaySec * 1000;
    }

    for (const flow of flows) {
      if (flow.maxLatencyMs < maxAllowedLatency) {
        maxAllowedLatency = flow.maxLatencyMs;
      }
      // Estimate transmission delay for flow message on main link
      if (links.length > 0) {
        const transSec = (flow.messageSizeBytes * 8) / links[0].linkCapacityBps;
        totalTransmissionDelay += transSec * 1000;
      }
    }

    if (maxAllowedLatency === Infinity) maxAllowedLatency = 100.0; // Default requirement fallback

    // M/M/1 queuing approximation for queuing delay
    const totalMsgsPerSec = flows.reduce((sum, f) => sum + f.messageRateHz, 0);
    const avgMsgSizeBytes = flows.length > 0 ? flows.reduce((sum, f) => sum + f.messageSizeBytes, 0) / flows.length : 64;
    const linkBps = links.length > 0 ? links[0].linkCapacityBps : 100e6;
    const serviceRateMsgsPerSec = linkBps / (avgMsgSizeBytes * 8);

    if (totalMsgsPerSec < serviceRateMsgsPerSec) {
      const queueTimeSec = 1 / (serviceRateMsgsPerSec - totalMsgsPerSec);
      totalQueueDelay = queueTimeSec * 1000;
    } else {
      totalQueueDelay = 50.0; // Queue overload delay penalty
    }

    const totalLatencyMs = totalSourceDelay + totalQueueDelay + totalTransmissionDelay + totalProcessingDelay + totalPropagationDelay;
    const isLatencyViolation = totalLatencyMs > maxAllowedLatency;

    if (isLatencyViolation) {
      findings.push({
        findingId: `FIND-LATENCY-VIOLATION-${communicationSystemId}`,
        category: 'LATENCY',
        severity: 'CRITICAL',
        message: `Calculated total end-to-end latency (${totalLatencyMs.toFixed(2)} ms) exceeds maximum allowed threshold (${maxAllowedLatency.toFixed(2)} ms).`,
        affectedEntityId: communicationSystemId
      });
    }

    const latencyBudget: LatencyBudget = {
      sourceDelayMs: parseFloat(totalSourceDelay.toFixed(3)),
      queueDelayMs: parseFloat(totalQueueDelay.toFixed(3)),
      transmissionDelayMs: parseFloat(totalTransmissionDelay.toFixed(3)),
      processingDelayMs: parseFloat(totalProcessingDelay.toFixed(3)),
      propagationDelayMs: parseFloat(totalPropagationDelay.toFixed(3)),
      totalLatencyMs: parseFloat(totalLatencyMs.toFixed(3)),
      maxAllowedLatencyMs: parseFloat(maxAllowedLatency.toFixed(3)),
      isViolation: isLatencyViolation
    };

    // 3. Queue & Buffer Analysis
    const totalBufferCapacity = nodes.reduce((sum, n) => sum + n.bufferCapacityBytes, 0);
    const currentQueueLengthBytes = Math.round(totalMsgsPerSec * avgMsgSizeBytes * (totalQueueDelay / 1000));
    const utilizationRatio = serviceRateMsgsPerSec > 0 ? totalMsgsPerSec / serviceRateMsgsPerSec : 1.0;
    const isOverloaded = utilizationRatio >= 1.0;
    const isBufferOverflow = currentQueueLengthBytes > totalBufferCapacity && totalBufferCapacity > 0;

    if (isOverloaded || isBufferOverflow) {
      findings.push({
        findingId: `FIND-QUEUE-OVERFLOW-${communicationSystemId}`,
        category: 'QUEUE_OVERFLOW',
        severity: 'FATAL',
        message: `Queue/Buffer overflow detected. Utilization ratio=${utilizationRatio.toFixed(2)}, Queue size=${currentQueueLengthBytes} bytes vs Buffer=${totalBufferCapacity} bytes.`,
        affectedEntityId: communicationSystemId
      });
    }

    const queueAnalysis: QueueAnalysis = {
      arrivalRateMsgsPerSec: parseFloat(totalMsgsPerSec.toFixed(2)),
      serviceRateMsgsPerSec: parseFloat(serviceRateMsgsPerSec.toFixed(2)),
      bufferCapacityBytes: totalBufferCapacity,
      currentQueueLengthBytes,
      utilizationRatio: parseFloat(utilizationRatio.toFixed(3)),
      isOverloaded,
      isBufferOverflow
    };

    // 4. Reliability & Availability Modeling
    let pathReliability = 1.0;
    let pathAvailability = 1.0;

    for (const link of links) {
      pathReliability *= link.reliability;
      pathAvailability *= link.availability;
    }

    const meetsReqs = pathReliability >= 0.99 && pathAvailability >= 0.99;
    if (!meetsReqs) {
      findings.push({
        findingId: `FIND-RELIABILITY-FAIL-${communicationSystemId}`,
        category: 'RELIABILITY',
        severity: 'WARNING',
        message: `Path reliability (${(pathReliability * 100).toFixed(2)}%) or availability (${(pathAvailability * 100).toFixed(2)}%) falls below 99% requirement.`,
        affectedEntityId: communicationSystemId
      });
    }

    const reliabilityAvailability: ReliabilityAvailabilityResult = {
      pathReliability: parseFloat(pathReliability.toFixed(4)),
      pathAvailability: parseFloat(pathAvailability.toFixed(4)),
      meetsRequirements: meetsReqs
    };

    const overallVerdict = (isOverflow || isLatencyViolation || isBufferOverflow) ? 'FAIL' : 'PASS';

    return {
      bandwidthBudget,
      latencyBudget,
      queueAnalysis,
      reliabilityAvailability,
      findings,
      overallVerdict
    };
  }
}
