import React, { useState } from 'react';
import { TestRunnerEngine, TestSuiteReport } from '../engine/testRunner';
import { Play, CheckCircle, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export const TestRunnerPanel: React.FC = () => {
  const [report, setReport] = useState<TestSuiteReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await TestRunnerEngine.runAllTests();
      setReport(res);
    } catch (err) {
      console.error('Test run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
            SECP Automated Test Suite (Patches 001 - 008)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Executes unit & integration regression checks for geometry kernel, units, parametric solver, feature tree & assembly engine.
          </p>
        </div>
        <button
          id="btn-run-tests"
          onClick={handleRunTests}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Executing Tests...' : 'Run Test Suite'}
        </button>
      </div>

      {!report && !isRunning && (
        <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          Click <span className="text-indigo-400 font-semibold">Run Test Suite</span> to run live regression checks across all SECP core patches.
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-lg text-center">
              <span className="text-xs text-slate-400 block uppercase font-medium">Total Run</span>
              <span className="text-xl font-bold text-slate-100">{report.total}</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-lg text-center">
              <span className="text-xs text-emerald-400 block uppercase font-medium">Passed</span>
              <span className="text-xl font-bold text-emerald-400">{report.passedCount}</span>
            </div>
            <div className="bg-rose-950/40 border border-rose-800/40 p-3 rounded-lg text-center">
              <span className="text-xs text-rose-400 block uppercase font-medium">Failed</span>
              <span className="text-xl font-bold text-rose-400">{report.failedCount}</span>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {report.results.map((r, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex items-start justify-between gap-3 text-xs ${
                  r.passed
                    ? 'bg-slate-800/40 border-emerald-900/50 text-slate-200'
                    : 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {r.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded text-[10px]">
                        {r.patchId}
                      </span>
                      {r.testName}
                    </div>
                    <div className="text-slate-400 mt-1">{r.message}</div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
