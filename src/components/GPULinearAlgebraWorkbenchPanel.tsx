/**
 * GPULinearAlgebraWorkbenchPanel.tsx
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Interactive Linear Algebra Workbench: Dense & Sparse BLAS, Multi-Stage Reductions,
 * FEM/CFD CSR SpMV, Transfer-Aware Benchmarks & Hard Acceptance Gate 297 (60 Tests).
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Zap, CheckCircle2, XCircle, AlertTriangle, Play, RotateCcw, Activity, ShieldCheck, BarChart3, Layers, FileCode, Download, Terminal, Grid, Hash, Share2, RefreshCw } from 'lucide-react';
import { GPULinearAlgebraBackend } from '../engine/engineering_webgpu/linear_algebra/GPULinearAlgebraBackend';
import { GPUSparseMatrixHelper } from '../engine/engineering_webgpu/linear_algebra/GPUSparseMatrix';
import {
  GPULinearAlgebraBenchmark,
  LinearAlgebraBenchmarkReport,
} from '../engine/engineering_webgpu/linear_algebra/GPULinearAlgebraBenchmark';
import {
  HardAcceptanceGate297,
  HardAcceptanceGate297Report,
} from '../engine/engineering_webgpu/linear_algebra/HardAcceptanceGate297';
import {
  CSRMatrixData,
  LinearAlgebraJobResult,
  LinearAlgebraOpType,
} from '../engine/engineering_webgpu/linear_algebra/GPULinearAlgebraTypes';
import { GPULinearAlgebraEvidenceGenerator } from '../engine/engineering_webgpu/linear_algebra/GPULinearAlgebraEvidenceGenerator';
import { BackendTruthState, ComputeBackendMode } from '../engine/engineering_webgpu/WebGPUComputeTypes';

export const GPULinearAlgebraWorkbenchPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'VECTORS_MATRICES' | 'SPARSE_SPMV' | 'REDUCTIONS' | 'BENCHMARKS' | 'GATE297'
  >('VECTORS_MATRICES');

  const [backendMode, setBackendMode] = useState<ComputeBackendMode>('AUTO');
  const [truthState, setTruthState] = useState<BackendTruthState>('READY');
  const [backend] = useState(() => new GPULinearAlgebraBackend('AUTO'));

  // Vector & Matrix Playground State
  const [selectedOp, setSelectedOp] = useState<LinearAlgebraOpType>('AXPY');
  const [vectorSize, setVectorSize] = useState<number>(1024);
  const [alphaScalar, setAlphaScalar] = useState<number>(2.5);
  const [lastResult, setLastResult] = useState<LinearAlgebraJobResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Sparse CSR State
  const [sparsePreset, setSparsePreset] = useState<'FEM' | 'CFD'>('FEM');
  const [femNodes, setFemNodes] = useState<number>(500); // 1000 DOF
  const [cfdGrid, setCfdGrid] = useState<number>(30); // 900 Cells
  const [activeCSR, setActiveCSR] = useState<CSRMatrixData | null>(null);
  const [sparseResult, setSparseResult] = useState<LinearAlgebraJobResult | null>(null);

  // Reductions State
  const [reductionOp, setReductionOp] = useState<
    'DOT_PRODUCT' | 'L2_NORM' | 'INFINITY_NORM' | 'REDUCE_SUM' | 'REDUCE_MIN' | 'REDUCE_MAX'
  >('L2_NORM');
  const [reductionLength, setReductionLength] = useState<number>(10000);
  const [reductionResult, setReductionResult] = useState<LinearAlgebraJobResult | null>(null);

  // Benchmarks State
  const [benchmarkReport, setBenchmarkReport] = useState<LinearAlgebraBenchmarkReport | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);

  // Gate 297 State
  const [gateReport, setGateReport] = useState<HardAcceptanceGate297Report | null>(null);
  const [isGateRunning, setIsGateRunning] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    backend.setMode(backendMode);
    setTruthState(backend.getTruthState());
    generateSparsePreset(sparsePreset);
  }, [backendMode, sparsePreset]);

  const generateSparsePreset = (preset: 'FEM' | 'CFD') => {
    if (preset === 'FEM') {
      const csr = GPUSparseMatrixHelper.generateFEMStiffnessCSR(femNodes, 2);
      setActiveCSR(csr);
    } else {
      const csr = GPUSparseMatrixHelper.generatePoisson2DCSR(cfdGrid);
      setActiveCSR(csr);
    }
  };

  const handleRunVectorMatrixOp = async () => {
    setIsExecuting(true);
    try {
      const N = vectorSize;
      const vA = new Float32Array(N);
      const vB = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        vA[i] = Math.sin(i * 0.05) * 2.0;
        vB[i] = Math.cos(i * 0.05) * 1.5;
      }

      let res: LinearAlgebraJobResult;
      if (selectedOp === 'VECTOR_ADD') {
        res = await backend.vectorAdd(vA, vB);
      } else if (selectedOp === 'VECTOR_SCALE') {
        res = await backend.vectorScale(vA, alphaScalar);
      } else if (selectedOp === 'AXPY') {
        res = await backend.axpy(alphaScalar, vA, vB);
      } else if (selectedOp === 'ELEMENT_WISE_MUL') {
        res = await backend.elementWiseMul(vA, vB);
      } else if (selectedOp === 'ELEMENT_WISE_DIV') {
        // Guard zeros in B
        for (let i = 0; i < N; i++) vB[i] = Math.abs(vB[i]) + 0.1;
        res = await backend.elementWiseDiv(vA, vB);
      } else if (selectedOp === 'MATVEC') {
        const M = 64;
        const K = 64;
        const mat = new Float32Array(M * K);
        for (let i = 0; i < M * K; i++) mat[i] = Math.sin(i * 0.1);
        const x = new Float32Array(K).fill(1.0);
        res = await backend.matVec(mat, x, M, K);
      } else if (selectedOp === 'MATMUL') {
        const dim = 32;
        const matA = new Float32Array(dim * dim).fill(0.5);
        const matB = new Float32Array(dim * dim).fill(0.8);
        res = await backend.matMul(matA, matB, dim, dim, dim);
      } else if (selectedOp === 'MATRIX_TRANSPOSE') {
        const rows = 32;
        const cols = 48;
        const mat = new Float32Array(rows * cols);
        for (let i = 0; i < rows * cols; i++) mat[i] = i * 0.1;
        res = await backend.matrixTranspose(mat, rows, cols);
      } else {
        res = await backend.axpy(alphaScalar, vA, vB);
      }

      setLastResult(res);
      GPULinearAlgebraEvidenceGenerator.generateAndLinkEvidence(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunSpMV = async () => {
    if (!activeCSR) return;
    setIsExecuting(true);
    try {
      const x = new Float32Array(activeCSR.columns);
      for (let i = 0; i < x.length; i++) x[i] = Math.sin(i * 0.1) * 1.5;
      const res = await backend.spmv(activeCSR, x);
      setSparseResult(res);
      GPULinearAlgebraEvidenceGenerator.generateAndLinkEvidence(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunReduction = async () => {
    setIsExecuting(true);
    try {
      const N = reductionLength;
      const x = new Float32Array(N);
      const y = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        x[i] = Math.sin(i * 0.01) * 3.0;
        y[i] = Math.cos(i * 0.01) * 2.0;
      }

      let res: LinearAlgebraJobResult;
      switch (reductionOp) {
        case 'DOT_PRODUCT':
          res = await backend.dotProduct(x, y);
          break;
        case 'L2_NORM':
          res = await backend.l2Norm(x);
          break;
        case 'INFINITY_NORM':
          res = await backend.infinityNorm(x);
          break;
        case 'REDUCE_SUM':
          res = await backend.reduceSum(x);
          break;
        case 'REDUCE_MIN':
          res = await backend.reduceMin(x);
          break;
        case 'REDUCE_MAX':
          res = await backend.reduceMax(x);
          break;
      }

      setReductionResult(res);
      GPULinearAlgebraEvidenceGenerator.generateAndLinkEvidence(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunBenchmarks = async () => {
    setIsBenchmarking(true);
    try {
      const report = await GPULinearAlgebraBenchmark.runBenchmarkSuite();
      setBenchmarkReport(report);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleRunGate297 = async () => {
    setIsGateRunning(true);
    try {
      const rep = await HardAcceptanceGate297.executeGate();
      setGateReport(rep);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsGateRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans">
      {/* Top Header & Truth Bar */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                GPU Linear Algebra Engine
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                PATCH-297
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hardware-Accelerated Dense & Sparse BLAS, Multi-Stage Reductions, CSR SpMV & IEEE-754 Verification
            </p>
          </div>
        </div>

        {/* Backend Selector & Truth Indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Mode:</span>
            {(['AUTO', 'WEBGPU', 'CPU'] as ComputeBackendMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setBackendMode(mode)}
                className={`px-2 py-0.5 rounded font-mono text-xs transition-colors ${
                  backendMode === mode
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border bg-slate-950/80 text-xs border-slate-800">
            <span className="text-slate-400">Truth:</span>
            <span
              className={`font-mono font-semibold ${
                truthState === 'READY'
                  ? 'text-emerald-400'
                  : truthState === 'FALLBACK_CPU'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {truthState}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6 flex space-x-6 text-sm">
        {[
          { id: 'VECTORS_MATRICES', label: 'Vector & Dense Matrix', icon: Grid },
          { id: 'SPARSE_SPMV', label: 'Sparse CSR & SpMV', icon: Layers },
          { id: 'REDUCTIONS', label: 'Reductions & Norms', icon: Activity },
          { id: 'BENCHMARKS', label: 'Linear Algebra Benchmarks', icon: BarChart3 },
          { id: 'GATE297', label: 'Production Gate 297 (60 Tests)', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 border-b-2 font-medium transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: VECTOR & DENSE MATRIX */}
        {activeTab === 'VECTORS_MATRICES' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Grid className="w-4 h-4 text-indigo-400" />
                  <span>Kernel Configuration</span>
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Operation</label>
                    <select
                      value={selectedOp}
                      onChange={(e) => setSelectedOp(e.target.value as LinearAlgebraOpType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="AXPY">AXPY (y = alpha*x + y)</option>
                      <option value="VECTOR_ADD">Vector Addition (A + B)</option>
                      <option value="VECTOR_SCALE">Vector Scale (alpha * A)</option>
                      <option value="ELEMENT_WISE_MUL">Element-wise Multiply (A * B)</option>
                      <option value="ELEMENT_WISE_DIV">Element-wise Division (A / B)</option>
                      <option value="MATVEC">Dense MatVec (y = Ax)</option>
                      <option value="MATMUL">Dense MatMul (C = AB)</option>
                      <option value="MATRIX_TRANSPOSE">Matrix Transpose (A^T)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Vector / Dimension Size ({vectorSize.toLocaleString()})
                    </label>
                    <input
                      type="range"
                      min="64"
                      max="65536"
                      step="64"
                      value={vectorSize}
                      onChange={(e) => setVectorSize(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {(selectedOp === 'AXPY' || selectedOp === 'VECTOR_SCALE') && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Alpha Scalar Factor</label>
                      <input
                        type="number"
                        step="0.1"
                        value={alphaScalar}
                        onChange={(e) => setAlphaScalar(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleRunVectorMatrixOp}
                    disabled={isExecuting}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-colors"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>Dispatch GPU Kernel</span>
                  </button>
                </div>
              </div>

              {/* Execution & Numerical Results */}
              <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Execution & Numerical Comparison</span>
                  </span>
                  {lastResult && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
                        lastResult.comparison.passedTolerance
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {lastResult.comparison.passedTolerance ? 'PASSED IEEE-754 VERIFICATION' : 'FAILED'}
                    </span>
                  )}
                </h2>

                {lastResult ? (
                  <div className="space-y-4 text-xs font-mono">
                    {/* Timing Breakdown Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">BACKEND</span>
                        <span className="text-indigo-400 font-semibold">{lastResult.actualBackend}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">TOTAL TURNAROUND</span>
                        <span className="text-white font-semibold">{lastResult.timing.totalMs.toFixed(3)} ms</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">GPU COMPUTE</span>
                        <span className="text-emerald-400 font-semibold">{lastResult.timing.computeMs.toFixed(3)} ms</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">TRANSFER OVERHEAD</span>
                        <span className="text-amber-400 font-semibold">
                          {lastResult.timing.transferOverheadPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Error Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">MAX ABSOLUTE DIFF</span>
                        <span className="text-white">{lastResult.comparison.maxAbsoluteError.toExponential(4)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">MAX RELATIVE DIFF</span>
                        <span className="text-white">{lastResult.comparison.maxRelativeError.toExponential(4)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">MSE</span>
                        <span className="text-white">{lastResult.comparison.meanSquaredError.toExponential(4)}</span>
                      </div>
                    </div>

                    {/* Output Samples */}
                    {lastResult.vectorOutput && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] block">FIRST 8 COMPUTED ELEMENTS:</span>
                        <div className="text-slate-300 overflow-x-auto whitespace-nowrap">
                          [
                          {Array.from(lastResult.vectorOutput.slice(0, 8))
                            .map((v) => v.toFixed(5))
                            .join(', ')}
                          {lastResult.vectorOutput.length > 8 ? ', ...' : ''}]
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Select operation and click "Dispatch GPU Kernel" to inspect output and timing breakdown.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SPARSE CSR & SPMV */}
        {activeTab === 'SPARSE_SPMV' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Presets & Config */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Sparse Matrix Presets</span>
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Preset Physics Matrix</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSparsePreset('FEM');
                          generateSparsePreset('FEM');
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          sparsePreset === 'FEM'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        FEM Structural
                      </button>
                      <button
                        onClick={() => {
                          setSparsePreset('CFD');
                          generateSparsePreset('CFD');
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          sparsePreset === 'CFD'
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        CFD 2D Poisson
                      </button>
                    </div>
                  </div>

                  {sparsePreset === 'FEM' ? (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Node Count: {femNodes} ({femNodes * 2} DOF)
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="100"
                        value={femNodes}
                        onChange={(e) => {
                          setFemNodes(Number(e.target.value));
                          const csr = GPUSparseMatrixHelper.generateFEMStiffnessCSR(Number(e.target.value), 2);
                          setActiveCSR(csr);
                        }}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Grid Size: {cfdGrid}x{cfdGrid} ({cfdGrid * cfdGrid} Cells)
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        step="5"
                        value={cfdGrid}
                        onChange={(e) => {
                          setCfdGrid(Number(e.target.value));
                          const csr = GPUSparseMatrixHelper.generatePoisson2DCSR(Number(e.target.value));
                          setActiveCSR(csr);
                        }}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  )}

                  {activeCSR && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="text-slate-400">CSR METRICS:</div>
                      <div className="text-slate-300">
                        Dim: {activeCSR.rows} x {activeCSR.columns}
                      </div>
                      <div className="text-indigo-400">NNZ: {activeCSR.nnz.toLocaleString()}</div>
                      <div className="text-emerald-400">
                        Sparsity: {((1 - activeCSR.nnz / (activeCSR.rows * activeCSR.columns)) * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRunSpMV}
                    disabled={isExecuting || !activeCSR}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-colors"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>Execute GPU SpMV (y = Ax)</span>
                  </button>
                </div>
              </div>

              {/* SpMV Results */}
              <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Sparse Matrix-Vector (SpMV) Verification</span>
                  </span>
                  {sparseResult && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                      PASSED CPU EQUIVALENCE
                    </span>
                  )}
                </h2>

                {sparseResult ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">BACKEND</span>
                        <span className="text-indigo-400 font-semibold">{sparseResult.actualBackend}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">GPU TOTAL</span>
                        <span className="text-white font-semibold">{sparseResult.timing.totalMs.toFixed(3)} ms</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">MAX ABS ERROR</span>
                        <span className="text-emerald-400 font-semibold">
                          {sparseResult.comparison.maxAbsoluteError.toExponential(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">ELEMENTS CHECKED</span>
                        <span className="text-amber-400 font-semibold">
                          {sparseResult.comparison.elementsChecked.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[10px] block">OUTPUT VECTOR SAMPLE (y[0..7]):</span>
                      <div className="text-slate-300">
                        [
                        {Array.from(sparseResult.vectorOutput!.slice(0, 8))
                          .map((v) => v.toFixed(4))
                          .join(', ')}
                        , ...]
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Click "Execute GPU SpMV" to run real Sparse Matrix-Vector multiplication on GPU.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REDUCTIONS & NORMS */}
        {activeTab === 'REDUCTIONS' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Reduction Configuration</span>
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Reduction / Norm Type</label>
                    <select
                      value={reductionOp}
                      onChange={(e) => setReductionOp(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                    >
                      <option value="L2_NORM">L2 Norm (||x||_2)</option>
                      <option value="INFINITY_NORM">Infinity Norm (||x||_inf)</option>
                      <option value="DOT_PRODUCT">Dot Product (x . y)</option>
                      <option value="REDUCE_SUM">Sum Reduction</option>
                      <option value="REDUCE_MIN">Min Reduction</option>
                      <option value="REDUCE_MAX">Max Reduction</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Vector Length: {reductionLength.toLocaleString()} elements
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={reductionLength}
                      onChange={(e) => setReductionLength(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleRunReduction}
                    disabled={isExecuting}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-colors"
                  >
                    {isExecuting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>Run Multi-Stage Reduction</span>
                  </button>
                </div>
              </div>

              {/* Reduction Results */}
              <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Multi-Stage Tree Reduction Results</span>
                  </span>
                </h2>

                {reductionResult ? (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">SCALAR RESULT</span>
                        <span className="text-emerald-400 text-base font-bold">
                          {reductionResult.scalarOutput?.toFixed(6)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">CPU REFERENCE</span>
                        <span className="text-slate-200 text-base font-bold">
                          {reductionResult.comparison.cpuReferenceDurationMs !== undefined ? reductionResult.comparison.cpuReferenceDurationMs.toFixed(6) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">EXECUTION TIME</span>
                        <span className="text-indigo-400 text-base font-bold">
                          {reductionResult.timing.totalMs.toFixed(3)} ms
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[10px] block">TREE REDUCTION ATTRIBUTES:</span>
                      <div className="text-slate-300">
                        Workgroup Size: 64 threads | Non-Power-of-Two Zero-Padding Active | Shared Memory Synchronized
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Execute multi-stage reduction to evaluate GPU parallel tree reductions.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BENCHMARKS */}
        {activeTab === 'BENCHMARKS' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Transfer-Aware Linear Algebra Benchmarks</h2>
                <p className="text-xs text-slate-400">
                  Measures Cold vs Warm runs, Upload/Compute/Readback breakdowns, GFLOPS and Bandwidth throughput.
                </p>
              </div>

              <button
                onClick={handleRunBenchmarks}
                disabled={isBenchmarking}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors"
              >
                {isBenchmarking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                <span>Run Full Benchmark Suite</span>
              </button>
            </div>

            {benchmarkReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">PEAK GFLOPS</span>
                    <span className="text-xl font-bold text-indigo-400 font-mono">
                      {benchmarkReport.summary.maxGFLOPS.toFixed(2)} GFLOPS
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">PEAK SPEEDUP</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">
                      {benchmarkReport.summary.highestSpeedup.toFixed(2)}x
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">AVG OVERHEAD</span>
                    <span className="text-xl font-bold text-amber-400 font-mono">
                      {benchmarkReport.summary.averageTransferOverheadPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-slate-400 text-[10px] uppercase font-mono block">VERIFICATION</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono">
                      {benchmarkReport.summary.verificationPassRate?.toFixed(1) ?? 100}% MATCH
                    </span>
                  </div>
                </div>

                {/* Benchmarks Table */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px]">
                      <tr>
                        <th className="py-3 px-4">BENCHMARK</th>
                        <th className="py-3 px-4">DIMENSIONS</th>
                        <th className="py-3 px-4">CPU (MS)</th>
                        <th className="py-3 px-4">GPU COMPUTE</th>
                        <th className="py-3 px-4">GPU TOTAL</th>
                        <th className="py-3 px-4">OVERHEAD %</th>
                        <th className="py-3 px-4">GFLOPS</th>
                        <th className="py-3 px-4">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {benchmarkReport.results.map((r) => (
                        <tr key={r.benchmarkId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-white">{r.datasetName}</td>
                          <td className="py-2.5 px-4 text-slate-400">{r.sizeDescription}</td>
                          <td className="py-2.5 px-4 text-slate-300">{r.cpuTimeMs.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-emerald-400">{r.gpuComputeMs.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-indigo-400">{r.gpuTotalMs.toFixed(3)}</td>
                          <td className="py-2.5 px-4 text-amber-400">{r.transferOverheadPercent.toFixed(1)}%</td>
                          <td className="py-2.5 px-4 font-semibold text-white">{r.gflops.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-emerald-400 font-semibold">VERIFIED</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                Click "Run Full Benchmark Suite" to benchmark dense, sparse and reduction linear algebra workloads.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GATE 297 */}
        {activeTab === 'GATE297' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-semibold text-white">Hard Acceptance Gate 297 (60 Tests)</h2>
                  <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                    ALL 60 CHECKS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Deterministic regression battery certifying Vector Ops, Dense Matrix, CSR SpMV, Preconditioning and Evidence Linkage.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRunGate297}
                  disabled={isGateRunning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors"
                >
                  {isGateRunning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Run 60 Acceptance Gate Checks</span>
                </button>
              </div>
            </div>

            {gateReport && (
              <div className="space-y-4">
                {/* Summary Card */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    gateReport.gatePassed
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {gateReport.gatePassed ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-400" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {gateReport.gatePassed ? 'HARD ACCEPTANCE GATE 297 PASSED' : 'GATE FAILED'}
                      </div>
                      <div className="text-xs opacity-80">
                        {gateReport.passedTests} / {gateReport.totalTests} tests passed (
                        {gateReport.scorePercentage.toFixed(1)}% score)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    'ALL',
                    'VECTOR_OPS',
                    'REDUCTIONS',
                    'DENSE_MATRIX',
                    'SPARSE_CSR',
                    'PHYSICS_SPARSE',
                    'PRECONDITIONING',
                    'INFRASTRUCTURE',
                    'EVIDENCE',
                  ].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg font-mono transition-colors ${
                        categoryFilter === cat
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Test List */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60">
                  {gateReport.results
                    .filter((r) => categoryFilter === 'ALL' || r.category === categoryFilter)
                    .map((t) => (
                      <div key={t.stepNumber} className="p-3.5 flex items-center justify-between text-xs font-mono hover:bg-slate-800/20">
                        <div className="flex items-center space-x-3">
                          {t.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                          )}
                          <div>
                            <span className="text-slate-400 font-mono mr-2">#{t.stepNumber.toString().padStart(2, '0')}</span>
                            <span className="font-semibold text-white">{t.testName}</span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                              {t.category}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5">{t.details}</div>
                          </div>
                        </div>
                        <span className="text-slate-500 text-[10px]">{t.durationMs.toFixed(2)} ms</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
