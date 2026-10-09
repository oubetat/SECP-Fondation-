import React, { useState, useMemo } from 'react';
import { 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  RefreshCw, 
  Check, 
  RotateCcw, 
  Layers, 
  Cpu, 
  Sliders, 
  FileCheck2, 
  Database, 
  Workflow 
} from 'lucide-react';
import { EngineeringOS } from '../../engine/kernel/EngineeringOS';
import { HardAcceptanceGate190, IntegrationTestReport } from '../../engine/industrial-os/HardAcceptanceGate190';

export const EngineeringOSDashboard: React.FC = () => {
  const [os] = useState(() => EngineeringOS.getInstance());
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'GATE190'>('TELEMETRY');
  
  const [feedback, setFeedback] = useState<string>('');
  const [gateReport, setGateReport] = useState<IntegrationTestReport | null>(null);

  const [tick, setTick] = useState<number>(0);
  const refresh = () => setTick(t => t + 1);

  const systemState = useMemo(() => os.getSystemState(), [os, tick]);

  const handleRunGate190 = () => {
    const report = HardAcceptanceGate190.runIntegrationTestSuite();
    setGateReport(report);
    setActiveTab('GATE190');
    setFeedback(`Hard Acceptance Gate 190 evaluated: ${report.verdict === 'PASS' ? 'PASSED (100%)' : 'FAILED'}.`);
  };

  const handleSystemReset = () => {
    os.resetSystem();
    setFeedback('Authoritative system reset executed. All cross-project caches and singletons purged.');
    refresh();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight">SECP Engineering OS Architecture 2.0 & Kernel Core</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full">
              PATCH-SECP-190
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative Industrial OS Kernel: Canonical Truth Engine, Evidence Bus, Capability Registry, and Invalidation Pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSystemReset}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-medium text-xs rounded-lg transition border border-rose-900/40 flex items-center gap-2 font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Kernel State
          </button>

          <button
            onClick={handleRunGate190}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            Evaluate Gate 190
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-slate-950/80 border border-indigo-500/30 rounded-lg text-xs font-mono text-indigo-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            {feedback}
          </span>
          <button onClick={() => setFeedback('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* 2. Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Authoritative Objects</span>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-0.5">{systemState.truthEngine.length}</div>
          </div>
          <Database className="w-8 h-8 text-indigo-500/20" />
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Compute Accelerators</span>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{systemState.computeResources.length} Active</div>
          </div>
          <Cpu className="w-8 h-8 text-cyan-500/20" />
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Active Transactions</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{systemState.activeTransactions}</div>
          </div>
          <Workflow className="w-8 h-8 text-emerald-500/20" />
        </div>

        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Kernel Status</span>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYNCHRONIZED
            </div>
          </div>
          <Server className="w-8 h-8 text-emerald-500/20" />
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2">
        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'TELEMETRY' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Subsystems & Resources
        </button>

        <button
          onClick={() => setActiveTab('GATE190')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'GATE190' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 190 Report
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Active Compute Accelerators</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {systemState.computeResources.map((res, i) => (
              <div key={i} className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-200">{res.type} Engine</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    ONLINE
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Performance Score: <strong className="text-indigo-400 font-mono">{res.performanceScore}/100</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'GATE190' && gateReport && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            gateReport.verdict === 'PASS' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              {gateReport.verdict === 'PASS' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
              <div>
                <h3 className="font-bold text-sm">Hard Acceptance Gate 190: {gateReport.verdict === 'PASS' ? 'PASSED (100%)' : 'FAILED'}</h3>
                <p className="text-xs text-slate-400">Full lifecycle integration of SECP Engineering OS Kernel 2.0.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {Object.entries(gateReport.checks).map(([key, val], idx) => (
              <div key={idx} className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">{key}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {val ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
