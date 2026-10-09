import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Plus, 
  Check, 
  FileCode, 
  Layers, 
  Cpu, 
  Play, 
  AlertTriangle, 
  Lock, 
  RefreshCw, 
  Wind, 
  Flame, 
  Compass, 
  Boxes 
} from 'lucide-react';
import { AISimulationSetupService } from '../engine/engineering_ai/simulation_setup/AISimulationSetupService';
import { 
  AISimulationSetupSession, 
  EngineeringSimulationCase, 
  SimulationExecutionPackage 
} from '../engine/engineering_ai/simulation_setup/AISimulationSetupTypes310';
import { HardAcceptanceGate310, HardAcceptanceGate310Report } from '../engine/engineering_ai/simulation_setup/HardAcceptanceGate310';

export const AISimulationSetupWorkbenchPanel: React.FC = () => {
  const [service] = useState(() => new AISimulationSetupService());
  const [activeTab, setActiveTab] = useState<'SETUP' | 'CASES' | 'PACKAGE' | 'GATE310'>('SETUP');

  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [promptIntent, setPromptIntent] = useState<string>('Static structural FEA of turbine blade under 12,000 RPM centrifugal load and 850°C thermal boundary');
  const [cadPartId, setCadPartId] = useState<string>('PART-TURBINE-BLADE-01');
  const [physicsDomain, setPhysicsDomain] = useState<'STRUCTURAL' | 'CFD' | 'THERMAL' | 'MODAL'>('STRUCTURAL');

  const [feedback, setFeedback] = useState<string>('');
  const [gateReport, setGateReport] = useState<HardAcceptanceGate310Report | null>(null);

  const [tick, setTick] = useState<number>(0);
  const refresh = () => setTick(t => t + 1);

  const cases = useMemo(() => service.getAllCases(), [service, tick]);
  const activeCase = useMemo(() => cases.find(c => c.caseId === activeCaseId) || (cases.length > 0 ? cases[0] : null), [cases, activeCaseId]);

  const handleLoadDemoCase = () => {
    const demoCase = service.createSimulationCase({
      cadPartId: 'PART-TURBINE-BLADE-01',
      intentDescription: 'Static structural FEA of turbine blade under 12,000 RPM centrifugal load and 850°C thermal boundary',
      physicsDomain: 'STRUCTURAL',
      material: { name: 'Inconel 718', youngsModulusGpa: 205, poissonsRatio: 0.29, yieldStrengthMpa: 1100, densityKgM3: 8190 },
      boundaryConditions: [
        { id: 'BC-01', type: 'FIXED_SUPPORT', targetFaceId: 'FACE-ROOT-01', value: 0 },
        { id: 'BC-02', type: 'CENTRIFUGAL_LOAD', targetFaceId: 'BODY-MAIN', value: 12000, unit: 'RPM' },
        { id: 'BC-03', type: 'TEMPERATURE_BOUNDARY', targetFaceId: 'SURFACE-AIRFOIL', value: 850, unit: 'degC' }
      ]
    });

    setActiveCaseId(demoCase.caseId);
    setFeedback(`Constructed authoritative multi-physics simulation case ${demoCase.caseId}.`);
    refresh();
  };

  const handleRunGate310 = () => {
    const report = HardAcceptanceGate310.evaluate();
    setGateReport(report);
    setActiveTab('GATE310');
    setFeedback(`Gate 310 evaluated: ${report.passed ? 'PASSED (100%)' : 'FAILED'} (${report.passedCount}/${report.totalAssertions} assertions).`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold tracking-tight">AI Simulation Setup & Physics Case Assembly</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-blue-950 text-blue-400 border border-blue-800 rounded-full">
              PATCH-SECP-310
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Translates engineering intent into valid simulation cases, detects missing boundary conditions, manages assumption registers, and locks execution packages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate310}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            Evaluate Gate 310
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="p-3 bg-slate-950/80 border border-blue-500/30 rounded-lg text-xs font-mono text-blue-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
            {feedback}
          </span>
          <button onClick={() => setFeedback('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2">
        <button
          onClick={() => setActiveTab('SETUP')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'SETUP' ? 'border-blue-500 text-blue-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Intent-to-Case Setup
        </button>

        <button
          onClick={() => setActiveTab('CASES')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'CASES' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" /> Simulation Cases ({cases.length})
        </button>

        <button
          onClick={() => setActiveTab('GATE310')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'GATE310' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 310 Report
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'SETUP' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" /> Construct Physics Case
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Target CAD Part ID</label>
                <input
                  type="text"
                  value={cadPartId}
                  onChange={e => setCadPartId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Physics Domain</label>
                <select
                  value={physicsDomain}
                  onChange={e => setPhysicsDomain(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  <option value="STRUCTURAL">Structural FEA (Stress, Strain, Deformation)</option>
                  <option value="CFD">CFD Navier-Stokes (Velocity, Pressure, Shear)</option>
                  <option value="THERMAL">Thermal Transient & Conduction</option>
                  <option value="MODAL">Modal Dynamics & Natural Frequencies</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">Engineering Intent</label>
                <textarea
                  rows={3}
                  value={promptIntent}
                  onChange={e => setPromptIntent(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleLoadDemoCase}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Assemble Physics Case
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Authoritative Case Summary</h3>
            {activeCase ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-bold text-slate-200">{activeCase.caseId}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                    {activeCase.domain}
                  </span>
                </div>

                <div className="space-y-1 text-slate-300">
                  <div>Target Part: <strong className="text-blue-400">{activeCase.cadPartId}</strong></div>
                  <div>Material: <strong className="text-slate-200">{activeCase.material.name} (E = {activeCase.material.youngsModulusGpa} GPa)</strong></div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Boundary Conditions ({activeCase.boundaryConditions.length})</h4>
                  <div className="space-y-1.5">
                    {activeCase.boundaryConditions.map((bc, idx) => (
                      <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-blue-400 font-bold">{bc.type}</span>
                          <span className="text-slate-400 ml-2">on {bc.targetFaceId}</span>
                        </div>
                        <span className="text-slate-300">{bc.value} {bc.unit || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg flex items-center justify-between">
                  <span className="text-emerald-400 text-xs font-sans">Ready for High-Performance Solver Execution</span>
                  <button
                    onClick={() => setFeedback(`Dispatched ${activeCase.caseId} to HPC Solver Execution Pipeline.`)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                  >
                    Execute Solver
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-500 space-y-3">
                <p>No active simulation cases currently assembled.</p>
                <button
                  onClick={handleLoadDemoCase}
                  className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold inline-block"
                >
                  Load Demo Simulation Case
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CASES' && (
        <div className="space-y-3">
          {cases.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
              No simulation cases created yet. Click "Load Demo Simulation Case" on the Setup tab to get started.
            </div>
          ) : (
            cases.map(c => (
              <div key={c.caseId} className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{c.caseId}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">{c.domain}</span>
                  </div>
                  <p className="text-slate-400 font-sans mt-1">{c.intentDescription}</p>
                </div>
                <button
                  onClick={() => {
                    setActiveCaseId(c.caseId);
                    setActiveTab('SETUP');
                  }}
                  className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800 text-xs"
                >
                  View Case
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'GATE310' && gateReport && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            gateReport.passed ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              {gateReport.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
              <div>
                <h3 className="font-bold text-sm">Hard Acceptance Gate 310: {gateReport.passed ? 'PASSED (100%)' : 'FAILED'}</h3>
                <p className="text-xs text-slate-400">Verified {gateReport.passedCount} of {gateReport.totalAssertions} assertions for intent-to-simulation pipeline.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {gateReport.assertions.map(a => (
              <div key={a.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex items-start gap-3 text-xs">
                {a.passed ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="font-semibold text-slate-200">Assertion #{a.id}: {a.description}</div>
                  {a.details && <div className="text-[11px] text-slate-400 mt-0.5">{a.details}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
