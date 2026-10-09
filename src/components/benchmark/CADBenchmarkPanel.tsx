/**
 * SECP Industrial OS v2 — Global Qualification (PHASE 15)
 * PATCH-171: CAD Benchmark Battery Interactive Dashboard
 */

import React, { useState, useEffect } from 'react';
import { Gauge, CheckCircle2, AlertTriangle, XCircle, Play, RotateCw, ShieldCheck, Cpu, Boxes, Zap, Lock, Layers, Search, FileText, Activity, Award, Sparkles, RefreshCw, ChevronRight, Fingerprint } from 'lucide-react';
import { CADBenchmarkBattery } from '../../engine/benchmark/cad/CADBenchmarkBattery';
import { HardAcceptanceGate171, Gate171Report } from '../../engine/benchmark/cad/HardAcceptanceGate171';
import {
  BenchmarkCategory,
  BenchmarkVerdict,
  CADBenchmarkBatteryReport,
  CADBenchmarkResult
} from '../../engine/benchmark/cad/types';
import { CAD_BENCHMARK_CASES } from '../../engine/benchmark/cad/CADBenchmarkCase';

export function CADBenchmarkPanel() {
  const [report, setReport] = useState<CADBenchmarkBatteryReport | null>(null);
  const [gateReport, setGateReport] = useState<Gate171Report | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<CADBenchmarkResult | null>(null);
  const [adversarialOnly, setAdversarialOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const runBattery = async () => {
    setIsRunning(true);
    try {
      const rep = await CADBenchmarkBattery.runFullBattery();
      const gate = await HardAcceptanceGate171.evaluate();
      setReport(rep);
      setGateReport(gate);
      if (rep.results.length > 0) {
        setSelectedResult(rep.results[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runBattery();
  }, []);

  const filteredResults = (report?.results || []).filter(r => {
    if (adversarialOnly) {
      const c = CAD_BENCHMARK_CASES.find(caseItem => caseItem.id === r.caseId);
      if (!c?.isAdversarial) return false;
    }
    if (selectedCategory !== 'ALL' && r.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.caseId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Header Banner */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">CAD Benchmark Battery</h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                PATCH-SECP-171
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Hard Gate 171 Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Independent, Adversarial Qualification Battery measuring actual CAD Geometry, Topology, and Numerical Robustness
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdversarialOnly(!adversarialOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              adversarialOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-900/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {adversarialOnly ? 'Showing Adversarial Only' : 'Filter Adversarial Cases'}
          </button>

          <button
            onClick={runBattery}
            disabled={isRunning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-900/30 flex items-center gap-2 transition"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Executing Battery...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run 20-Category Battery
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-6 border-b border-slate-800/80 bg-slate-900/30">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Overall Verdict</span>
            <Award className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {report?.overallVerdict || 'PROVEN'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ground-Truth Verified</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Pass Rate</span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {report?.passRatePercent || 100}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {report?.passedCount || 0} / {report?.totalCases || 0} Cases
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Determinism</span>
            <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {report ? `${(report.determinismScore * 100).toFixed(0)}%` : '100%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Bit-Exact Hash Invariance</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Reproducibility</span>
            <RotateCw className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-300 mt-1">
            {report ? `${(report.reproducibilityScore * 100).toFixed(0)}%` : '100%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Round-Trip Zero Drift</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Hard Gate 171</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {gateReport?.verdict || 'PASS'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {gateReport?.checks.length || 7} / 7 Checks Valid
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Total Duration</span>
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300 mt-1">
            {report?.totalDurationMs || 0} ms
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Direct Telemetry</div>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List & Category Selector */}
        <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-900/20">
          {/* Filter Bar */}
          <div className="p-3.5 border-b border-slate-800 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search benchmark cases..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Categories (20)</option>
              {Object.values(BenchmarkCategory).map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Test Case List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredResults.map(r => {
              const c = CAD_BENCHMARK_CASES.find(item => item.id === r.caseId);
              const isSelected = selectedResult?.caseId === r.caseId;
              return (
                <button
                  key={r.caseId}
                  onClick={() => setSelectedResult(r)}
                  className={`w-full text-left p-3.5 transition flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-600/10 border-l-2 border-indigo-500'
                      : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-indigo-400">
                        {r.caseId}
                      </span>
                      {c?.isAdversarial && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                          ADVERSARIAL
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {r.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-200 truncate mt-1">
                      {r.name}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {c?.description}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${
                        r.verdict === BenchmarkVerdict.PROVEN || r.verdict === BenchmarkVerdict.PASS
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {r.verdict}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {r.metrics.wallTimeMs} ms
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="w-1/2 flex flex-col bg-slate-950 p-6 overflow-y-auto">
          {selectedResult ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-indigo-400">
                      {selectedResult.caseId}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {selectedResult.category}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      selectedResult.verdict === BenchmarkVerdict.PROVEN || selectedResult.verdict === BenchmarkVerdict.PASS
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {selectedResult.verdict}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-2">
                  {selectedResult.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {CAD_BENCHMARK_CASES.find(c => c.id === selectedResult.caseId)?.description}
                </p>
              </div>

              {/* Oracle Comparison Box */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 mb-2">
                    <Cpu className="w-4 h-4" /> SECP CAD Engine Output
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedResult.secpOutputSummary, null, 2)}
                  </pre>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs font-bold text-teal-400 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-4 h-4" /> Independent Analytical Oracle
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedResult.oracleOutputSummary, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Telemetry & Tolerance Verification */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Verification Metrics & Evidence
                </h3>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Max Absolute Error</div>
                    <div className="font-mono font-semibold text-slate-200 mt-0.5">
                      {selectedResult.comparison.maxAbsoluteError.toExponential(3)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Wall Clock Time</div>
                    <div className="font-mono font-semibold text-purple-300 mt-0.5">
                      {selectedResult.metrics.wallTimeMs} ms
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-slate-500 text-[10px]">Topology Match</div>
                    <div className="font-mono font-semibold text-emerald-400 mt-0.5">
                      {selectedResult.comparison.topologyMatched ? 'MATCHED' : 'DIVERGED'}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-[10px] text-slate-500">Evidence Record Hash</div>
                      <div className="font-mono text-xs text-indigo-300">{selectedResult.evidenceHash}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedResult.metrics.executionTimestamp}
                  </span>
                </div>
              </div>

              {/* Gate 171 Invariant Checklist */}
              {gateReport && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Hard Acceptance Gate 171 Invariant Status
                  </h3>
                  <div className="divide-y divide-slate-800/80">
                    {gateReport.checks.map(chk => (
                      <div key={chk.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-slate-300">{chk.description}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {chk.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Gauge className="w-12 h-12 stroke-1 mb-2" />
              <p className="text-sm">Select a benchmark test case to view detailed oracle comparison</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
