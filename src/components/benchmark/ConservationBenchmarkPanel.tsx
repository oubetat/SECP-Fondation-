/**
 * SECP Industrial OS v2 — Conservation Enforcement & Benchmark Battery Panel (PATCH-175)
 * Hard Acceptance Gate 175 & Production Qualification Battery 175
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Scale, 
  Flame, 
  Gauge, 
  Zap, 
  RotateCcw, 
  Database, 
  Cpu, 
  Check, 
  Copy, 
  Sliders, 
  ChevronRight,
  TrendingUp,
  FileCheck2,
  Boxes,
  Lock,
  Layers
} from 'lucide-react';
import { HardAcceptanceGate175, Gate175Report, Gate175Check } from '../../engine/benchmark/cfd/HardAcceptanceGate175';
import { ProductionQualificationBattery175, Battery175SuiteReport, BatteryCaseResult } from '../../engine/benchmark/cfd/ProductionQualificationBattery175';
import { AdaptiveIndustrialCFDEngine } from '../../engine/cfd3d/adaptive/AdaptiveIndustrialCFDEngine';
import { CaseDefinition3D, AdaptiveCFDSolution } from '../../engine/cfd3d/adaptive/AdaptiveCFDTypes';
import { Fvm3DMeshGenerator } from '../../engine/cfd3d/Fvm3DMeshGenerator';

export const ConservationBenchmarkPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BATTERY' | 'GATE_175' | 'LIVE_SIMULATOR' | 'INVARIANTS'>('BATTERY');
  const [isRunning, setIsRunning] = useState(false);
  const [batteryReport, setBatteryReport] = useState<Battery175SuiteReport | null>(null);
  const [gateReport, setGateReport] = useState<Gate175Report | null>(null);
  const [selectedCase, setSelectedCase] = useState<BatteryCaseResult | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<Gate175Check | null>(null);
  const [copied, setCopied] = useState(false);

  // Live Simulation state
  const [simInletVel, setSimInletVel] = useState<number>(2.5);
  const [simViscosity, setSimViscosity] = useState<number>(0.001);
  const [simHeatFlux, setSimHeatFlux] = useState<number>(1500);
  const [simResolution, setSimResolution] = useState<'coarse' | 'medium' | 'fine'>('medium');
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [liveSolution, setLiveSolution] = useState<AdaptiveCFDSolution | null>(null);

  const handleRunAll = () => {
    setIsRunning(true);
    setTimeout(() => {
      const gReport = HardAcceptanceGate175.evaluateGate();
      setGateReport(gReport);
      setBatteryReport(gReport.batteryReport);
      if (gReport.batteryReport.results.length > 0) {
        setSelectedCase(gReport.batteryReport.results[0]);
      }
      if (gReport.checks.length > 0) {
        setSelectedCheck(gReport.checks[0]);
      }
      setIsRunning(false);
    }, 400);
  };

  const handleLoadDemo = () => {
    handleRunAll();
    handleRunLiveSimulation();
  };

  const handleRunLiveSimulation = () => {
    setIsSimRunning(true);
    setTimeout(() => {
      const dim = simResolution === 'coarse' ? { nx: 6, ny: 4, nz: 3 } : simResolution === 'medium' ? { nx: 10, ny: 6, nz: 4 } : { nx: 14, ny: 8, nz: 5 };
      const mesh = Fvm3DMeshGenerator.generateStructuredBoxMesh(
        0.5, 0.2, 0.15,
        dim.nx, dim.ny, dim.nz
      );

      const caseDef: CaseDefinition3D = {
        caseId: `CASE-LIVE-CONS-${Date.now().toString(16).slice(-4)}`,
        name: 'Conjugate Mass & Thermal Conservation Invariant Channel',
        description: 'Real-time 3D FVM Navier-Stokes with boundary mass and heat flux verification',
        fluidProperties: {
          density: 1.225,
          viscosity: simViscosity,
          specificHeat: 1005,
          thermalConductivity: 0.026
        },
        boundaryConditions: [
          {
            patchId: 'inlet',
            patchType: 'INLET',
            velocity: [simInletVel, 0, 0],
            temperature: 300,
            turbulenceIntensity: 0.05
          },
          {
            patchId: 'outlet',
            patchType: 'OUTLET',
            pressure: 0
          },
          {
            patchId: 'heated_wall',
            patchType: 'WALL',
            wallType: 'NO_SLIP',
            heatFlux: simHeatFlux
          }
        ],
        solverControls: {
          maxIterations: 60,
          targetCFL: 1.0,
          convergenceTolerance: 1e-4,
          conservationTolerance: 1e-5,
          relaxationFactors: {
            momentum: 0.7,
            pressure: 0.3,
            energy: 0.8
          }
        }
      };

      const solution = AdaptiveIndustrialCFDEngine.solveCase(mesh, caseDef);
      setLiveSolution(solution);
      setIsSimRunning(false);
    }, 250);
  };

  const copyAttestation = () => {
    if (gateReport) {
      navigator.clipboard.writeText(JSON.stringify(gateReport.attestation, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              PATCH-SECP-175
            </span>
            <span className="text-xs text-slate-400 font-mono">Phase 16 Engine</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-amber-400" />
            CFD Conservation Enforcement Battery & Invariant Gate
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Real-time inline conservation law enforcement: mass continuity ($\nabla \cdot \vec{u} = 0$), 3D momentum balances, total energy first law ($\Delta E = Q - W$), and thermodynamic step rejection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadDemo}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-2"
          >
            <Boxes className="w-4 h-4 text-cyan-400" />
            Load Demo Battery
          </button>
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              isRunning
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/20'
            }`}
          >
            {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Evaluating Conservation...' : 'Run Gate 175 Battery'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('BATTERY')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'BATTERY'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Qualification Battery (10 Cases)
        </button>
        <button
          onClick={() => setActiveTab('GATE_175')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'GATE_175'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Hard Acceptance Gate 175
        </button>
        <button
          onClick={() => setActiveTab('LIVE_SIMULATOR')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'LIVE_SIMULATOR'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-400" />
          Live Invariant Simulator
        </button>
        <button
          onClick={() => setActiveTab('INVARIANTS')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'INVARIANTS'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          Thermodynamic Invariants
        </button>
      </div>

      {/* Main Content Areas */}
      {!batteryReport && activeTab !== 'LIVE_SIMULATOR' && (
        <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <Scale className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">Conservation Verification Awaiting Execution</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Run Gate 175 Battery" or "Load Demo Battery" to execute the 10-case physical qualification suite with inline mass, momentum, and thermal conservation audits.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handleLoadDemo}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition"
            >
              Load & Evaluate Now
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Battery 175 */}
      {batteryReport && activeTab === 'BATTERY' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Case List */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suite Certification</span>
                <div className="text-2xl font-black text-white mt-0.5">
                  {batteryReport.passedCases} / {batteryReport.totalCases} Passed
                </div>
                <div className="text-xs text-amber-400 font-bold mt-0.5">
                  Average Score: {batteryReport.suiteScore.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Qualification Cases (A - J)
                </h3>
              </div>
              <div className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
                {batteryReport.results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`w-full p-4 flex items-center justify-between text-left transition hover:bg-slate-800/50 ${
                      selectedCase?.id === c.id ? 'bg-amber-500/10 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {c.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                        <span className={`text-xs font-bold ${selectedCase?.id === c.id ? 'text-amber-400' : 'text-slate-200'}`}>
                          {c.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-6 line-clamp-1">{c.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-300">{c.score}%</span>
                      <ChevronRight className="w-4 h-4 text-slate-600 ml-auto mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Case Details */}
          <div className="col-span-12 lg:col-span-7">
            {selectedCase && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-amber-400 text-[10px] font-mono font-bold rounded">
                        {selectedCase.id}
                      </span>
                      <span className="text-xs text-emerald-400 font-bold">✓ Conservation Enforced</span>
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">{selectedCase.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">{selectedCase.details}</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    {selectedCase.passed ? 'QUALIFIED' : 'DEFECT'}
                  </div>
                </div>

                {/* Diagnostics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Mass Imbalance</span>
                    <div className="text-sm font-mono font-bold text-cyan-400 mt-1">
                      {selectedCase.diagnostics.massImbalance.toExponential(3)} <span className="text-[10px] text-slate-500">kg/s</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Momentum Residual</span>
                    <div className="text-sm font-mono font-bold text-amber-400 mt-1">
                      {selectedCase.diagnostics.momentumResidual.toExponential(3)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Continuity RMS</span>
                    <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
                      {selectedCase.diagnostics.continuityRms.toExponential(3)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Accepted Iters</span>
                    <div className="text-sm font-mono font-bold text-slate-200 mt-1">
                      {selectedCase.diagnostics.acceptedIterations}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Rejected Iters</span>
                    <div className="text-sm font-mono font-bold text-rose-400 mt-1">
                      {selectedCase.diagnostics.rejectedIterations}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Physical Plausibility</span>
                    <div className="text-sm font-bold text-emerald-400 mt-1">
                      {selectedCase.diagnostics.physicalPlausibility ? 'Verified' : 'Violation'}
                    </div>
                  </div>
                </div>

                {/* Solution Telemetry */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Converged Status:</span>
                    <span className="text-emerald-400 font-bold">{selectedCase.solution.converged ? 'TRUE' : 'FALSE'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Iterations Taken:</span>
                    <span className="text-slate-200">{selectedCase.solution.iterations}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Max Velocity Magnitude:</span>
                    <span className="text-cyan-400">{selectedCase.solution.metrics.maxVelocity.toFixed(3)} m/s</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Max Pressure Drop:</span>
                    <span className="text-amber-400">{selectedCase.solution.metrics.maxPressure.toFixed(2)} Pa</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Gate 175 Verification */}
      {gateReport && activeTab === 'GATE_175' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gate 175 Verdict</span>
                <div className="text-2xl font-black text-white mt-0.5">
                  {gateReport.verdict}
                </div>
                <div className="text-xs text-emerald-400 font-bold mt-0.5">
                  Overall Score: {gateReport.totalScore.toFixed(0)}%
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Gate Checks ({gateReport.checks.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
                {gateReport.checks.map((ck) => (
                  <button
                    key={ck.id}
                    onClick={() => setSelectedCheck(ck)}
                    className={`w-full p-4 flex items-center justify-between text-left transition hover:bg-slate-800/50 ${
                      selectedCheck?.id === ck.id ? 'bg-amber-500/10 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {ck.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                        <span className={`text-xs font-bold ${selectedCheck?.id === ck.id ? 'text-amber-400' : 'text-slate-200'}`}>
                          {ck.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 pl-6 font-mono">{ck.id}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-4">
            {selectedCheck && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">{selectedCheck.id}</span>
                    <h2 className="text-lg font-bold text-white mt-0.5">{selectedCheck.name}</h2>
                  </div>
                  <div className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    selectedCheck.passed ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}>
                    {selectedCheck.passed ? 'PASS' : 'FAIL'}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Enforcement Criterion</span>
                    <p className="text-xs text-slate-200 mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      {selectedCheck.criterion}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Measurement Evidence</span>
                    <p className="text-xs font-mono text-cyan-300 mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      {selectedCheck.details}
                    </p>
                  </div>
                </div>

                {/* Cryptographic Attestation Block */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Gate 175 Signed Attestation
                    </span>
                    <button
                      onClick={copyAttestation}
                      className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(gateReport.attestation, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Live Invariant Simulator */}
      {activeTab === 'LIVE_SIMULATOR' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Simulation Parameters
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Inlet Velocity (u_inlet)</span>
                    <span className="font-mono text-cyan-400">{simInletVel.toFixed(1)} m/s</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={simInletVel}
                    onChange={(e) => setSimInletVel(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-800 mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Dynamic Viscosity ($\mu$)</span>
                    <span className="font-mono text-amber-400">{simViscosity} Pa·s</span>
                  </div>
                  <input
                    type="range"
                    min="0.0001"
                    max="0.01"
                    step="0.0005"
                    value={simViscosity}
                    onChange={(e) => setSimViscosity(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 bg-slate-800 mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Wall Heat Flux ($q$)</span>
                    <span className="font-mono text-rose-400">{simHeatFlux} W/m²</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="250"
                    value={simHeatFlux}
                    onChange={(e) => setSimHeatFlux(parseFloat(e.target.value))}
                    className="w-full accent-rose-400 bg-slate-800 mt-1"
                  />
                </div>

                <div>
                  <span className="text-xs text-slate-400">FVM Mesh Discretization</span>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(['coarse', 'medium', 'fine'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setSimResolution(lvl)}
                        className={`py-1.5 text-xs font-bold rounded-lg border uppercase ${
                          simResolution === lvl
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunLiveSimulation}
                disabled={isSimRunning}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {isSimRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isSimRunning ? 'Solving Conservation System...' : 'Execute Inline Simulation'}
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-4">
            {liveSolution ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Live 3D FVM Conservation Results</h3>
                    <p className="text-xs text-slate-400">Inline continuity verification & thermodynamic balance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl">
                      {liveSolution.converged ? 'CONVERGED' : 'ITERATING'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Iterations</span>
                    <div className="text-lg font-mono font-bold text-white mt-0.5">{liveSolution.iterations}</div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mass Imbalance</span>
                    <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">
                      {liveSolution.metrics.massImbalance.toExponential(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Max Velocity</span>
                    <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                      {liveSolution.metrics.maxVelocity.toFixed(2)} <span className="text-xs text-slate-500">m/s</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Pressure Drop</span>
                    <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                      {liveSolution.metrics.maxPressure.toFixed(1)} <span className="text-xs text-slate-500">Pa</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Field Visualizer */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold">Cell Velocity Distribution Profile</span>
                    <span className="font-mono text-[11px] text-cyan-400">Total Cells: {liveSolution.fields.velocity.length}</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {liveSolution.fields.velocity.slice(0, 32).map((v, idx) => {
                      const mag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
                      const norm = Math.min(1, mag / (simInletVel * 1.5 || 1));
                      return (
                        <div
                          key={idx}
                          title={`Cell ${idx}: |v|=${mag.toFixed(2)} m/s`}
                          className="h-9 rounded flex items-center justify-center text-[9px] font-mono font-bold transition"
                          style={{
                            backgroundColor: `rgba(${Math.round(20 + 200 * norm)}, ${Math.round(100 + 100 * (1 - norm))}, ${Math.round(240 * (1 - norm))}, 0.6)`
                          }}
                        >
                          {mag.toFixed(1)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-300">No Simulation Executed</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Configure the fluid velocity, viscosity, and thermal flux on the left panel, then click "Execute Inline Simulation".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Thermodynamic Invariants */}
      {activeTab === 'INVARIANTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Scale className="w-4 h-4" /> Mass Continuity Invariant
            </h3>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              {"∮_{∂Ω} ρ u · dA = 0"}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every finite volume cell must satisfy exact face flux sum ∑ F_f = 0 within tolerance 10^-5 kg/s. Step rejection triggers if local divergence max |∇ · u| &gt; ε.
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Momentum Conservation Invariant
            </h3>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              {"∂(ρ u)/∂t + ∇ · (ρ u ⊗ u) = -∇p + ∇ · τ + ρ g"}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Preserves momentum balance across x, y, z cartesian axes. Non-linear convective fluxes use second-order bounded TVD limiters.
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <Flame className="w-4 h-4" /> First Law of Thermodynamics (Energy Balance)
            </h3>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              {"Q_in - W_out = ∮_{∂Ω} ρ h_tot (u · n) dA"}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Total enthalpy fluxes and conductive boundary wall heat flows are conserved across conjugate solid-fluid interfaces without artificial heat sinks.
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" /> Step Rejection & Divergence Recovery
            </h3>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              {"R_{k+1} > λ R_k ⟹ REJECT ⟶ Δt ⟵ Δt / 2"}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              If an iteration exhibits unbounded local pressure spikes or residual growth, the solver rejects the state, reduces under-relaxation or time step, and recovers without crashing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
