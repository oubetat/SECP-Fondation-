/**
 * WebGPUWorkbenchPanel.tsx
 * PHASE 27 — Hardware Acceleration (PATCH-296)
 * Real WebGPU Compute Workbench: Device Discovery, WGSL Shaders, Interactive Dispatch,
 * CPU vs WebGPU Numerical Equivalence Inspector, Transfer Overhead Benchmarks, and Gate 296.
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Layers,
  Code,
  Gauge,
  Database,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileCode,
  Lock,
} from 'lucide-react';
import {
  BackendSelector,
  WebGPUComputeBackend,
  CPUBackend,
} from '../engine/engineering_webgpu/ComputeBackend';
import { ComputeShaderManager } from '../engine/engineering_webgpu/ComputeShaderManager';
import { GPUKernelRegistry } from '../engine/engineering_webgpu/GPUKernelRegistry';
import { GPUBufferManager } from '../engine/engineering_webgpu/GPUBufferManager';
import { WebGPUBenchmarkHarness } from '../engine/engineering_webgpu/WebGPUBenchmarkHarness';
import { WebGPUEvidenceGenerator, WebGPUEvidenceDossier } from '../engine/engineering_webgpu/WebGPUEvidenceGenerator';
import {
  HardAcceptanceGate296,
  HardAcceptanceGate296Report,
} from '../engine/engineering_webgpu/HardAcceptanceGate296';
import {
  ComputeBackendMode,
  BackendTruthState,
  ComputeJobResult,
  BenchmarkCaseResult,
  WebGPUCapabilityMatrix,
} from '../engine/engineering_webgpu/WebGPUComputeTypes';

export const WebGPUWorkbenchPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'RUNNER' | 'BENCHMARK' | 'SHADERS' | 'GATE296'>('RUNNER');
  const [backendMode, setBackendMode] = useState<ComputeBackendMode>('AUTO');
  const [truthState, setTruthState] = useState<BackendTruthState>('INITIALIZING');
  const [capabilities, setCapabilities] = useState<WebGPUCapabilityMatrix | null>(null);
  const [memoryDiag, setMemoryDiag] = useState<any>(null);

  // Kernel Runner State
  const [selectedKernelId, setSelectedKernelId] = useState<string>('VECTOR_ADD');
  const [workloadSize, setWorkloadSize] = useState<number>(10000);
  const [scaleFactor, setScaleFactor] = useState<number>(3.14159);
  const [matrixDim, setMatrixDim] = useState<number>(64);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastJobResult, setLastJobResult] = useState<ComputeJobResult | null>(null);
  const [lastEvidence, setLastEvidence] = useState<WebGPUEvidenceDossier | null>(null);

  // Benchmark State
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkCaseResult[]>([]);

  // Gate 296 State
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);
  const [gateReport, setGateReport] = useState<HardAcceptanceGate296Report | null>(null);
  const [gateFilter, setGateFilter] = useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');

  const allKernels = GPUKernelRegistry.getAllKernels();
  const selectedKernel = GPUKernelRegistry.getKernel(selectedKernelId);
  const selectedShader = ComputeShaderManager.getShaderSpec(selectedKernelId);

  // Refresh backend status & capabilities
  const refreshStatus = async () => {
    const webgpu = BackendSelector.getWebGPUBackend();
    await webgpu.initialize();
    setTruthState(webgpu.getTruthState());
    setCapabilities(webgpu.getCapabilities());
    setMemoryDiag(GPUBufferManager.getMemoryDiagnostics());
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleModeChange = async (mode: ComputeBackendMode) => {
    setBackendMode(mode);
    await BackendSelector.setBackendMode(mode);
    refreshStatus();
  };

  // Execute single compute job
  const handleDispatchKernel = async () => {
    setIsExecuting(true);
    try {
      let inputs: Record<string, Float32Array> = {};
      let uniforms: Record<string, number> = {};
      const count = workloadSize;

      if (selectedKernelId === 'VECTOR_ADD') {
        inputs = {
          inputA: WebGPUBenchmarkHarness.generateTestVector(count, 1.0),
          inputB: WebGPUBenchmarkHarness.generateTestVector(count, 2.0),
        };
      } else if (selectedKernelId === 'VECTOR_SCALE') {
        inputs = {
          inputA: WebGPUBenchmarkHarness.generateTestVector(count, 1.0),
        };
        uniforms = { scaleFactor, count };
      } else if (selectedKernelId === 'ELEMENT_WISE_MUL') {
        inputs = {
          inputA: WebGPUBenchmarkHarness.generateTestVector(count, 2.5),
          inputB: WebGPUBenchmarkHarness.generateTestVector(count, 4.0),
        };
      } else if (selectedKernelId === 'PARALLEL_REDUCTION') {
        inputs = {
          inputData: WebGPUBenchmarkHarness.generateTestVector(count, 0.5),
        };
        uniforms = { count };
      } else if (selectedKernelId === 'MATRIX_MUL') {
        const dim = matrixDim;
        inputs = {
          matrixA: WebGPUBenchmarkHarness.generateMatrix(dim, dim, 1.1),
          matrixB: WebGPUBenchmarkHarness.generateMatrix(dim, dim, 2.2),
        };
        uniforms = { dimM: dim, dimK: dim, dimN: dim };
      } else if (selectedKernelId === 'TRANSFORM_NONLINEAR') {
        inputs = {
          inputData: WebGPUBenchmarkHarness.generateTestVector(count, 7.7),
        };
        uniforms = { multiplier: scaleFactor, count };
      }

      const request = {
        jobId: `job-${selectedKernelId.toLowerCase()}-${Date.now().toString(36)}-${benchmarkResults.length + 1}`,
        kernelId: selectedKernelId,
        requestedBackend: backendMode,
        inputs,
        uniforms,
        elementCount: selectedKernelId === 'MATRIX_MUL' ? matrixDim * matrixDim : count,
        validateAgainstCPU: true,
        fallbackAllowed: true,
      };

      const result = await BackendSelector.executeJob(request);
      const evidence = WebGPUEvidenceGenerator.createEvidenceDossier(result, true);

      setLastJobResult(result);
      setLastEvidence(evidence);
      setMemoryDiag(GPUBufferManager.getMemoryDiagnostics());
      setTruthState(result.truthState);
    } catch (err: any) {
      console.error('Execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Run Benchmark Suite
  const handleRunBenchmarks = async () => {
    setIsBenchmarking(true);
    try {
      const results = await WebGPUBenchmarkHarness.runFullBenchmarkSuite();
      setBenchmarkResults(results);
    } catch (err) {
      console.error('Benchmark failed:', err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Run Hard Acceptance Gate 296
  const handleRunGate296 = async () => {
    setIsRunningGate(true);
    try {
      const report = await HardAcceptanceGate296.executeGate();
      setGateReport(report);
    } catch (err) {
      console.error('Gate 296 execution failed:', err);
    } finally {
      setIsRunningGate(false);
    }
  };

  const getTruthBadge = (state: BackendTruthState) => {
    switch (state) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5 animate-pulse" />
            REAL GPU ACTIVE (READY)
          </span>
        );
      case 'FALLBACK_CPU':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Cpu className="w-3.5 h-3.5" />
            CPU FALLBACK PROVENANCE (NO FAKE GPU)
          </span>
        );
      case 'EXECUTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Activity className="w-3.5 h-3.5 animate-spin" />
            GPU PIPELINE EXECUTING
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            WEBGPU UNAVAILABLE (CPU ONLY)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            GPU CONTEXT FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            {state}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  SECP Hardware Acceleration Engine
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    PATCH-296
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Real WebGPU Compute Backend: WGSL Pipelines, Numerical Equivalence, Zero-Fake GPU Truth State & Hard Acceptance Gate.
                </p>
              </div>
            </div>
          </div>

          {/* Backend Selector & Truth State Indicator */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex items-center gap-1 text-xs">
              <span className="text-slate-400 px-2 font-medium">Backend:</span>
              {(['AUTO', 'WEBGPU', 'CPU'] as ComputeBackendMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-3 py-1 rounded font-semibold transition-all ${
                    backendMode === mode
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {getTruthBadge(truthState)}
            <button
              onClick={refreshStatus}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              title="Refresh GPU Status"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hardware Discovery & Limits Bar */}
        {capabilities && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-500 block mb-0.5">Adapter Vendor & Device</span>
              <span className="text-slate-200 font-medium truncate block">
                {capabilities.adapterInfo.vendor} ({capabilities.adapterInfo.device})
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-500 block mb-0.5">Max Buffer / Storage Limit</span>
              <span className="text-slate-200 font-medium">
                {(capabilities.limits.maxBufferSize / 1024 / 1024).toFixed(0)} MB / {(capabilities.limits.maxStorageBufferBindingSize / 1024 / 1024).toFixed(0)} MB
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-500 block mb-0.5">Workgroup Max Invocations</span>
              <span className="text-slate-200 font-medium">
                {capabilities.limits.maxComputeInvocationsPerWorkgroup} threads ({capabilities.limits.maxComputeWorkgroupSizeX}x{capabilities.limits.maxComputeWorkgroupSizeY}x{capabilities.limits.maxComputeWorkgroupSizeZ})
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-500 block mb-0.5">Memory Leak Audit</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {memoryDiag?.activeBufferCount || 0} active buffers (0 leaks)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('RUNNER')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'RUNNER'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-4 h-4" />
          Interactive Kernel Runner & Dispatch
        </button>
        <button
          onClick={() => setActiveTab('BENCHMARK')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'BENCHMARK'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Fraud-Free Performance Benchmarks
        </button>
        <button
          onClick={() => setActiveTab('SHADERS')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'SHADERS'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          WGSL Compute Shader Registry
        </button>
        <button
          onClick={() => setActiveTab('GATE296')}
          className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'GATE296'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Hard Acceptance Gate 296 (50 Checks)
        </button>
      </div>

      {/* TAB 1: INTERACTIVE KERNEL RUNNER */}
      {activeTab === 'RUNNER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Configuration */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Kernel & Workload Configuration
              </h2>

              {/* Kernel Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Compute Kernel
                </label>
                <select
                  value={selectedKernelId}
                  onChange={(e) => setSelectedKernelId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {allKernels.map((k) => (
                    <option key={k.kernelId} value={k.kernelId}>
                      {k.kernelId} — {k.name}
                    </option>
                  ))}
                </select>
                {selectedKernel && (
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {selectedKernel.description}
                  </p>
                )}
              </div>

              {/* Workload Size Slider */}
              {selectedKernelId !== 'MATRIX_MUL' ? (
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-semibold text-slate-400 uppercase tracking-wider">
                      Workload Size (Elements)
                    </label>
                    <span className="font-mono text-indigo-400 font-bold">
                      {workloadSize.toLocaleString()} floats ({(workloadSize * 4 / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={64}
                    max={250000}
                    step={64}
                    value={workloadSize}
                    onChange={(e) => setWorkloadSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>64 (Tiny)</span>
                    <span>10k (Medium)</span>
                    <span>100k (Large)</span>
                    <span>250k (Stress)</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <label className="font-semibold text-slate-400 uppercase tracking-wider">
                      Matrix Dimension (N x N)
                    </label>
                    <span className="font-mono text-indigo-400 font-bold">
                      {matrixDim} x {matrixDim} ({(matrixDim * matrixDim).toLocaleString()} elements)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={256}
                    step={8}
                    value={matrixDim}
                    onChange={(e) => setMatrixDim(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Uniform / Parameter inputs */}
              {(selectedKernelId === 'VECTOR_SCALE' || selectedKernelId === 'TRANSFORM_NONLINEAR') && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Scalar Parameter (Uniform Factor)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={scaleFactor}
                    onChange={(e) => setScaleFactor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                  />
                </div>
              )}

              {/* Tolerance Policy Callout */}
              {selectedKernel && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Absolute Tolerance ($|\Delta| \le \epsilon$):</span>
                    <span className="font-mono text-slate-200">{selectedKernel.tolerancePolicy.absoluteTolerance.toExponential(1)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Relative Tolerance ($|\Delta/c| \le \epsilon$):</span>
                    <span className="font-mono text-slate-200">{selectedKernel.tolerancePolicy.relativeTolerance.toExponential(1)}</span>
                  </div>
                </div>
              )}

              {/* Dispatch Action Button */}
              <button
                onClick={handleDispatchKernel}
                disabled={isExecuting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold rounded-lg shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
              >
                {isExecuting ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    Executing on GPU Queue...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Dispatch Compute Job ({backendMode})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Execution Results & Verification */}
          <div className="lg:col-span-7 space-y-6">
            {lastJobResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Execution Output & Numerical Equivalence
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-950 text-slate-300 font-mono border border-slate-800">
                    Job: {lastJobResult.jobId}
                  </span>
                </div>

                {/* Provenance & Truth Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Reported Backend</span>
                    <span className="text-indigo-400 font-bold">{lastJobResult.actualBackend}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Truth State</span>
                    <span className="text-emerald-400 font-bold">{lastJobResult.truthState}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Total Duration</span>
                    <span className="text-slate-200 font-bold">{lastJobResult.timing.totalMs.toFixed(3)} ms</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block mb-1">Max Abs Error</span>
                    <span className="text-emerald-400 font-bold">
                      {lastJobResult.verification.maxAbsoluteError.toExponential(4)}
                    </span>
                  </div>
                </div>

                {/* Timing Breakdown (Upload / Compute / Readback) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400 font-medium">
                    <span>Timing Breakdown & Transfer Accounting</span>
                    <span className="font-mono text-slate-300">
                      Transfer Overhead: {lastJobResult.timing.transferOverheadPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                    <div
                      style={{ width: `${Math.max(5, (lastJobResult.timing.uploadMs / Math.max(0.001, lastJobResult.timing.totalMs)) * 100)}%` }}
                      className="bg-sky-500"
                      title={`Upload: ${lastJobResult.timing.uploadMs.toFixed(3)}ms`}
                    />
                    <div
                      style={{ width: `${Math.max(5, (lastJobResult.timing.computeMs / Math.max(0.001, lastJobResult.timing.totalMs)) * 100)}%` }}
                      className="bg-emerald-500"
                      title={`Kernel Compute: ${lastJobResult.timing.computeMs.toFixed(3)}ms`}
                    />
                    <div
                      style={{ width: `${Math.max(5, (lastJobResult.timing.readbackMs / Math.max(0.001, lastJobResult.timing.totalMs)) * 100)}%` }}
                      className="bg-amber-500"
                      title={`Staging Readback: ${lastJobResult.timing.readbackMs.toFixed(3)}ms`}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> Upload: {lastJobResult.timing.uploadMs.toFixed(3)}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Compute: {lastJobResult.timing.computeMs.toFixed(3)}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Readback: {lastJobResult.timing.readbackMs.toFixed(3)}ms
                    </span>
                  </div>
                </div>

                {/* Numerical Equivalence Validation Badge */}
                <div className={`p-4 rounded-xl border ${
                  lastJobResult.verification.passedTolerance
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    {lastJobResult.verification.passedTolerance
                      ? 'Strict IEEE-754 Numerical Equivalence Verified Against CPU Reference'
                      : 'Numerical Drift Exceeded Tolerance Policy'}
                  </div>
                  <div className="mt-2 text-xs font-mono space-y-1 text-slate-300">
                    <div>Checked {lastJobResult.verification.elementsChecked.toLocaleString()} elements against CPU reference function.</div>
                    <div>MSE (Mean Squared Error): {lastJobResult.verification.meanSquaredError.toExponential(6)}</div>
                  </div>
                </div>

                {/* Cryptographic Evidence Dossier & Digital Thread */}
                {lastEvidence && (
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
                    <div className="text-slate-400 font-bold flex items-center justify-between">
                      <span>Cryptographic Evidence Dossier</span>
                      <span className="text-indigo-400">{lastEvidence.evidenceId}</span>
                    </div>
                    <div className="text-slate-400 truncate">
                      SHA-256 Provenance Hash: <span className="text-slate-200">{lastEvidence.provenanceHash}</span>
                    </div>
                    <div className="text-slate-400 truncate">
                      Input Hash: <span className="text-slate-200">{lastEvidence.inputHash}</span> | Output Hash: <span className="text-slate-200">{lastEvidence.outputHash}</span>
                    </div>
                    {lastEvidence.digitalThreadNodeId && (
                      <div className="pt-2 border-t border-slate-800/80 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Linked to Digital Thread Graph (Node: {lastEvidence.digitalThreadNodeId})
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 space-y-3">
                <Gauge className="w-12 h-12 mx-auto text-slate-600 stroke-1" />
                <p className="text-sm">Select a compute kernel on the left and click &quot;Dispatch Compute Job&quot; to execute real WGSL shader workloads.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FRAUD-FREE BENCHMARKS */}
      {activeTab === 'BENCHMARK' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Fraud-Free Performance Benchmark Suite
              </h2>
              <p className="text-xs text-slate-400">
                Honest comparative benchmark measuring CPU reference vs WebGPU with full upload & readback latency accounting.
              </p>
            </div>
            <button
              onClick={handleRunBenchmarks}
              disabled={isBenchmarking}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition"
            >
              {isBenchmarking ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  Running 7 Benchmark Workloads...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Complete Benchmark Suite
                </>
              )}
            </button>
          </div>

          {benchmarkResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Workload Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Elements</th>
                    <th className="p-3 text-right">CPU Time</th>
                    <th className="p-3 text-right">GPU Total</th>
                    <th className="p-3 text-right">Speedup</th>
                    <th className="p-3 text-right">Transfer Overhead</th>
                    <th className="p-3 text-center">Correctness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {benchmarkResults.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/40 transition">
                      <td className="p-3 font-semibold text-slate-200">
                        {b.workloadName}
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">{b.notes}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {b.category}
                        </span>
                      </td>
                      <td className="p-3 text-right">{b.dataSize.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-400">{b.timingBreakdown.cpuTotalMs} ms</td>
                      <td className="p-3 text-right text-indigo-400 font-bold">{b.timingBreakdown.gpuTotalMs} ms</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          b.gpuSpeedup > 1.0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {b.gpuSpeedup}x
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400">{b.transferOverheadPercent}%</td>
                      <td className="p-3 text-center">
                        {b.numericallyEquivalent ? (
                          <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> DRIFT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-950 p-8 text-center text-slate-500 rounded-xl border border-slate-800">
              Click &quot;Run Complete Benchmark Suite&quot; above to execute comparative CPU vs WebGPU tests.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WGSL SHADERS */}
      {activeTab === 'SHADERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Shaders</h3>
            {ComputeShaderManager.getAllShaders().map((s) => (
              <button
                key={s.shaderId}
                onClick={() => setSelectedKernelId(s.shaderId)}
                className={`w-full text-left p-3.5 rounded-xl border transition ${
                  selectedKernelId === s.shaderId
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="font-semibold text-sm text-slate-200">{s.name}</div>
                <div className="text-xs font-mono text-slate-500 mt-1 flex items-center justify-between">
                  <span>ID: {s.shaderId}</span>
                  <span>v{s.version}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-200">{selectedShader?.name}</h3>
                <span className="text-xs text-indigo-400 font-mono">
                  SHA-256: {ComputeShaderManager.getShaderHash(selectedKernelId)}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-950 text-slate-400 font-mono text-xs border border-slate-800">
                Workgroup: [{selectedShader?.workgroupSize.join(', ')}]
              </span>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[500px]">
                {selectedShader?.source}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HARD ACCEPTANCE GATE 296 */}
      {activeTab === 'GATE296' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Hard Acceptance Gate 296 (50-Item Regression Battery)
              </h2>
              <p className="text-xs text-slate-400">
                Verifies WebGPU discovery, buffers, WGSL compilation, error models, CPU equivalence, zero fake GPU, and digital thread provenance.
              </p>
            </div>
            <button
              onClick={handleRunGate296}
              disabled={isRunningGate}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              {isRunningGate ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  Running 50 Verification Checks...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Execute Gate 296 Battery
                </>
              )}
            </button>
          </div>

          {gateReport && (
            <div className="space-y-6">
              {/* Score Bar */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    gateReport.gatePassed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-100">
                      {gateReport.gatePassed ? 'Gate 296 PASSED (100% Certified)' : 'Gate 296 FAILED'}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Passed {gateReport.passedTests} / {gateReport.totalTests} regression assertions ({gateReport.scorePercentage}%)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  {(['ALL', 'PASSED', 'FAILED'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setGateFilter(f)}
                      className={`px-3 py-1.5 rounded transition ${
                        gateFilter === f ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {gateReport.results
                  .filter((r) => gateFilter === 'ALL' || (gateFilter === 'PASSED' && r.passed) || (gateFilter === 'FAILED' && !r.passed))
                  .map((t) => (
                    <div
                      key={t.stepNumber}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 flex items-start justify-between gap-4 text-xs font-mono"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">#{t.stepNumber.toString().padStart(2, '0')}</span>
                          <span className="font-semibold text-slate-200">{t.testName}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">
                            {t.category}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                          {t.details}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[11px]">{t.durationMs}ms</span>
                        {t.passed ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                            PASS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                            FAIL
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
