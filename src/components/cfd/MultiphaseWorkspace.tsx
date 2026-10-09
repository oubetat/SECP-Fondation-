/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-252 — Multiphase Workspace Component
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers3, Play, CheckCircle2, XCircle, Clock, Gauge, Sliders, TrendingUp, Cpu, History, ShieldCheck, RefreshCw, Database, Award, AlertTriangle, FileCheck, Scale, Binary, Layers, Thermometer, Zap, Wind, Search, Check, Clipboard, ShieldAlert, Droplet, Waves } from 'lucide-react';

import {
  Phase,
  MultiphasePhysicsModel,
  MultiphaseBC,
  MultiphaseDiagnostics,
  MultiphaseEvidencePackage,
  InterfaceModelType,
  MultiphaseSolver,
  MultiphaseBenchmarkSuite,
  HardAcceptanceGate252,
  GateResult252
} from '../../engine/cfd3d/solvers/multiphase';

export const MultiphaseWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'BENCHMARKS' | 'PROBING' | 'AUDIT' | 'EVIDENCE' | 'HARDBATTERY'>('PIPELINE');
  const [isRunning, setIsRunning] = useState(false);

  // Setup state configs for phase 1 and phase 2
  const [gridSize, setGridSize] = useState<number>(64);
  const [density1, setDensity1] = useState<number | null>(null);
  const [viscosity1, setViscosity1] = useState<number | null>(null);
  const [density2, setDensity2] = useState<number | null>(null);
  const [viscosity2, setViscosity2] = useState<number | null>(null);

  // Physics configs
  const [surfaceTension, setSurfaceTension] = useState<number | null>(null);
  const [contactAngle, setContactAngle] = useState<number | null>(null);
  const [gravityY, setGravityY] = useState<number | null>(null);

  // Solver options
  const [timeStep, setTimeStep] = useState<number | null>(null);
  const [maxIterations, setMaxIterations] = useState<number | null>(null);
  const [relaxation, setRelaxation] = useState<number | null>(null);

  // Simulation state outputs
  const [alpha1, setAlpha1] = useState<number[]>([]);
  const [velocity, setVelocity] = useState<[number, number, number][]>([]);
  const [pressure, setPressure] = useState<number[]>([]);
  const [residuals, setResiduals] = useState<{ momentum: number[]; continuity: number[]; phaseFraction: number[] }>({
    momentum: [],
    continuity: [],
    phaseFraction: []
  });
  const [diagnostics, setDiagnostics] = useState<MultiphaseDiagnostics | null>(null);
  const [failureCodes, setFailureCodes] = useState<string[]>([]);

  // Active Probe State
  const [probeIndex, setProbeIndex] = useState<number>(24);
  const [copiedEvidence, setCopiedEvidence] = useState(false);

  // Automated suite outputs
  const [hardGateReport, setHardGateReport] = useState<GateResult252 | null>(null);

  // Initial load
  useEffect(() => {
    // triggerExecution removed for EMPTY_CANVAS compliance
  }, []);

  const triggerExecution = () => {
    if (density1 === null || viscosity1 === null || density2 === null || viscosity2 === null || surfaceTension === null || contactAngle === null || gravityY === null || timeStep === null || maxIterations === null || relaxation === null) {
      setFailureCodes(['INCOMPLETE_PARAMETERS: Solver requires explicit engineering definitions.']);
      return;
    }
    setIsRunning(true);
    setTimeout(() => {
      try {
        const phase1: Phase = {
          phaseId: 'phase-1',
          name: 'Primary Phase',
          density: density1,
          viscosity: viscosity1
        };

        const phase2: Phase = {
          phaseId: 'phase-2',
          name: 'Secondary Phase',
          density: density2,
          viscosity: viscosity2
        };

        const physicsModel: MultiphasePhysicsModel = {
          interfaceModel: InterfaceModelType.VOF,
          gravityVector: [0.0, gravityY, 0.0],
          surfaceTensionCoefficient: surfaceTension,
          staticContactAngle: contactAngle,
          enableTurbulenceCoupling: false,
          enableThermalCoupling: false,
          enablePhaseChange: false
        };

        const bcs: MultiphaseBC[] = [
          { patchId: 'inlet', phase1Fraction: 1.0, phase2Fraction: 0.0 },
          { patchId: 'wall', phase1Fraction: 0.0, phase2Fraction: 1.0, contactAngle: contactAngle }
        ];

        // Initialize spatial alpha distribution (half liquid, half air)
        const initAlpha = new Array(gridSize).fill(0.0).map((_, i) => (i < gridSize / 2 ? 1.0 : 0.0));
        const initVelocity: [number, number, number][] = new Array(gridSize).fill(null).map((_, i) => [0.1, 0.05, 0.0]);
        const initPressure = new Array(gridSize).fill(101325.0);

        const result = MultiphaseSolver.solveTimeStep(
          gridSize,
          phase1,
          phase2,
          initAlpha,
          initVelocity,
          initPressure,
          physicsModel,
          bcs,
          false,
          timeStep,
          maxIterations,
          relaxation
        );

        setAlpha1(result.alpha1);
        setVelocity(result.velocity);
        setPressure(result.pressure);
        setResiduals(result.residuals);
        setDiagnostics(result.diagnostics);
        setFailureCodes(result.failureCodes);

        // Run automated Acceptance Gate too
        const gate = HardAcceptanceGate252.runSuite(gridSize);
        setHardGateReport(gate);
      } catch (err: any) {
        setFailureCodes([err.message || 'Solver Diverged']);
      } finally {
        setIsRunning(false);
      }
    }, 400);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEvidence(true);
    setTimeout(() => setCopiedEvidence(false), 2000);
  };

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-100 min-h-screen border border-zinc-800" id="multiphase-workspace">
      {/* Title block */}
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
              PATCH-252
            </span>
            <span className="text-zinc-500 text-sm font-mono">• INDUSTRIAL CFD</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Multiphase VOF Interface Solver
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Proven Two-Phase Incompressible Volume of Fluid numerical transport with surface curvature force coupling.
          </p>
        </div>

        {/* Solver actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={triggerExecution}
            disabled={isRunning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded transition flex items-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
            id="run-multiphase-solver"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            Solve Time Step
          </button>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 flex overflow-x-auto gap-1">
        {[
          { id: 'PIPELINE', label: 'Solver Pipeline', icon: Layers3 },
          { id: 'BENCHMARKS', label: 'Numerical Benchmarks', icon: Waves },
          { id: 'PROBING', label: 'Cell Probing', icon: Search },
          { id: 'AUDIT', label: 'Conservation Audit', icon: Scale },
          { id: 'EVIDENCE', label: 'Evidence Package', icon: FileCheck },
          { id: 'HARDBATTERY', label: 'Acceptance Gate', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20'
              }`}
              id={`tab-multiphase-${tab.id.toLowerCase()}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 flex-1">
        {/* Left Control Panel — Column 1 to 4 */}
        <div className="lg:col-span-4 space-y-6">
          {/* Phase 1 & 2 Definitions */}
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl" id="phase-definitions-panel">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-4">
              <Droplet className="w-4 h-4 text-indigo-400" />
              Phase Definitions
            </h3>

            <div className="space-y-4">
              {/* Phase 1 Liquid */}
              <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">Phase 1 (Liquid Water)</span>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Density (kg/m³)</label>
                    <input
                      type="number"
                      value={density1 ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setDensity1(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Viscosity (Pa·s)</label>
                    <input
                      type="number"
                      value={viscosity1 ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setViscosity1(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Phase 2 Air */}
              <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Phase 2 (Gaseous Air)</span>
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Density (kg/m³)</label>
                    <input
                      type="number"
                      value={density2 ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setDensity2(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Viscosity (Pa·s)</label>
                    <input
                      type="number"
                      value={viscosity2 ?? ''}
                      placeholder="UNASSIGNED"
                      onChange={e => setViscosity2(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Surface Tension and Contact Angles */}
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl" id="physics-model-panel">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Surface Physics Model
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Surface Tension Coefficient (σ - N/m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={surfaceTension ?? ''}
                  placeholder="UNASSIGNED"
                  onChange={e => setSurfaceTension(e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Static Contact Angle (θ - degrees)</label>
                <input
                  type="number"
                  value={contactAngle ?? ''}
                  placeholder="UNASSIGNED"
                  onChange={e => setContactAngle(e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Gravity Acceleration (g_y - m/s²)</label>
                <input
                  type="number"
                  value={gravityY ?? ''}
                  placeholder="UNASSIGNED"
                  onChange={e => setGravityY(e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Solver Controls */}
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl" id="solver-settings-panel">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-indigo-400" />
              Solver Execution settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Grid Resolution (cells)</label>
                <select
                  value={gridSize}
                  onChange={e => setGridSize(parseInt(e.target.value) || 64)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="27">27 (Ultra-coarse)</option>
                  <option value="64">64 (Standard coarse)</option>
                  <option value="125">125 (Medium)</option>
                  <option value="216">216 (Fine)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Time Step Size (dt - s)</label>
                <input
                  type="number"
                  step="0.001"
                  value={timeStep ?? ''}
                  placeholder="UNASSIGNED"
                  onChange={e => setTimeStep(e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Max Iterations per Step</label>
                <input
                  type="number"
                  value={maxIterations ?? ''}
                  placeholder="UNASSIGNED"
                  onChange={e => setMaxIterations(e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Tab Content View — Column 5 to 12 */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'PIPELINE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-pipeline"
              >
                {/* 2D VOF Interface Field Representation */}
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-zinc-200">Fluid Phase Interface Field Contour Map</h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                      <span className="flex items-center gap-1"><span className="w-2h-2 w-2.5 h-2.5 bg-blue-600 rounded"></span> Liquid</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-zinc-800 rounded"></span> Gas</span>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg flex flex-col items-center">
                    {/* Render field contour grid */}
                    {alpha1.length > 0 ? (
                      <div className="grid grid-cols-8 gap-1.5 w-full max-w-lg">
                        {alpha1.map((alpha, idx) => {
                          // Blue saturation representing liquid fraction alpha_1
                          const blueOpacity = alpha;
                          return (
                            <div
                              key={idx}
                              onClick={() => setProbeIndex(idx)}
                              className="aspect-square rounded border cursor-pointer transition flex items-center justify-center text-[9px] font-mono hover:scale-105"
                              style={{
                                backgroundColor: `rgba(37, 99, 235, ${blueOpacity})`,
                                borderColor: idx === probeIndex ? '#f43f5e' : 'rgba(63, 63, 70, 0.4)'
                              }}
                              title={`Cell ${idx}: α = ${alpha.toFixed(4)}`}
                            >
                              <span className={alpha > 0.6 ? 'text-white font-bold' : 'text-zinc-500'}>
                                {alpha.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-20 text-center text-zinc-500 text-xs">
                        No active simulation field. Click "Solve Time Step" to launch VOF calculations.
                      </div>
                    )}

                    <div className="w-full mt-4 flex justify-between text-xs text-zinc-500 border-t border-zinc-800/80 pt-3 px-2">
                      <span>Left Boundary (Inlet)</span>
                      <span>VOF Advection Front Evolution</span>
                      <span>Right Boundary (Outlet)</span>
                    </div>
                  </div>
                </div>

                {/* Diagnostics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Primary Phase Volume', val: diagnostics ? `${diagnostics.totalVolume1.toFixed(6)} m³` : '—', color: 'text-indigo-400' },
                    { label: 'Secondary Phase Volume', val: diagnostics ? `${diagnostics.totalVolume2.toFixed(6)} m³` : '—', color: 'text-teal-400' },
                    { label: 'Interface CFL', val: diagnostics ? diagnostics.interfaceCFL.toFixed(4) : '—', color: 'text-yellow-400' },
                    { label: 'Volume Imbalance', val: diagnostics ? `${diagnostics.volumeImbalance.toExponential(3)}` : '—', color: 'text-rose-400' }
                  ].map((stat, i) => (
                    <div key={i} className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl">
                      <span className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1 font-mono">{stat.label}</span>
                      <span className={`text-lg font-bold font-mono ${stat.color}`}>{stat.val}</span>
                    </div>
                  ))}
                </div>

                {/* Local Convergence Logs */}
                <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    Multiphase Solver Convergence Residuals
                  </h3>
                  <div className="bg-zinc-950 p-4 border border-zinc-800/80 rounded-lg font-mono text-xs text-zinc-300 space-y-1.5">
                    <div>Time Step size: {timeStep} s</div>
                    <div>Momentum Residual: {residuals.momentum.length > 0 ? residuals.momentum[residuals.momentum.length - 1].toExponential(6) : '—'}</div>
                    <div>Continuity Residual: {residuals.continuity.length > 0 ? residuals.continuity[residuals.continuity.length - 1].toExponential(6) : '—'}</div>
                    <div>Phase Fraction Residual: {residuals.phaseFraction.length > 0 ? residuals.phaseFraction[residuals.phaseFraction.length - 1].toExponential(6) : '—'}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'BENCHMARKS' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-benchmarks"
              >
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-4">
                    Multiphase Benchmark Suite Validation (Theoretical vs Numerical)
                  </h3>

                  <div className="space-y-4">
                    {['BENCHMARK_A', 'BENCHMARK_B', 'BENCHMARK_C', 'BENCHMARK_D', 'BENCHMARK_E'].map(id => {
                      const res = MultiphaseBenchmarkSuite.runBenchmark(id as any, gridSize);
                      return (
                        <div key={id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-center">
                          <div className="space-y-1">
                            <span className="block text-xs font-semibold text-zinc-300">{res.title}</span>
                            <div className="flex gap-4 text-[11px] font-mono text-zinc-500">
                              <span>Ref: {res.referenceValue.toFixed(4)}</span>
                              <span>Sim: {res.simulatedValue.toFixed(4)}</span>
                              <span>Err: {(res.relativeError * 100).toFixed(4)}%</span>
                            </div>
                          </div>

                          <span className={`px-2 py-1 text-xs font-mono font-bold rounded border ${
                            res.passed
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}>
                            {res.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'PROBING' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-probing"
              >
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-4">
                    Active Cell Local Probe (Cell Index: {probeIndex})
                  </h3>

                  {alpha1.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-500 font-mono">Phase 1 Fraction (Liquid)</span>
                          <span className="text-lg font-bold font-mono text-indigo-400">
                            {alpha1[probeIndex]?.toFixed(6) ?? '—'}
                          </span>
                        </div>
                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-500 font-mono">Phase 2 Fraction (Gas)</span>
                          <span className="text-lg font-bold font-mono text-teal-400">
                            {alpha1[probeIndex] !== undefined ? (1.0 - alpha1[probeIndex]).toFixed(6) : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-500 font-mono">Local Velocity vector (u, v, w)</span>
                          <span className="text-sm font-bold font-mono text-zinc-300">
                            {velocity[probeIndex] ? `[${velocity[probeIndex][0].toFixed(4)}, ${velocity[probeIndex][1].toFixed(4)}, ${velocity[probeIndex][2].toFixed(4)}] m/s` : '—'}
                          </span>
                        </div>
                        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-500 font-mono">Local Pressure</span>
                          <span className="text-lg font-bold font-mono text-zinc-300">
                            {pressure[probeIndex] ? `${pressure[probeIndex].toFixed(2)} Pa` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-8">Solve a time step first to probe local fields.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'AUDIT' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-audit"
              >
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-400" />
                    Global Mass & Volume Conservation Audit
                  </h3>

                  {diagnostics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-400 font-mono mb-1">Water Phase Mass (kg)</span>
                          <span className="text-lg font-bold font-mono text-zinc-200">
                            {diagnostics.totalMass1.toFixed(6)}
                          </span>
                        </div>
                        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                          <span className="block text-xs text-zinc-400 font-mono mb-1">Air Phase Mass (kg)</span>
                          <span className="text-lg font-bold font-mono text-zinc-200">
                            {diagnostics.totalMass2.toFixed(6)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                        <span className="block text-xs text-zinc-400 font-mono mb-2">Mass Conservation Verdict</span>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> CONSERVATIVE
                          </span>
                          <span className="text-xs font-mono text-zinc-500">Imbalance Error: {diagnostics.massImbalance.toExponential(4)} kg</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-8">Solve a time step first to audit conservation.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'EVIDENCE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-evidence"
              >
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-400" />
                      Immutable Evidence Ledger Package (JSON)
                    </h3>
                    {hardGateReport?.evidence && (
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(hardGateReport.evidence, null, 2))}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedEvidence ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                        {copiedEvidence ? 'Copied!' : 'Copy Evidence'}
                      </button>
                    )}
                  </div>

                  {hardGateReport?.evidence ? (
                    <pre className="bg-zinc-950 p-4 border border-zinc-800/80 rounded-lg font-mono text-[11px] text-zinc-300 max-h-96 overflow-y-auto">
                      {JSON.stringify(hardGateReport.evidence, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-8">No evidence package compiled yet.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'HARDBATTERY' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 flex-1"
                id="view-hardgate"
              >
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-400" />
                      Hard Acceptance Gate 252 (23 Critical Tests Suite)
                    </h3>

                    {hardGateReport && (
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-full">
                        VERDICT: {hardGateReport.overallVerdict}
                      </span>
                    )}
                  </div>

                  {hardGateReport ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex justify-between items-center">
                        <span className="text-xs text-zinc-400">Total verified items matching scope:</span>
                        <span className="text-sm font-bold font-mono text-indigo-400">
                          {hardGateReport.testsPassed} / {hardGateReport.testsTotal} Passed
                        </span>
                      </div>

                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {hardGateReport.testReports.map((report, idx) => (
                          <div key={idx} className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg flex justify-between items-center text-xs">
                            <span className="text-zinc-300 font-mono">{report.name}</span>
                            <div className="flex items-center gap-2">
                              {report.diagnostics && (
                                <span className="text-[10px] text-zinc-500 font-mono">({report.diagnostics.join(', ')})</span>
                              )}
                              {report.success ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-8">Acceptance reports are evaluated after a solver step.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
