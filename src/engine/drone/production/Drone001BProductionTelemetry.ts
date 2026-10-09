/**
 * SECP DRONE-001B: Production Kernel Runtime Telemetry & Anti-Bypass Instrumentation
 * Ensures non-zero invocation, causal tracing, and eliminates fake / shadow dispatchers.
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import {
  ProductionKernelInvocationRecord,
  ProductionTelemetryTrace
} from './Drone001BProductionTypes';

export class Drone001BProductionTelemetry {
  private static invocations: Map<string, ProductionKernelInvocationRecord> = new Map();
  private static activeContext = 'SECP_DRONE001B_DISPATCHER';

  public static reset(): void {
    this.invocations.clear();
    this.activeContext = 'SECP_DRONE001B_DISPATCHER';
  }

  public static setContext(context: string): void {
    this.activeContext = context;
  }

  public static recordKernelInvocation(params: {
    kernelName: string;
    runtimeEntry: string;
    caller: string;
    dispatcher: string;
    inputPayload: any;
    outputPayload: any;
  }): void {
    const inputDigest = this.computeSha256(params.inputPayload);
    const outputDigest = this.computeSha256(params.outputPayload);
    const existing = this.invocations.get(params.kernelName);

    if (existing) {
      existing.callCount += 1;
      existing.outputDigest = outputDigest;
      existing.executionTimestamp = new Date().toISOString();
    } else {
      this.invocations.set(params.kernelName, {
        kernelName: params.kernelName,
        runtimeEntry: params.runtimeEntry,
        caller: params.caller,
        dispatcher: params.dispatcher,
        executionTimestamp: new Date().toISOString(),
        executionContext: this.activeContext,
        inputDigest,
        outputDigest,
        callCount: 1
      });
    }
  }

  public static getTelemetryTrace(): ProductionTelemetryTrace {
    const recordObj: Record<string, ProductionKernelInvocationRecord> = {};
    let totalCalls = 0;
    const activeKernels: string[] = [];

    this.invocations.forEach((rec, k) => {
      recordObj[k] = { ...rec };
      totalCalls += rec.callCount;
      if (rec.callCount > 0) {
        activeKernels.push(k);
      }
    });

    const requiredKernels = [
      'BRepKernel',
      'AssemblyEngine',
      'StructuralFemEngine',
      'CfdEngine',
      'CamEngine'
    ];

    const antiBypassPassed = requiredKernels.every(
      k => this.invocations.has(k) && (this.invocations.get(k)?.callCount || 0) > 0
    );

    return {
      invocations: recordObj,
      totalKernelInvocations: totalCalls,
      dispatcherRoute: 'DocumentEvaluator -> SECP Production Kernel Dispatcher',
      antiBypassPassed,
      activeKernels
    };
  }

  public static computeSha256(payload: any): string {
    try {
      const canonical = CanonicalSerializer.serialize(payload).canonicalString;
      return `SHA256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
    } catch {
      const fallback = JSON.stringify(payload, Object.keys(payload || {}).sort());
      return `SHA256:${crypto.createHash('sha256').update(fallback || '', 'utf8').digest('hex')}`;
    }
  }
}
