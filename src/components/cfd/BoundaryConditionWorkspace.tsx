/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-245 — Boundary Condition Workspace
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  ShieldCheck, 
  Database, 
  ChevronRight, 
  AlertTriangle, 
  Layers, 
  Zap, 
  Sliders, 
  Boxes,
  Cpu,
  RefreshCw,
  Plus,
  Trash2
} from 'lucide-react';
import { HardAcceptanceGate245, GateResult245 } from '../../engine/cfd3d/boundary/HardAcceptanceGate245';

interface BoundaryPatch {
  id: string;
  name: string;
  type: 'VELOCITY_INLET' | 'PRESSURE_OUTLET' | 'NO_SLIP_WALL' | 'MOVING_WALL' | 'SYMMETRY';
  velocity?: number;
  pressure?: number;
  temperature?: number;
  heatFlux?: number;
  wallSpeed?: number;
}

export const BoundaryConditionWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'INTERACTIVE' | 'GATE' | 'THEORY'>('INTERACTIVE');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<GateResult245 | null>(null);
  const [selectedTest, setSelectedTest] = useState<any>(null);

  // Interactive Boundary Patch List
  const [patches, setPatches] = useState<BoundaryPatch[]>([
    { id: 'patch-1', name: 'Inlet_Main', type: 'VELOCITY_INLET', velocity: 3.5, temperature: 293.15 },
    { id: 'patch-2', name: 'Outlet_Free', type: 'PRESSURE_OUTLET', pressure: 0 },
    { id: 'patch-3', name: 'Wall_Top_Moving', type: 'MOVING_WALL', wallSpeed: 1.0 },
    { id: 'patch-4', name: 'Wall_Bottom_Heated', type: 'NO_SLIP_WALL', heatFlux: 2500 }
  ]);
  const [selectedPatchId, setSelectedPatchId] = useState<string>('patch-1');

  const selectedPatch = patches.find((p) => p.id === selectedPatchId) || patches[0];

  const updatePatch = (updated: Partial<BoundaryPatch>) => {
    setPatches((prev) =>
      prev.map((p) => (p.id === selectedPatchId ? { ...p, ...updated } : p))
    );
  };

  const handleLoadDemo = () => {
    setPatches([
      { id: 'p1', name: 'Duct_Inlet', type: 'VELOCITY_INLET', velocity: 5.0, temperature: 300.0 },
      { id: 'p2', name: 'Duct_Outlet', type: 'PRESSURE_OUTLET', pressure: 0.0 },
      { id: 'p3', name: 'Heated_Bottom_Wall', type: 'NO_SLIP_WALL', heatFlux: 3000.0 },
      { id: 'p4', name: 'Top_Symmetry_Plane', type: 'SYMMETRY' }
    ]);
    setSelectedPatchId('p1');
    handleRunGate();
  };

  const handleRunGate = () => {
    setIsRunning(true);
    setTimeout(() => {
      const suiteResult = HardAcceptanceGate245.runSuite();
      setResult(suiteResult);
      setSelectedTest(suiteResult.testReports[0]);
      setIsRunning(false);
    }, 400);
  };

  return (
    <div className="space-y-6 text-slate-100 p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              PATCH-SECP-245
            </span>
            <span className="text-xs text-slate-400 font-mono">CFD Boundary System</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-2.5">
            <LayoutGrid className="w-6 h-6 text-blue-400" />
            General CFD Boundary Conditions & Wall Functions
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Dirichlet and Neumann boundary conditions, Launder-Spalding log-law wall functions ($y^+$ calculations), conjugate thermal interface flux continuity, and moving mesh walls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadDemo}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 flex items-center gap-2"
          >
            <Boxes className="w-4 h-4 text-cyan-400" />
            Load Demo Boundaries
          </button>
          <button
            onClick={handleRunGate}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Evaluating Boundaries...' : 'Run Gate 245'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('INTERACTIVE')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'INTERACTIVE'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Interactive Patch Editor
        </button>
        <button
          onClick={() => setActiveTab('GATE')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'GATE'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Hard Acceptance Gate 245
        </button>
        <button
          onClick={() => setActiveTab('THEORY')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'THEORY'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Wall Functions & Log-Law
        </button>
      </div>

      {/* Tab 1: Interactive Editor */}
      {activeTab === 'INTERACTIVE' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Patch List */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Domain Boundary Patches
                </h3>
                <span className="text-xs font-mono text-blue-400 font-bold">{patches.length} Patches</span>
              </div>

              <div className="space-y-2">
                {patches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatchId(p.id)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      selectedPatchId === p.id
                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{p.name}</div>
                      <span className="text-[10px] text-slate-500 font-mono">{p.type}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Patch Configurator */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {selectedPatch && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-blue-400 font-bold">{selectedPatch.id}</span>
                    <h3 className="text-base font-bold text-white mt-0.5">{selectedPatch.name} Configuration</h3>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-xl">
                    {selectedPatch.type}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400">Patch Name</label>
                    <input
                      type="text"
                      value={selectedPatch.name}
                      onChange={(e) => updatePatch({ name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 mt-1 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Condition Type</label>
                    <select
                      value={selectedPatch.type}
                      onChange={(e) => updatePatch({ type: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 focus:border-blue-500 outline-none"
                    >
                      <option value="VELOCITY_INLET">Velocity Inlet (Dirichlet u, Neumann p)</option>
                      <option value="PRESSURE_OUTLET">Pressure Outlet (Dirichlet p=0, Neumann u)</option>
                      <option value="NO_SLIP_WALL">No-Slip Wall (u=0, Log-Law Wall Functions)</option>
                      <option value="MOVING_WALL">Moving Wall (Couette Flow u=U_w)</option>
                      <option value="SYMMETRY">Symmetry Plane (Zero Normal Gradient)</option>
                    </select>
                  </div>
                </div>

                {/* Specific controls */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Physical Quantities</h4>
                  
                  {selectedPatch.type === 'VELOCITY_INLET' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400">Inlet Velocity Magnitude (m/s)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedPatch.velocity || 1.0}
                          onChange={(e) => updatePatch({ velocity: parseFloat(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-400 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Temperature (K)</label>
                        <input
                          type="number"
                          step="1"
                          value={selectedPatch.temperature || 300}
                          onChange={(e) => updatePatch({ temperature: parseFloat(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-amber-400 mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPatch.type === 'PRESSURE_OUTLET' && (
                    <div>
                      <label className="text-xs text-slate-400">Gauge Static Pressure (Pa)</label>
                      <input
                        type="number"
                        value={selectedPatch.pressure || 0}
                        onChange={(e) => updatePatch({ pressure: parseFloat(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-emerald-400 mt-1"
                      />
                    </div>
                  )}

                  {selectedPatch.type === 'NO_SLIP_WALL' && (
                    <div>
                      <label className="text-xs text-slate-400">Wall Heat Flux (W/m² - positive into fluid)</label>
                      <input
                        type="number"
                        step="100"
                        value={selectedPatch.heatFlux || 0}
                        onChange={(e) => updatePatch({ heatFlux: parseFloat(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-rose-400 mt-1"
                      />
                    </div>
                  )}

                  {selectedPatch.type === 'MOVING_WALL' && (
                    <div>
                      <label className="text-xs text-slate-400">Wall Translation Velocity (m/s)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedPatch.wallSpeed || 1.0}
                        onChange={(e) => updatePatch({ wallSpeed: parseFloat(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-400 mt-1"
                      />
                    </div>
                  )}

                  {selectedPatch.type === 'SYMMETRY' && (
                    <p className="text-xs text-slate-400">
                      Zero normal velocity ($u_n = 0$) and zero normal gradients ($\partial \phi / \partial n = 0$) are applied automatically.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Gate 245 */}
      {activeTab === 'GATE' && (
        <div className="space-y-6">
          {!result && !isRunning && (
            <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-slate-300 font-bold">Verification Pending</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                Execute Gate 245 to certify that boundary conditions are strictly assembled into the matrix linear system without analytical shortcuts.
              </p>
              <button
                onClick={handleRunGate}
                className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition"
              >
                Run Gate 245
              </button>
            </div>
          )}

          {result && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <div className={`p-6 rounded-2xl border ${result.overallVerdict === 'PASS' ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Gate Verdict</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${result.overallVerdict === 'PASS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {result.overallVerdict}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {result.overallVerdict === 'PASS' ? <ShieldCheck className="w-10 h-10 text-emerald-400" /> : <XCircle className="w-10 h-10 text-rose-400" />}
                    <div>
                      <div className="text-2xl font-black text-white">
                        {result.testReports.filter(r => r.success).length} / {result.testReports.length}
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
                    {result.testReports.map((test, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTest(test)}
                        className={`w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors ${selectedTest === test ? 'bg-blue-600/10 border-l-2 border-blue-500' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {test.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                          <span className={`text-sm font-bold ${selectedTest === test ? 'text-blue-400' : 'text-slate-300'}`}>{test.name}</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-600 ${selectedTest === test ? 'text-blue-500' : ''}`} />
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
                            <div className="p-2 bg-blue-600/20 rounded-lg">
                              <LayoutGrid className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">{selectedTest.name}</h3>
                              <p className="text-xs text-slate-500">Boundary System Verification Gate</p>
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
                          <pre className="p-4 text-[11px] font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">
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

      {/* Tab 3: Theory */}
      {activeTab === 'THEORY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Dirichlet vs Neumann Flux Assembly
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dirichlet boundaries fix values directly on boundary faces, modifying source term $S_P$ and diagonal entry $a_P$. Neumann boundaries prescribe exact flux derivatives $(\partial \phi / \partial n)_b = q_b$, injected directly into the rhs load vector.
            </p>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Logarithmic Wall Law
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {"u^+ = (1 / κ) · ln(E · y^+)  (y^+ > 11.225)"}
              <br className="my-1" />
              Seamlessly blends the viscous sublayer (u^+ = y^+) with the turbulent logarithmic region to compute wall shear stress τ_w without fine-mesh sublayer resolution.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
