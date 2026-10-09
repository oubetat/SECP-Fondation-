/**
 * SECP Industrial OS - PATCH-302: WasmComputeEvidenceGenerator
 * Generates cryptographic SHA-256 evidence records connecting WASM executions,
 * module hashes, ABI compatibility, and digital thread provenance.
 */

import { WasmEvidenceRecord, WasmExecutionResult } from './WasmTypes302';

export class WasmComputeEvidenceGenerator {
  /**
   * Generates a tamper-evident cryptographic evidence record for a WASM execution
   */
  public static async generateEvidence(
    execResult: WasmExecutionResult,
    inputHash: string = '0xinput_default',
    workerId: string = 'worker-main'
  ): Promise<WasmEvidenceRecord> {
    const executionId = `wasm_exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const evidenceId = `EVID-WASM-302-${Date.now().toString(36).toUpperCase()}`;
    const startTime = Date.now() - execResult.durationMs;
    const endTime = Date.now();

    const rawPayload = JSON.stringify({
      evidenceId,
      executionId,
      taskId: execResult.taskId,
      moduleId: execResult.moduleId,
      moduleVersion: execResult.moduleVersion,
      moduleHash: execResult.provenance.moduleHash,
      abi: execResult.provenance.abi,
      inputHash,
      outputHash: execResult.outputHash,
      backend: execResult.executionMode,
      durationMs: execResult.durationMs,
      memoryUsageBytes: execResult.memoryUsageBytes,
      status: execResult.actualBackend === 'JS_FALLBACK' ? 'PARTIAL' : 'PROVEN'
    });

    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(rawPayload));
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const signatureSha256 = '0x' + hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      evidenceId,
      executionId,
      taskId: execResult.taskId,
      moduleId: execResult.moduleId,
      moduleVersion: execResult.moduleVersion,
      moduleHash: execResult.provenance.moduleHash,
      abi: execResult.provenance.abi,
      inputHash,
      outputHash: execResult.outputHash,
      backend: execResult.executionMode,
      simdEnabled: execResult.actualBackend === 'WASM_SIMD',
      workerId,
      startTime,
      endTime,
      durationMs: execResult.durationMs,
      memoryUsageBytes: execResult.memoryUsageBytes,
      status: execResult.actualBackend === 'JS_FALLBACK' ? 'PARTIAL' : 'PROVEN',
      fallback: {
        occurred: execResult.actualBackend === 'JS_FALLBACK',
        requestedBackend: execResult.executionMode,
        actualBackend: execResult.actualBackend,
        reason: execResult.fallbackReason
      },
      signatureSha256,
      timestamp: new Date().toISOString()
    };
  }
}
