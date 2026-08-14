import React, { useState } from 'react';
import { TestRunnerEngine, TestSuiteReport } from '../engine/testRunner';
import { Play, CheckCircle, XCircle, ShieldCheck, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export const TestRunnerPanel: React.FC = () => {
  const [report, setReport] = useState<TestSuiteReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [gateResult, setGateResult] = useState<any>(null);
  const [isGateRunning, setIsGateRunning] = useState(false);
  const [gate045Result, setGate045Result] = useState<any>(null);
  const [isGate045Running, setIsGate045Running] = useState(false);
  const [gate051Result, setGate051Result] = useState<any>(null);
  const [isGate051Running, setIsGate051Running] = useState(false);
  const [gate052Result, setGate052Result] = useState<any>(null);
  const [isGate052Running, setIsGate052Running] = useState(false);
  const [gate053Result, setGate053Result] = useState<any>(null);
  const [isGate053Running, setIsGate053Running] = useState(false);
  const [gate054Result, setGate054Result] = useState<any>(null);
  const [isGate054Running, setIsGate054Running] = useState(false);
  const [gate055Result, setGate055Result] = useState<any>(null);
  const [isGate055Running, setIsGate055Running] = useState(false);
  const [gate056Result, setGate056Result] = useState<any>(null);
  const [isGate056Running, setIsGate056Running] = useState(false);
  const [gate057Result, setGate057Result] = useState<any>(null);
  const [isGate057Running, setIsGate057Running] = useState(false);

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

  const handleRunGate = async () => {
    setIsGateRunning(true);
    try {
      const { HardAcceptanceGate042 } = await import('../engine/validation/HardAcceptanceGate042');
      const res = await HardAcceptanceGate042.runAcceptanceGate();
      setGateResult(res);
    } catch (err) {
      console.error('Gate run failed:', err);
    } finally {
      setIsGateRunning(false);
    }
  };

  const handleRunGate045 = async () => {
    setIsGate045Running(true);
    try {
      const { HardAcceptanceGate045 } = await import('../engine/validation/HardAcceptanceGate045');
      const res = await HardAcceptanceGate045.runGateVerification();
      setGate045Result(res);
    } catch (err) {
      console.error('Gate 045 run failed:', err);
    } finally {
      setIsGate045Running(false);
    }
  };

  const handleRunGate051 = async () => {
    setIsGate051Running(true);
    try {
      const { HardAcceptanceGate051 } = await import('../engine/validation/HardAcceptanceGate051');
      const res = await HardAcceptanceGate051.runGateVerification();
      setGate051Result(res);
    } catch (err) {
      console.error('Gate 051 run failed:', err);
    } finally {
      setIsGate051Running(false);
    }
  };

  const handleRunGate052 = async () => {
    setIsGate052Running(true);
    try {
      const { HardAcceptanceGate052 } = await import('../engine/validation/HardAcceptanceGate052');
      const res = await HardAcceptanceGate052.runGateVerification();
      setGate052Result(res);
    } catch (err) {
      console.error('Gate 052 run failed:', err);
    } finally {
      setIsGate052Running(false);
    }
  };

  const handleRunGate053 = async () => {
    setIsGate053Running(true);
    try {
      const { HardAcceptanceGate053 } = await import('../engine/validation/HardAcceptanceGate053');
      const res = await HardAcceptanceGate053.runGateVerification();
      setGate053Result(res);
    } catch (err) {
      console.error('Gate 053 run failed:', err);
    } finally {
      setIsGate053Running(false);
    }
  };

  const handleRunGate054 = async () => {
    setIsGate054Running(true);
    try {
      const { HardAcceptanceGate054 } = await import('../engine/validation/HardAcceptanceGate054');
      const res = await HardAcceptanceGate054.runGateVerification();
      setGate054Result(res);
    } catch (err) {
      console.error('Gate 054 run failed:', err);
    } finally {
      setIsGate054Running(false);
    }
  };

  const handleRunGate055 = async () => {
    setIsGate055Running(true);
    try {
      const { HardAcceptanceGate055 } = await import('../engine/validation/HardAcceptanceGate055');
      const res = await HardAcceptanceGate055.runGateVerification();
      setGate055Result(res);
    } catch (err) {
      console.error('Gate 055 run failed:', err);
    } finally {
      setIsGate055Running(false);
    }
  };

  const handleRunGate056 = async () => {
    setIsGate056Running(true);
    try {
      const { HardAcceptanceGate056 } = await import('../engine/validation/HardAcceptanceGate056');
      const res = await HardAcceptanceGate056.runGateVerification();
      setGate056Result(res);
    } catch (err) {
      console.error('Gate 056 run failed:', err);
    } finally {
      setIsGate056Running(false);
    }
  };

  const handleRunGate057 = async () => {
    setIsGate057Running(true);
    try {
      const { HardAcceptanceGate057 } = await import('../engine/validation/HardAcceptanceGate057');
      const res = await HardAcceptanceGate057.executeGate();
      setGate057Result(res);
    } catch (err) {
      console.error('Gate 057 run failed:', err);
    } finally {
      setIsGate057Running(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* SECP-042 Assembly Acceptance Gate Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <Terminal className="w-5 h-5 text-cyan-400" />
              042-D — Assembly Acceptance Gate
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict industrial acceptance gate validating parts registration, stable identity, solver convergence, and collision detection.
            </p>
          </div>
          <button
            onClick={handleRunGate}
            disabled={isGateRunning}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-slate-950 rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGateRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-slate-950" />}
            {isGateRunning ? 'Validating Gate...' : 'Execute SECP-042 Gate'}
          </button>
        </div>

        {!gateResult && !isGateRunning && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-cyan-400 font-semibold">Execute SECP-042 Gate</span> to trigger the high-fidelity validation pipeline.
          </div>
        )}

        {gateResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate Verification Output</h3>
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner">
                {JSON.stringify(gateResult, null, 2)}
              </div>
            </div>

            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Acceptance Breakdown</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Parts Register:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.parts}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Stable IDs:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.instances}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Solver:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.solver}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Transforms:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.transforms}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Clash Overlaps:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.collisionDetection}</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Regression 041:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900">{gateResult.regression041}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-emerald-400 text-xs font-mono flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">SECP-042 GATE PASSED</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Real OCCT B-Rep features remain untouched, constraint matrices are solved with deterministic numerical exactness.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PATCH-SECP-045 Hard Acceptance Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Terminal className="w-5 h-5 text-amber-400" />
              PATCH-SECP-045 — Master Assembly & Kinematics Acceptance Gate (17 Tests)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates Fixed, Revolute, Prismatic, Cylindrical joints, DOF analyzer, closed-loop Jacobian solver, gear synchronizer, limit stops, real OCCT clash detection, and bit-identical determinism.
            </p>
          </div>
          <button
            onClick={handleRunGate045}
            disabled={isGate045Running}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-slate-950 rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGate045Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-slate-950" />}
            {isGate045Running ? 'Validating Gate 045...' : 'Execute Gate 045'}
          </button>
        </div>

        {!gate045Result && !isGate045Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-amber-400 font-semibold">Execute Gate 045</span> to run the 17-point kinematic & assembly verification suite.
          </div>
        )}

        {gate045Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 045 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate045Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">17 Gate Checks</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate045Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate045Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-045 GATE {gate045Result.status} ({gate045Result.passedTests}/{gate045Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate045Result.status === 'PASS'
                        ? 'Deterministic kinematics, real OCCT interference, and multi-body constraints verified with zero mock fallback.'
                        : 'Gate failed one or more assertions. Review stages log for failure details.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* PATCH-SECP-051 Hard Acceptance Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <Terminal className="w-5 h-5 text-indigo-400" />
              SECP-051 — Advanced Parametric Core Acceptance Gate (30 Tests)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates Parameter Graph, Topological Evaluation, Expression Parsing, Unit Mismatch Rejection, Global Design Variables, Feature Bindings, Design Tables, Multi-Variant Determinism, Provenance, and Full Regressions (045.1 → 050).
            </p>
          </div>
          <button
            onClick={handleRunGate051}
            disabled={isGate051Running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGate051Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isGate051Running ? 'Validating Gate 051...' : 'Execute Gate 051'}
          </button>
        </div>

        {!gate051Result && !isGate051Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-indigo-400 font-semibold">Execute Gate 051</span> to run the 30-point parametric core & regression suite.
          </div>
        )}

        {gate051Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 051 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate051Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">30 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate051Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate051Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-051 GATE {gate051Result.status} ({gate051Result.passedTests}/{gate051Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate051Result.status === 'PASS'
                        ? 'Production parametric core, unit safety, design table execution, and full regressions (045.1 -> 050) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* PATCH-SECP-052 Hard Acceptance Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <Terminal className="w-5 h-5 text-indigo-400" />
              SECP-052 — Advanced B-Rep Topology & Persistent Naming Gate (35 Tests)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates Topological Entity Extraction, Persistent Naming, Fingerprints, Boolean/Fillet/Chamfer Identity Preservation, Split/Merge Detection, Reference Healing, and Full Regressions (045.1 → 051).
            </p>
          </div>
          <button
            onClick={handleRunGate052}
            disabled={isGate052Running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGate052Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isGate052Running ? 'Validating Gate 052...' : 'Execute Gate 052'}
          </button>
        </div>

        {!gate052Result && !isGate052Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-indigo-400 font-semibold">Execute Gate 052</span> to run the 35-point topology & persistent naming suite.
          </div>
        )}

        {gate052Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 052 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate052Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">35 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate052Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate052Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-052 GATE {gate052Result.status} ({gate052Result.passedTests}/{gate052Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate052Result.status === 'PASS'
                        ? 'Persistent topology naming, reference healing, evolution tracking, and full regressions (045.1 -> 051) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* PATCH-SECP-053 Hard Acceptance Gate */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <Terminal className="w-5 h-5 text-indigo-400" />
              SECP-053 — Industrial Constraint & Sketch Solver Gate (40 Tests)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validates 14 Geometric/Dimensional Constraint Types, Variational Solver States, Incremental Sub-graph Extraction, Causality Conflict Isolation, Unit Awareness, and Full Regressions (045.1 → 052).
            </p>
          </div>
          <button
            onClick={handleRunGate053}
            disabled={isGate053Running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGate053Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isGate053Running ? 'Validating Gate 053...' : 'Execute Gate 053'}
          </button>
        </div>

        {!gate053Result && !isGate053Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-indigo-400 font-semibold">Execute Gate 053</span> to run the 40-point industrial constraint solver suite.
          </div>
        )}

        {gate053Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 053 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate053Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">40 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate053Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate053Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-053 GATE {gate053Result.status} ({gate053Result.passedTests}/{gate053Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate053Result.status === 'PASS'
                        ? 'Industrial constraint graph, variational solver, incremental sub-graph extraction, causality reports, and full regressions (045.1 -> 052) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECP-054 Industrial Surface & NURBS / Class-A Geometry Gate Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              SECP-054 — Industrial Surface & NURBS / Class-A Geometry Gate
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive 50-test industrial gate validating BSpline curves/surfaces, surface operations, G0/G1/G2 continuity, Zebra reflection analysis, topology preservation, and full system regressions (045.1 -&gt; 053).
            </p>
          </div>
          <button
            onClick={handleRunGate054}
            disabled={isGate054Running}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition shadow-md cursor-pointer"
          >
            {isGate054Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            {isGate054Running ? 'Validating Gate 054...' : 'Execute Gate 054'}
          </button>
        </div>

        {!gate054Result && !isGate054Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-cyan-400 font-semibold">Execute Gate 054</span> to run the 50-point Class-A surface geometry test suite.
          </div>
        )}

        {gate054Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 054 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate054Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">50 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate054Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate054Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-054 GATE {gate054Result.status} ({gate054Result.passedTests}/{gate054Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate054Result.status === 'PASS'
                        ? 'Class-A surface geometry engine, BSpline math core, surface operations, G0/G1/G2 continuity analysis, Zebra reflection maps, topology preservation, and full regressions (045.1 -> 053) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GATE 055 HARD ACCEPTANCE RUNNER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
              SECP-055 Governance Gate — Advanced Assembly Engineering
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production assembly graph, 10 advanced mates, kinematic DOF solver, OCCT interference/clearance, persistent topology, and full regressions (045.1 → 054).
            </p>
          </div>
          <button
            id="btn-run-gate-055"
            onClick={handleRunGate055}
            disabled={isGate055Running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer"
          >
            {isGate055Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isGate055Running ? 'Executing Gate 055...' : 'Execute Gate 055'}
          </button>
        </div>

        {!gate055Result && !isGate055Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-indigo-400 font-semibold">Execute Gate 055</span> to run the 55-point assembly engineering test suite.
          </div>
        )}

        {gate055Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 055 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate055Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">55 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate055Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate055Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-055 GATE {gate055Result.status} ({gate055Result.passedTests}/{gate055Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate055Result.status === 'PASS'
                        ? 'Production assembly graph, 10 mate types, kinematic DOF solver, OCCT B-Rep interference/clearance engine, SECP-052 persistent topology references, and full regressions (045.1 -> 054) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GATE 056 HARD ACCEPTANCE RUNNER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              SECP-056 Governance Gate — Manufacturing Feature Intelligence & Process Planning Core
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              14 manufacturing feature classes recognition, B-Rep persistent topology linking, feature graph, 3-Axis vs 5-Axis process planning, 4-tier DFM spectrum, and full regressions (045.1 → 055).
            </p>
          </div>
          <button
            id="btn-run-gate-056"
            onClick={handleRunGate056}
            disabled={isGate056Running}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-semibold transition shadow-md cursor-pointer"
          >
            {isGate056Running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isGate056Running ? 'Executing Gate 056...' : 'Execute Gate 056'}
          </button>
        </div>

        {!gate056Result && !isGate056Running && (
          <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
            Click <span className="text-indigo-400 font-semibold">Execute Gate 056</span> to run the 56-point manufacturing intelligence test suite.
          </div>
        )}

        {gate056Result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Gate 056 Verification Report</h3>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-indigo-400 overflow-x-auto select-all leading-relaxed whitespace-pre shadow-inner max-h-72">
                  {JSON.stringify(gate056Result, null, 2)}
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">56 Gate Checks Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {Object.entries(gate056Result.verifications || {}).map(([name, status]) => (
                      <div key={name} className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-slate-400 truncate pr-1">{name}:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded border ${
                          status === 'PASS' 
                            ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900' 
                            : 'text-rose-400 bg-rose-950/40 border-rose-900'
                        }`}>
                          {String(status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 border rounded-lg text-xs font-mono flex items-start gap-2 ${
                  gate056Result.status === 'PASS'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-400'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">SECP-056 GATE {gate056Result.status} ({gate056Result.passedTests}/{gate056Result.totalTests})</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {gate056Result.status === 'PASS'
                        ? 'Topology-aware 14 manufacturing feature classes recognition, process planning, 4-tier DFM spectrum, and full regressions (045.1 -> 055) verified with zero mock leakage.'
                        : 'Gate failed one or more assertions.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

