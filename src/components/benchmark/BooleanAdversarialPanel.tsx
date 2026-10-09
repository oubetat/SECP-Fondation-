import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RefreshCw, 
  Activity, 
  Box, 
  Layers, 
  Sliders, 
  Database, 
  Zap, 
  Grid, 
  TrendingUp,
  AlertTriangle,
  Award,
  Binary,
  Cpu
} from 'lucide-react';
import { HardAcceptanceGate172, HardGate172Report } from '../../engine/benchmark/boolean/HardAcceptanceGate172';
import { BooleanAdversarialBattery } from '../../engine/benchmark/boolean/BooleanAdversarialBattery';
import { AdversarialBatteryReport } from '../../engine/benchmark/boolean/types';

export const BooleanAdversarialPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CATEGORIES' | 'MUTATIONS' | 'GATE172'>('OVERVIEW');
  const [isRunning, setIsRunning] = useState(false);
  const [batteryReport, setBatteryReport] = useState<AdversarialBatteryReport | null>(null);
  const [gateReport, setGateReport] = useState<HardGate172Report | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const handleRunBattery = () => {
    setIsRunning(true);
    setFeedback('Running Boolean Adversarial Stress Test across all 8 Categories (A through H)...');

    setTimeout(() => {
      try {
        const report = BooleanAdversarialBattery.runAll();
        setBatteryReport(report);
        setFeedback(`Battery complete! Executed ${report.totalExecuted} adversarial test cases (${report.passedCount} Passed, ${report.failedCount} Failed) in ${report.totalDurationMs.toFixed(1)} ms.`);
      } catch (err: any) {
        setFeedback(`Battery Execution error: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }, 250);
  };

  const handleRunGate172 = () => {
    setIsRunning(true);
    setFeedback('Evaluating Hard Acceptance Gate 172 invariants...');

    setTimeout(() => {
      try {
        const report = HardAcceptanceGate172.evaluate();
        setGateReport(report);
        if (!batteryReport) {
          setBatteryReport(report.batteryReport);
        }
        setActiveTab('GATE172');
        setFeedback(`Gate 172 evaluated: ${report.allPassed ? 'PASSED (100%)' : 'FAILED'} (${report.checks.filter(c => c.passed).length}/${report.checks.length} assertions passed).`);
      } catch (err: any) {
        setFeedback(`Gate 172 evaluation error: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }, 200);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <h2 className="text-xl font-bold tracking-tight">Boolean Adversarial Battery & Gate 172</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-rose-950 text-rose-400 border border-rose-800 rounded-full">
              PATCH-SECP-172
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stress-test CAD Boolean kernel against non-manifold boundaries, co-planar faces, tangencies, degenerate vertices, and randomized mutations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate172}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            RUN GATE 172
          </button>
          <button
            onClick={handleRunBattery}
            disabled={isRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Running Battery...' : 'Run Adversarial Battery'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sliders className="w-3.5 h-3.5" /> Battery Summary
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'CATEGORIES' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Layers className="w-3.5 h-3.5" /> 8 Category Breakdown
        </button>
        <button
          onClick={() => setActiveTab('MUTATIONS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'MUTATIONS' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Zap className="w-3.5 h-3.5" /> Mutation & Robustness
        </button>
        <button
          onClick={() => setActiveTab('GATE172')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'GATE172' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Acceptance Gate 172
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {batteryReport ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Passed Test Cases</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> {batteryReport.passedCount} / {batteryReport.totalExecuted}
                </div>
                <span className="text-[10px] text-slate-500">{(batteryReport.overallPassRate * 100).toFixed(1)}% Pass Rate</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Determinism Score</span>
                <div className="text-2xl font-mono font-bold text-sky-400">
                  {(batteryReport.determinismScore * 100).toFixed(1)}%
                </div>
                <span className="text-[10px] text-slate-500">{batteryReport.nonDeterministicCount} Non-Deterministic Cases</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total Execution Duration</span>
                <div className="text-2xl font-mono font-bold text-amber-400">
                  {batteryReport.totalDurationMs.toFixed(1)} ms
                </div>
                <span className="text-[10px] text-slate-500">Avg {batteryReport.avgDurationMsPerCase.toFixed(2)} ms / test case</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Final Qualification Verdict</span>
                <div className="text-lg font-bold font-mono text-rose-400 mt-1">
                  {batteryReport.overallVerdict}
                </div>
                <span className="text-[10px] text-slate-500">CAD Kernel Integrity Seal</span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Click 'Run Adversarial Battery' to evaluate all 8 categories of Boolean CAD stress tests.
            </div>
          )}
        </div>
      )}

      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4">
          {batteryReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(batteryReport.categoryBreakdown).map(([catKey, cat]) => (
                <div key={catKey} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-rose-400 font-mono">{catKey}</span>
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                      {cat.passed} / {cat.total} Passed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Failed: <span className="font-mono text-rose-400">{cat.failed}</span></div>
                    <div>Invalid: <span className="font-mono text-amber-400">{cat.invalid}</span></div>
                    <div>Avg Time: <span className="font-mono text-sky-400">{cat.avgDurationMs.toFixed(2)} ms</span></div>
                    <div>Skipped: <span className="font-mono text-slate-400">{cat.skipped}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Run the battery to view category-level pass/fail statistics.
            </div>
          )}
        </div>
      )}

      {activeTab === 'MUTATIONS' && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Adversarial Mutation Engine</h3>
          <p className="text-xs text-slate-400">
            Fuzzes input CAD boundaries, perturbs face orientations by micro-angles, and verifies kernel rejection of invalid topology.
          </p>
          {batteryReport && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300">
              <div>Total Evidence Ledger Records: {batteryReport.evidenceLedger.length}</div>
              <div>Non-Deterministic Anomaly Count: {batteryReport.nonDeterministicCount}</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'GATE172' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Hard Acceptance Gate 172 Test Battery
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Verifies bit-exact determinism, mandatory category coverage (A-H), mutation rejection, & Evidence Bus logging.
              </p>
            </div>
            <button
              onClick={handleRunGate172}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition"
            >
              Re-run Gate 172
            </button>
          </div>

          {gateReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gateReport.checks.map((r) => (
                <div
                  key={r.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${r.passed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}
                >
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{r.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${r.passed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'}`}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">{r.details}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Click 'RUN GATE 172' to execute the formal verification suite.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

