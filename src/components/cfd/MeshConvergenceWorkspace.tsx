/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-247 — Mesh Convergence Workspace
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Play, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Database, 
  ChevronRight, 
  TrendingDown, 
  Gauge, 
  Grid, 
  TrendingUp, 
  Award, 
  Zap, 
  Cpu, 
  RefreshCw, 
  Scale,
  Boxes,
  Sliders
} from 'lucide-react';
import { MeshConvergenceEngine, MeshConvergenceStudyConfig, QuantityOfInterestType, MeshLevel, MeshConvergenceEvidence } from '../../engine/cfd3d/solvers/MeshConvergenceEngine';
import { HardAcceptanceGate247, GateResult247 } from '../../engine/cfd3d/solvers/HardAcceptanceGate247';

export const MeshConvergenceWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STUDY' | 'GCI' | 'GATE' | 'THEORY'>('STUDY');
  const [isRunning, setIsRunning] = useState(false);
  const [studyResult, setStudyResult] = useState<MeshConvergenceEvidence | null>(null);
  const [gateResult, setGateResult] = useState<GateResult247 | null>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  const [targetQoI, setTargetQoI] = useState<QuantityOfInterestType>(QuantityOfInterestType.MAX_VELOCITY);
  const [tolerance, setTolerance] = useState<number>(0.05); // 5% default
  const [density, setDensity] = useState<number>(1.225);
  const [viscosity, setViscosity] = useState<number>(1.81e-5);
  const [refinementRatio, setRefinementRatio] = useState<number>(1.5);

  const handleRunConvergenceStudy = () => {
    setIsRunning(true);
    setStudyResult(null);
    setGateResult(null);
    
    setTimeout(() => {
      const config: MeshConvergenceStudyConfig = {
        studyId: 'STUDY_GRID_CONV_247',
        Lx: 1.0,
        Ly: 0.2,
        Lz: 0.2,
        density: density,
        viscosity: viscosity,
        maxIterations: 10,
        convergenceThreshold: 1e-8,
        refinementRatio: refinementRatio,
        underRelaxationU: 0.7,
        underRelaxationP: 0.3,
        targetQoI: targetQoI,
        tolerance: tolerance
      };

      const evidence = MeshConvergenceEngine.runMeshConvergenceStudy(config);
      const gateSuite = HardAcceptanceGate247.runSuite();

      setStudyResult(evidence);
      setGateResult(gateSuite);
      setSelectedTest(gateSuite.testReports[0]);
      setIsRunning(false);
    }, 500);
  };

  const handleLoadDemo = () => {
    setDensity(1.225);
    setViscosity(1.81e-5);
    setRefinementRatio(1.5);
    setTolerance(0.05);
    setTargetQoI(QuantityOfInterestType.MAX_VELOCITY);
    handleRunConvergenceStudy();
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              PATCH-SECP-247
            </span>
            <span className="text-xs text-slate-400 font-mono">ASME V&V 20 Standard</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-2.5">
            <Grid className="w-6 h-6 text-amber-400" />
            Mesh Independence & Richardson Extrapolation (GCI)
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Roache Grid Convergence Index ($GCI_{fine}$), apparent order of spatial accuracy ($p$), asymptotic range of convergence check, and Richardson extrapolated continuum continuum limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadDemo}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-2"
          >
            <Boxes className="w-4 h-4 text-cyan-400" />
            Load Demo 3-Mesh Study
          </button>
          <button
            onClick={handleRunConvergenceStudy}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20'
            }`}
          >
            {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Refining 3-Grid Hierarchy...' : 'Run GCI Study & Gate 247'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('STUDY')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'STUDY'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Grid Refinement Setup
        </button>
        <button
          onClick={() => setActiveTab('GCI')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'GCI'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Roache GCI & Extrapolation
        </button>
        <button
          onClick={() => setActiveTab('GATE')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'GATE'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Hard Acceptance Gate 247
        </button>
        <button
          onClick={() => setActiveTab('THEORY')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'THEORY'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          ASME V&V Standard Theory
        </button>
      </div>

      {/* Tab 1: Setup */}
      {activeTab === 'STUDY' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Grid Study Controls
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Target Quantity of Interest (QoI)</label>
                  <select
                    value={targetQoI}
                    onChange={(e) => setTargetQoI(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 focus:border-amber-500 outline-none"
                  >
                    <option value={QuantityOfInterestType.MAX_VELOCITY}>Maximum Centerline Velocity ($u_{max}$)</option>
                    <option value={QuantityOfInterestType.PRESSURE_DROP}>Total Static Pressure Drop ($\Delta p$)</option>
                    <option value={QuantityOfInterestType.TOTAL_WALL_SHEAR}>Integrated Wall Skin Friction ($\tau_w$)</option>
                    <option value={QuantityOfInterestType.MASS_FLOW_RATE}>Outlet Mass Flow Rate ($\dot{m}$)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Grid Refinement Ratio ($r = h_{coarse} / h_{fine}$)</span>
                    <span className="font-mono text-amber-400">{refinementRatio.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="1.2"
                    max="2.0"
                    step="0.05"
                    value={refinementRatio}
                    onChange={(e) => setRefinementRatio(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 bg-slate-800 mt-1"
                  />
                  <span className="text-[10px] text-slate-500">ASME recommends $r \ge 1.3$</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400">Density $\rho$ (kg/m³)</label>
                    <input
                      type="number"
                      value={density}
                      onChange={(e) => setDensity(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-400 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Viscosity $\mu$ (Pa·s)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={viscosity}
                      onChange={(e) => setViscosity(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-400 mt-1"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunConvergenceStudy}
                disabled={isRunning}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isRunning ? 'Solving 3 Grids...' : 'Execute 3-Mesh Richardson Study'}
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-4">
            {studyResult ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">3-Level Mesh Hierarchy Results</h3>
                    <p className="text-xs text-slate-400">Coarse, Medium, and Fine discrete evaluations</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-xl border ${
                    studyResult.isAsymptoticRangeSatisfied
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}>
                    {studyResult.isAsymptoticRangeSatisfied ? 'ASYMPTOTIC REGIME MET' : 'PRE-ASYMPTOTIC'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mesh 1 (Coarse)</span>
                    <div className="text-base font-mono font-bold text-slate-300 mt-0.5">
                      {studyResult.coarseLevel.cellCount} cells
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">
                      QoI = {studyResult.coarseLevel.qoiValue.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mesh 2 (Medium)</span>
                    <div className="text-base font-mono font-bold text-slate-300 mt-0.5">
                      {studyResult.mediumLevel.cellCount} cells
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">
                      QoI = {studyResult.mediumLevel.qoiValue.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Mesh 3 (Fine)</span>
                    <div className="text-base font-mono font-bold text-slate-300 mt-0.5">
                      {studyResult.fineLevel.cellCount} cells
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      QoI = {studyResult.fineLevel.qoiValue.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Apparent Convergence Order ($p$):</span>
                    <div className="text-lg font-mono font-bold text-amber-400">
                      {studyResult.apparentOrder.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Fine Grid GCI ($GCI_{fine}$):</span>
                    <div className="text-lg font-mono font-bold text-emerald-400">
                      {(studyResult.fineGCI * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Continuum Limit ($\phi_{extrap}$):</span>
                    <div className="text-lg font-mono font-bold text-cyan-400">
                      {studyResult.extrapolatedQoI.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Grid className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-300">No Grid Study Evaluated</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click "Execute 3-Mesh Richardson Study" to calculate Roache GCI and confirm numerical mesh independence.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Roache GCI Analysis */}
      {activeTab === 'GCI' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          {studyResult ? (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-white">Roache Grid Convergence Index (GCI) Analysis</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Relative Error $e_{21}$ (Medium-Fine)</span>
                  <div className="text-xl font-mono font-bold text-cyan-400 mt-1">
                    {(studyResult.relativeErrorMediumFine * 100).toFixed(3)}%
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Roache Fine GCI ($F_s = 1.25$)</span>
                  <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                    {(studyResult.fineGCI * 100).toFixed(3)}%
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Asymptotic Ratio (GCI_23 / (r^p · GCI_12))</span>
                  <div className="text-xl font-mono font-bold text-amber-400 mt-1">
                    {studyResult.asymptoticRangeRatio.toFixed(3)}
                  </div>
                  <span className="text-[10px] text-slate-500">Should be approximately 1.0</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500">
              Run a grid convergence study first to view the Roache GCI analysis.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Gate 247 */}
      {activeTab === 'GATE' && (
        <div className="space-y-6">
          {!gateResult && !isRunning && (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-slate-300 font-bold">Verification Pending</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                Execute Gate 247 to verify that spatial discretization order and Richardson extrapolation satisfy strict ASME standards.
              </p>
              <button
                onClick={handleRunConvergenceStudy}
                className="mt-4 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition"
              >
                Run Gate 247
              </button>
            </div>
          )}

          {gateResult && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <div className={`p-6 rounded-2xl border ${gateResult.overallVerdict === 'PASS' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Gate Verdict</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${gateResult.overallVerdict === 'PASS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {gateResult.overallVerdict}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {gateResult.overallVerdict === 'PASS' ? <ShieldCheck className="w-10 h-10 text-emerald-400" /> : <XCircle className="w-10 h-10 text-rose-400" />}
                    <div>
                      <div className="text-2xl font-black text-white">
                        {gateResult.testReports.filter(r => r.success).length} / {gateResult.testReports.length}
                      </div>
                      <div className="text-xs text-slate-400">Criteria Satisfied</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Verification Battery</h3>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {gateResult.testReports.map((test, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTest(test)}
                        className={`w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors ${selectedTest === test ? 'bg-amber-600/10 border-l-2 border-amber-500' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {test.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                          <span className={`text-sm font-bold ${selectedTest === test ? 'text-amber-400' : 'text-slate-300'}`}>{test.name}</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-600 ${selectedTest === test ? 'text-amber-500' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-8">
                <AnimatePresence mode="wait">
                  {selectedTest && (
                    <motion.div
                      key={selectedTest.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-600/20 rounded-lg">
                              <Grid className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">{selectedTest.name}</h3>
                              <p className="text-xs text-slate-500">Mesh Independence Gate</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${selectedTest.success ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/20 border-rose-500/30 text-rose-400'}`}>
                            {selectedTest.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            <span className="font-bold text-sm tracking-wide">{selectedTest.success ? 'SUCCESS' : 'FAILED'}</span>
                          </div>
                        </div>

                        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                          <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
                            <Database className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technical Evidence</span>
                          </div>
                          <pre className="p-4 text-[11px] font-mono text-amber-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(selectedTest.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Theory */}
      {activeTab === 'THEORY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Grid className="w-4 h-4" /> Richardson Extrapolation
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {"φ_extrap = φ_1 + (φ_1 - φ_2) / (r_21^p - 1)"}
              <br className="my-1" />
              Extrapolates the discrete solutions to the theoretical zero-spacing continuum limit (h → 0).
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Roache GCI Formulation
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {"GCI_fine = (F_s · |e_21|) / (r_21^p - 1)"}
              <br className="my-1" />
              Provides a 95% confidence interval on spatial discretization uncertainty using standard factor of safety F_s = 1.25.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
