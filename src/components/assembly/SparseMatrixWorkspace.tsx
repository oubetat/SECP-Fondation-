import React, { useState, useMemo } from 'react';
import { Grid, Zap, CheckCircle, XCircle, Cpu, Layers, Database, Download, Play, Activity, ShieldCheck, RefreshCw, BarChart2, FileCode, Box, Sliders, AlertTriangle } from 'lucide-react';

import { SparseMatrix, SparseMatrixBuilder } from '../../engine/fem/sparse/SparseMatrix';
import { SparseLinearSolver, SolverMode } from '../../engine/fem/sparse/SparseLinearSolver';
import { MatrixOrdering } from '../../engine/fem/sparse/MatrixOrdering';
import { HardAcceptanceGate236, Gate236Evaluation } from '../../engine/fem/sparse/HardAcceptanceGate236';
import { ParallelismBoundary } from '../../engine/fem/sparse/ParallelismBoundary';
import { SparseFEMEngine, SparseFEMSolveResult } from '../../engine/fem/sparse/SparseFEMEngine';
import { FEMMeshGenerator } from '../../engine/fem/mesh/FEMMeshGenerator';

export const SparseMatrixWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SPARSITY_VIS' | 'SOLVER_BENCH' | 'GATE_236' | 'FEM_PIPELINE'>('OVERVIEW');
  const [matrixSize, setMatrixSize] = useState<number>(100);
  const [selectedSolverMode, setSelectedSolverMode] = useState<SolverMode>('AUTO');
  const [useRCM, setUseRCM] = useState<boolean>(true);
  const [gateEvaluation, setGateEvaluation] = useState<Gate236Evaluation | null>(null);
  const [isExecutingGate, setIsExecutingGate] = useState<boolean>(false);
  const [femSolveResult, setFemSolveResult] = useState<SparseFEMSolveResult | null>(null);
  const [isSolvingFEM, setIsSolvingFEM] = useState<boolean>(false);

  // Sample Sparse Matrix for visualizer
  const sampleMatrix = useMemo(() => {
    const size = Math.min(matrixSize, 200);
    const builder = SparseMatrix.create(size, size);
    for (let i = 0; i < size; i++) {
      builder.add(i, i, 4.0);
      if (i > 0) builder.add(i, i - 1, -1.0);
      if (i < size - 1) builder.add(i, i + 1, -1.0);
      if (i >= 5 && i < size - 5) {
        builder.add(i, i - 5, -0.5);
        builder.add(i, i + 5, -0.5);
      }
    }
    return builder.build();
  }, [matrixSize]);

  // RCM comparison
  const rcmOrderingResult = useMemo(() => {
    return MatrixOrdering.computeRCM(sampleMatrix);
  }, [sampleMatrix]);

  const memProfile = sampleMatrix.memoryProfile;

  const handleRunGate236 = () => {
    setIsExecutingGate(true);
    setTimeout(() => {
      const result = HardAcceptanceGate236.runGate();
      setGateEvaluation(result);
      setIsExecutingGate(false);
    }, 100);
  };

  const handleRunFEMPipeline = () => {
    setIsSolvingFEM(true);
    setTimeout(() => {
      const mesh = FEMMeshGenerator.generateHexMesh({
        length: 2.0, width: 0.1, height: 0.1, nx: 10, ny: 2, nz: 2
      });
      const rootNodes = mesh.nodes.filter(n => Math.abs(n.x - 0.0) < 1e-4).map(n => n.id);
      const fixities = rootNodes.map(id => ({ nodeId: id, fixX: true, fixY: true, fixZ: true }));
      const tipNodes = mesh.nodes.filter(n => Math.abs(n.x - 2.0) < 1e-4).map(n => n.id);
      const loads = tipNodes.map(id => ({ nodeId: id, fy: -250.0 }));

      const res = SparseFEMEngine.solveStatic(mesh, { E: 210e9, nu: 0.3 }, fixities, loads, selectedSolverMode);
      setFemSolveResult(res);
      setIsSolvingFEM(false);
    }, 150);
  };

  const handleDownloadEvidence = () => {
    if (!gateEvaluation) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gateEvaluation, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'PATCH-236-Sparse-Matrix-Evidence.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="sparse-matrix-workspace-container" className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Workspace Header */}
      <header id="workspace-header" className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-md">
        <div id="workspace-title-block" className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <Grid className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Sparse Matrix Backend
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/40">
                PATCH-236
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              CSR / CSC / COO Sparse Assembly, Preconditioned Iterative & Direct Solvers
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav id="workspace-tab-nav" className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            id="tab-btn-overview"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'OVERVIEW' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            id="tab-btn-sparsity-vis"
            onClick={() => setActiveTab('SPARSITY_VIS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'SPARSITY_VIS' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sparsity & RCM
          </button>
          <button
            id="tab-btn-fem-pipeline"
            onClick={() => setActiveTab('FEM_PIPELINE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'FEM_PIPELINE' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FEM Engine
          </button>
          <button
            id="tab-btn-gate-236"
            onClick={() => setActiveTab('GATE_236')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'GATE_236' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hard Gate 236
          </button>
        </nav>
      </header>

      {/* Main Workspace Body */}
      <main id="workspace-main-content" className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'OVERVIEW' && (
          <div id="overview-section" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Matrix Dimension</div>
                <div className="text-2xl font-mono font-bold text-cyan-400">{sampleMatrix.rows} × {sampleMatrix.cols}</div>
                <div className="text-xs text-slate-400 mt-1">Full Sparse System</div>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Non-Zero Entries (NNZ)</div>
                <div className="text-2xl font-mono font-bold text-emerald-400">{sampleMatrix.nnz.toLocaleString()}</div>
                <div className="text-xs text-slate-400 mt-1">Sparsity Ratio: {(sampleMatrix.sparsityRatio * 100).toFixed(1)}%</div>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Memory Footprint</div>
                <div className="text-2xl font-mono font-bold text-amber-400">{(memProfile.totalSparseBytes / 1024).toFixed(1)} KB</div>
                <div className="text-xs text-emerald-400 mt-1">Saved {memProfile.savingsPercentage.toFixed(1)}% vs Dense</div>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Format Architecture</div>
                <div className="text-2xl font-mono font-bold text-indigo-400">CSR + CSC</div>
                <div className="text-xs text-slate-400 mt-1">O(nnz) SpMV & Matrix Product</div>
              </div>
            </div>

            {/* Matrix Control & Features Card */}
            <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
              <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Sparse System Configuration & Scale Test
              </h3>

              <div className="flex items-center space-x-6">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">System Size (N DOFs):</label>
                  <select
                    value={matrixSize}
                    onChange={(e) => setMatrixSize(Number(e.target.value))}
                    className="block bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300"
                  >
                    <option value={50}>50 × 50 (Small)</option>
                    <option value={100}>100 × 100 (Medium)</option>
                    <option value={200}>200 × 200 (Large)</option>
                    <option value={500}>500 × 500 (Scale)</option>
                    <option value={1200}>1200 × 1200 (N &gt; 1000 Gate Test)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Default Linear Solver Backend:</label>
                  <select
                    value={selectedSolverMode}
                    onChange={(e) => setSelectedSolverMode(e.target.value as SolverMode)}
                    className="block bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300"
                  >
                    <option value="AUTO">AUTO (Optimal Selection)</option>
                    <option value="DIRECT_CHOLESKY">Direct Sparse Cholesky</option>
                    <option value="ITERATIVE_PCG">Preconditioned Conjugate Gradient (PCG)</option>
                    <option value="ITERATIVE_GMRES">GMRES (Asymmetric)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SPARSITY & RCM TAB */}
        {activeTab === 'SPARSITY_VIS' && (
          <div id="sparsity-vis-section" className="space-y-6">
            <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-200">Sparsity Pattern & Reverse Cuthill–McKee (RCM) Reordering</h3>
                  <p className="text-xs text-slate-400">Bandwidth reduction minimizes profile and fill-in during direct factorizations.</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-xs font-mono text-slate-300">
                    Initial Bandwidth: <span className="text-amber-400 font-bold">{rcmOrderingResult.initialBandwidth}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    RCM Bandwidth: <span className="text-emerald-400 font-bold">{rcmOrderingResult.reorderedBandwidth}</span>
                  </div>
                </div>
              </div>

              {/* Grid visualization representation */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex justify-center">
                <div className="text-center space-y-2">
                  <div className="inline-grid grid-cols-10 gap-1 bg-slate-900 p-2 rounded border border-slate-800">
                    {Array.from({ length: 100 }).map((_, idx) => {
                      const r = Math.floor(idx / 10);
                      const c = idx % 10;
                      const hasEntry = sampleMatrix.get(r, c) !== 0;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-xs border text-[8px] flex items-center justify-center font-mono ${
                            hasEntry
                              ? 'bg-cyan-500/80 border-cyan-400 text-slate-950 font-bold'
                              : 'bg-slate-950 border-slate-850 text-slate-700'
                          }`}
                          title={`(${r}, ${c}): ${sampleMatrix.get(r, c)}`}
                        >
                          {hasEntry ? '•' : ''}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">10×10 Sparsity Submatrix Visualizer Sample</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FEM PIPELINE TAB */}
        {activeTab === 'FEM_PIPELINE' && (
          <div id="fem-pipeline-section" className="space-y-6">
            <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-200">End-to-End Sparse FEM Execution Test</h3>
                  <p className="text-xs text-slate-400">
                    Mesh → Elements → Constitutive Law → Sparse Assembly → BCs → Sparse Solver → Displacements & Reactions
                  </p>
                </div>
                <button
                  onClick={handleRunFEMPipeline}
                  disabled={isSolvingFEM}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {isSolvingFEM ? 'Solving Sparse FEM System...' : 'Execute Sparse FEM Solve'}
                </button>
              </div>

              {femSolveResult && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Total DOFs</div>
                      <div className="text-lg font-mono font-bold text-cyan-400">{femSolveResult.numDOFs}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Tip Deflection</div>
                      <div className="text-lg font-mono font-bold text-emerald-400">{(femSolveResult.maxDeflection * 1000).toFixed(3)} mm</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Solver Type</div>
                      <div className="text-lg font-mono font-bold text-amber-400">{femSolveResult.solverResult.solverType}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Relative Residual</div>
                      <div className="text-lg font-mono font-bold text-indigo-400">{femSolveResult.relativeResidualNorm.toExponential(3)}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs space-y-2">
                    <div className="text-slate-300 font-bold border-b border-slate-800 pb-1">Reaction Force Equilibrium Check</div>
                    {femSolveResult.reactions.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex justify-between text-slate-400">
                        <span>Node {r.nodeId}:</span>
                        <span>Rx = {r.Rx.toFixed(1)} N, Ry = {r.Ry.toFixed(1)} N, Rz = {r.Rz.toFixed(1)} N</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HARD GATE 236 TAB */}
        {activeTab === 'GATE_236' && (
          <div id="gate-236-section" className="space-y-6">
            <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Hard Acceptance Gate 236 Qualification Suite
                  </h3>
                  <p className="text-xs text-slate-400">Executes all 16 verification tests across sparse assembly, preconditioning, solvers, and regression.</p>
                </div>

                <div className="flex items-center space-x-3">
                  {gateEvaluation && (
                    <button
                      onClick={handleDownloadEvidence}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      JSON Evidence
                    </button>
                  )}
                  <button
                    onClick={handleRunGate236}
                    disabled={isExecutingGate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {isExecutingGate ? 'Running Gate 236 Verification...' : 'Execute Gate 236 Suite'}
                  </button>
                </div>
              </div>

              {gateEvaluation && (
                <div className="space-y-6 mt-4">
                  {/* Gate Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    gateEvaluation.verdict === 'PROVEN'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {gateEvaluation.verdict === 'PROVEN' ? (
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-400" />
                      )}
                      <div>
                        <div className="font-bold text-sm tracking-wide">
                          VERDICT: GATE 236 {gateEvaluation.verdict} ({gateEvaluation.overallScore}%)
                        </div>
                        <div className="text-xs opacity-90">{gateEvaluation.summary}</div>
                      </div>
                    </div>
                  </div>

                  {/* Test Table */}
                  <div className="overflow-hidden border border-slate-800 rounded-lg bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px]">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Test ID</th>
                          <th className="py-2.5 px-4 font-semibold">Test Name</th>
                          <th className="py-2.5 px-4 font-semibold">Status</th>
                          <th className="py-2.5 px-4 font-semibold">Details & Diagnostics</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {gateEvaluation.tests.map((test) => (
                          <tr key={test.id} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-4 font-mono font-semibold text-cyan-400">{test.id}</td>
                            <td className="py-2.5 px-4 font-medium text-slate-200">{test.name}</td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                test.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {test.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {test.passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 text-[11px] font-mono">{test.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
