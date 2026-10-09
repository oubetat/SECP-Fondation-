import React, { useState, useEffect } from 'react';
import { Activity, Play, ShieldCheck, CheckCircle2, AlertTriangle, Cpu, Layers, BarChart3, RefreshCw, Download, Database, Grid, Zap, TrendingUp, Sliders, FileCheck, RotateCcw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  NonlinearStructuralSolver,
  StructuralProblemDefinition
} from '../../engine/fem/nonlinear/solver/NonlinearStructuralSolver';
import {
  HardGate238Result,
  NonlinearAnalysisResult,
  NonlinearKinematicsMode,
  NonlinearSolverType,
  ReturnMappingOptions,
  YieldCriterionType,
  HardeningModelType
} from '../../engine/fem/nonlinear/types/NonlinearStructuralTypes';
import { HardAcceptanceGate238 } from '../../engine/fem/nonlinear/verification/HardAcceptanceGate238';

export const NonlinearSolverWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'CURVES' | 'DIAGNOSTICS' | 'GATE_238'>('DASHBOARD');

  // Solver Configuration State
  const [solverType, setSolverType] = useState<NonlinearSolverType>('FULL_NEWTON');
  const [kinematicsMode, setKinematicsMode] = useState<NonlinearKinematicsMode>('SMALL_DISPLACEMENT');
  const [yieldCriterion, setYieldCriterion] = useState<YieldCriterionType>('VON_MISES');
  const [hardeningModel, setHardeningModel] = useState<HardeningModelType>('ISOTROPIC_LINEAR');

  const [youngsModulusGPa, setYoungsModulusGPa] = useState<number | null>(null);
  const [poissonsRatio, setPoissonsRatio] = useState<number | null>(null);
  const [yieldStressMPa, setYieldStressMPa] = useState<number | null>(null);
  const [hardeningModulusGPa, setHardeningModulusGPa] = useState<number | null>(null);

  const [numLoadSteps, setNumLoadSteps] = useState<number>(10);
  const [appliedForcekN, setAppliedForcekN] = useState<number | null>(null);
  const [preferredLinearSolver, setPreferredLinearSolver] = useState<'CHOLESKY' | 'PCG' | 'CG' | 'GMRES'>('CHOLESKY');

  // Execution Results State
  const [analysisResult, setAnalysisResult] = useState<NonlinearAnalysisResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [gateResult, setGateResult] = useState<HardGate238Result | null>(null);

  // Default Cantilever Mesh Builder (4x1 Quad Mesh)
  const buildProblemDefinition = (): StructuralProblemDefinition => {
    const L = 1.0;
    const H = 0.1;
    const numElemX = 4;
    const numElemY = 1;

    const nodes: { id: string; x: number; y: number }[] = [];
    const nodeIndexMap = new Map<string, number>();

    for (let j = 0; j <= numElemY; j++) {
      for (let i = 0; i <= numElemX; i++) {
        const x = (i / numElemX) * L;
        const y = (j / numElemY) * H - H / 2;
        const id = `N_${i}_${j}`;
        nodeIndexMap.set(id, nodes.length);
        nodes.push({ id, x, y });
      }
    }

    const elements = [];
    for (let j = 0; j < numElemY; j++) {
      for (let i = 0; i < numElemX; i++) {
        const n0 = nodeIndexMap.get(`N_${i}_${j}`)!;
        const n1 = nodeIndexMap.get(`N_${i + 1}_${j}`)!;
        const n2 = nodeIndexMap.get(`N_${i + 1}_${j + 1}`)!;
        const n3 = nodeIndexMap.get(`N_${i}_${j + 1}`)!;

        const refCoords = [
          [nodes[n0].x, nodes[n0].y],
          [nodes[n1].x, nodes[n1].y],
          [nodes[n2].x, nodes[n2].y],
          [nodes[n3].x, nodes[n3].y]
        ];

        const gp1 = { dNdX: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], weight: (L / numElemX) * (H / numElemY) * 0.25 };
        const gp2 = { dNdX: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], weight: (L / numElemX) * (H / numElemY) * 0.25 };

        elements.push({
          elementId: `E_${i}_${j}`,
          nodeIndices: [n0, n1, n2, n3],
          referenceCoords: refCoords,
          gaussPoints: [gp1, gp2]
        });
      }
    }

    const fixedBCs: { dofIndex: number; prescribedValue: number }[] = [];
    nodes.forEach((n, idx) => {
      if (Math.abs(n.x) < 1e-6) {
        fixedBCs.push({ dofIndex: idx * 2 + 0, prescribedValue: 0.0 });
        fixedBCs.push({ dofIndex: idx * 2 + 1, prescribedValue: 0.0 });
      }
    });

    const rightNodes = nodes.filter(n => Math.abs(n.x - L) < 1e-6);
    const tipLoadPerNode = (-(appliedForcekN || 0) * 1000.0) / rightNodes.length;
    const appliedLoads = rightNodes.map(n => ({
      dofIndex: nodeIndexMap.get(n.id)! * 2 + 1,
      totalMagnitude: tipLoadPerNode
    }));

    const materialOptions: ReturnMappingOptions = {
      yieldCriterion,
      hardeningModel,
      youngsModulus: (youngsModulusGPa || 0) * 1e9,
      poissonsRatio: poissonsRatio || 0.3,
      initialYieldStress: (yieldStressMPa || 0) * 1e6,
      isotropicHardeningModulus: (hardeningModulusGPa || 0) * 1e9,
      kinematicHardeningModulus: 0.0,
      tolerance: 1e-8,
      maxLocalIterations: 20
    };

    return {
      name: `Cantilever Beam Elastoplastic Analysis (${appliedForcekN || 0} kN)`,
      solverType,
      kinematicsMode,
      materialOptions,
      elements,
      nodeCount: nodes.length,
      dofsPerNode: 2,
      fixedBCs,
      appliedLoads,
      stepSettings: {
        numLoadSteps,
        initialIncrement: 1.0 / numLoadSteps,
        minIncrement: 1e-4,
        maxIncrement: 0.25,
        maxStepRetries: 5,
        adaptiveSteppingEnabled: true
      },
      enableLineSearch: true,
      preferredLinearSolver
    };
  };

  const runAnalysis = () => {
    if (youngsModulusGPa === null || poissonsRatio === null || yieldStressMPa === null || hardeningModulusGPa === null || appliedForcekN === null) {
      return;
    }
    setIsExecuting(true);
    setTimeout(() => {
      const def = buildProblemDefinition();
      const res = NonlinearStructuralSolver.solve(def);
      setAnalysisResult(res);
      setIsExecuting(false);
    }, 50);
  };

  const runGate238 = () => {
    setIsExecuting(true);
    setTimeout(() => {
      const gate = HardAcceptanceGate238.runQualificationSuite();
      setGateResult(gate);
      setIsExecuting(false);
    }, 100);
  };

  useEffect(() => {
    // Phase 2: Elimination of UI Reseeding - Do not auto-run analysis or gate on mount
    // runAnalysis();
    // runGate238();
  }, []);

  const exportEvidenceJson = () => {
    if (!gateResult) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gateResult.evidencePackage, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'PATCH-238-Nonlinear-Structural-Evidence.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans border-t border-slate-800">
      {/* Top Header & Navigation Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">
                PATCH-238 — Nonlinear Structural Solver Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Incremental-Iterative FEM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Newton-Raphson • Radial Return Mapping • Consistent Tangent D_ep • Geometric Stiffness K_geo • Gate 238
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-amber-600/20"
          >
            {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            <span>Execute Analysis</span>
          </button>
          <button
            onClick={runGate238}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-emerald-600/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Run Gate 238 (15 Tests)</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs Bar */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'DASHBOARD'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Solver Controls & Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('CURVES')}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'CURVES'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Load-Displacement & Stress Curves</span>
        </button>
        <button
          onClick={() => setActiveTab('DIAGNOSTICS')}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'DIAGNOSTICS'
              ? 'border-amber-400 text-amber-300 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Newton Iteration Diagnostics</span>
        </button>
        <button
          onClick={() => setActiveTab('GATE_238')}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'GATE_238'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Hard Acceptance Gate 238</span>
          {gateResult && (
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
              gateResult.overallVerdict === 'PROVEN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {gateResult.passedCount}/15 PROVEN
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
        {/* TAB 1: DASHBOARD & CONTROLS */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Configuration Panel */}
            <div className="col-span-12 lg:col-span-5 bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-xl space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Nonlinear Analysis Parameters
                </h2>
              </div>

              {/* Solver Algorithm & Kinematics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nonlinear Solver</label>
                  <select
                    value={solverType}
                    onChange={e => setSolverType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="FULL_NEWTON">Full Newton-Raphson</option>
                    <option value="MODIFIED_NEWTON">Modified Newton-Raphson</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Kinematics Mode</label>
                  <select
                    value={kinematicsMode}
                    onChange={e => setKinematicsMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="SMALL_DISPLACEMENT">Small Displacement</option>
                    <option value="TOTAL_LAGRANGIAN">Total Lagrangian (Large Disp)</option>
                  </select>
                </div>
              </div>

              {/* Material Constitutive Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Yield Criterion</label>
                  <select
                    value={yieldCriterion}
                    onChange={e => setYieldCriterion(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="VON_MISES">Von Mises J2</option>
                    <option value="TRESCA">Tresca Shear</option>
                    <option value="DRUCKER_PRAGER">Drucker-Prager</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Hardening Model</label>
                  <select
                    value={hardeningModel}
                    onChange={e => setHardeningModel(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="ISOTROPIC_LINEAR">Isotropic Linear Hardening</option>
                    <option value="PERFECT_PLASTICITY">Perfect Plasticity (H=0)</option>
                  </select>
                </div>
              </div>

              {/* Material Numerical Values */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
                <div>
                  <label className="text-[11px] text-slate-400">Young's Modulus E (GPa)</label>
                  <input
                    type="number"
                    value={youngsModulusGPa}
                    onChange={e => setYoungsModulusGPa(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-amber-300 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Poisson's Ratio ν</label>
                  <input
                    type="number"
                    step="0.01"
                    value={poissonsRatio}
                    onChange={e => setPoissonsRatio(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-amber-300 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Yield Stress σ_y0 (MPa)</label>
                  <input
                    type="number"
                    value={yieldStressMPa}
                    onChange={e => setYieldStressMPa(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-amber-300 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Hardening Modulus H (GPa)</label>
                  <input
                    type="number"
                    value={hardeningModulusGPa}
                    onChange={e => setHardeningModulusGPa(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-amber-300 font-mono mt-1"
                  />
                </div>
              </div>

              {/* Load & Solver Parameters */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Load Steps</label>
                  <input
                    type="number"
                    value={numLoadSteps}
                    onChange={e => setNumLoadSteps(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Load F (kN)</label>
                  <input
                    type="number"
                    value={appliedForcekN}
                    onChange={e => setAppliedForcekN(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-amber-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">PATCH-237 Linear</label>
                  <select
                    value={preferredLinearSolver}
                    onChange={e => setPreferredLinearSolver(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  >
                    <option value="CHOLESKY">Sparse Cholesky</option>
                    <option value="PCG">Preconditioned CG</option>
                    <option value="GMRES">GMRES(10)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Solution Summary Cards */}
            <div className="col-span-12 lg:col-span-7 space-y-5">
              {analysisResult ? (
                <div className="space-y-5">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    analysisResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      {analysisResult.success ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-rose-400" />}
                      <div>
                        <h3 className="text-sm font-bold">{analysisResult.problemName}</h3>
                        <p className="text-xs opacity-90">{analysisResult.statusMessage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono block opacity-70">Signature</span>
                      <span className="text-xs font-mono font-bold">{analysisResult.cryptographicSignature.slice(0, 22)}...</span>
                    </div>
                  </div>

                  {/* High Level Metrics Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <span className="text-xs text-slate-400 block mb-1">Max Displacement</span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {(Math.hypot(...analysisResult.finalDisplacements) * 1000).toFixed(3)} mm
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <span className="text-xs text-slate-400 block mb-1">Max Von Mises Stress</span>
                      <span className="text-lg font-bold font-mono text-cyan-400">
                        {(analysisResult.finalMaxVonMisesStress / 1e6).toFixed(1)} MPa
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <span className="text-xs text-slate-400 block mb-1">Max Plastic Strain</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {analysisResult.finalMaxEquivalentPlasticStrain.toExponential(3)}
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <span className="text-xs text-slate-400 block mb-1">Total Newton Iters</span>
                      <span className="text-lg font-bold font-mono text-violet-400">
                        {analysisResult.totalNewtonIterations}
                      </span>
                    </div>
                  </div>

                  {/* Load Steps Mini Summary Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>Completed Load Steps Overview</span>
                      <span className="text-slate-400 font-mono font-normal">
                        Runtime: {analysisResult.totalRuntimeMs.toFixed(1)} ms
                      </span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                          <tr>
                            <th className="px-3 py-2">Step</th>
                            <th className="px-3 py-2">Load Factor λ</th>
                            <th className="px-3 py-2">Newton Iters</th>
                            <th className="px-3 py-2">Max Stress (MPa)</th>
                            <th className="px-3 py-2">Plastic Strain</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {analysisResult.loadStepResults.map(step => (
                            <tr key={step.stepIndex} className="hover:bg-slate-800/40">
                              <td className="px-3 py-2 font-bold text-slate-200">#{step.stepIndex}</td>
                              <td className="px-3 py-2 text-amber-300">λ = {step.loadFactor.toFixed(2)}</td>
                              <td className="px-3 py-2 text-cyan-300">{step.iterationsCount}</td>
                              <td className="px-3 py-2">{(step.maxVonMisesStress / 1e6).toFixed(1)}</td>
                              <td className="px-3 py-2 text-emerald-300">{step.maxEquivalentPlasticStrain.toExponential(2)}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  step.converged ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                  {step.converged ? 'CONVERGED' : 'FAILED'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-slate-600 animate-pulse" />
                  <p>Executing initial nonlinear FEM simulation...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LOAD-DISPLACEMENT & STRESS CURVES */}
        {activeTab === 'CURVES' && analysisResult && (
          <div className="grid grid-cols-12 gap-6">
            {/* Load Factor vs Displacement Curve */}
            <div className="col-span-12 lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Load Factor λ vs Max Displacement (mm)</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Demonstrates nonlinear force-displacement equilibrium path and elastoplastic softening/hardening.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysisResult.loadDisplacementCurve.map(pt => ({
                    loadFactor: pt.loadFactor,
                    dispMM: pt.displacement * 1000,
                    plasticPct: pt.maxPlasticStrain * 100
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="dispMM" stroke="#94a3b8" label={{ value: 'Displacement (mm)', position: 'bottom', fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" label={{ value: 'Load Factor λ', angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="loadFactor" name="Load Factor λ" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Equivalent Plastic Strain Evolution */}
            <div className="col-span-12 lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Equivalent Plastic Strain Evolution (ε_p)</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Monotonic accumulation of plastic deformation after exceeding yield threshold σ_y0 = {yieldStressMPa} MPa.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysisResult.loadStepResults.map(s => ({
                    loadFactor: s.loadFactor,
                    plasticStrain: s.maxEquivalentPlasticStrain,
                    maxStressMPa: s.maxVonMisesStress / 1e6
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="loadFactor" stroke="#94a3b8" label={{ value: 'Load Factor λ', position: 'bottom', fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" label={{ value: 'Plastic Strain', angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="plasticStrain" name="Equivalent Plastic Strain" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSTICS */}
        {activeTab === 'DIAGNOSTICS' && analysisResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Full Newton Iteration Diagnostic Ledger</span>
              </span>
              <span className="text-xs text-slate-400 font-mono font-normal">
                Total Steps: {analysisResult.totalLoadSteps} | Total Newton Iters: {analysisResult.totalNewtonIterations}
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Step</th>
                    <th className="px-3 py-2">Iter</th>
                    <th className="px-3 py-2">Load λ</th>
                    <th className="px-3 py-2">||R||</th>
                    <th className="px-3 py-2">Rel Residual</th>
                    <th className="px-3 py-2">||Δu||</th>
                    <th className="px-3 py-2">Linear Solver</th>
                    <th className="px-3 py-2">Lin Iters</th>
                    <th className="px-3 py-2">Line Search α</th>
                    <th className="px-3 py-2">Yielded Pts</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analysisResult.loadStepResults.flatMap(step =>
                    step.diagnostics.map((diag, dIdx) => (
                      <tr key={`${step.stepIndex}_${dIdx}`} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-bold text-slate-200">#{diag.loadStep}</td>
                        <td className="px-3 py-2 text-cyan-300">i={diag.iteration}</td>
                        <td className="px-3 py-2 text-amber-300">{diag.loadFactor.toFixed(2)}</td>
                        <td className="px-3 py-2">{diag.forceResidualNorm.toExponential(2)}</td>
                        <td className="px-3 py-2">{diag.relativeForceResidual.toExponential(2)}</td>
                        <td className="px-3 py-2 text-slate-200">{diag.displacementIncrementNorm.toExponential(2)}</td>
                        <td className="px-3 py-2 text-indigo-300">{diag.linearSolverSelected}</td>
                        <td className="px-3 py-2 text-violet-300">{diag.linearSolverIterations}</td>
                        <td className="px-3 py-2 text-emerald-300">{diag.lineSearchStepAlpha.toFixed(2)}</td>
                        <td className="px-3 py-2 text-amber-400">{diag.materialYieldingCount}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            diag.isConverged ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {diag.isConverged ? 'CONVERGED' : 'ITERATING'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: HARD ACCEPTANCE GATE 238 */}
        {activeTab === 'GATE_238' && (
          <div className="space-y-6">
            {/* Gate Summary Card */}
            {gateResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl border ${
                    gateResult.overallVerdict === 'PROVEN'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{gateResult.gateName}</span>
                      <span className={`px-3 py-0.5 text-xs rounded-full font-bold ${
                        gateResult.overallVerdict === 'PROVEN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        VERDICT: {gateResult.overallVerdict}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Executed 15 rigorous qualification tests • {gateResult.passedCount} / {gateResult.totalTests} PROVEN
                    </p>
                  </div>
                </div>

                <button
                  onClick={exportEvidenceJson}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Evidence Package (.json)</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                <p>Executing Gate 238 test battery...</p>
              </div>
            )}

            {/* Test Grid */}
            {gateResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gateResult.testResults.map(t => (
                  <div key={t.testId} className={`p-4 rounded-xl border flex flex-col justify-between ${
                    t.passed ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50' : 'bg-rose-950/20 border-rose-800/60'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-800 rounded text-amber-400">
                          {t.testId}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.passed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {t.verdict}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1.5">{t.name}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{t.details}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Verification</span>
                      <span className="text-emerald-400 font-bold">Passed</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
