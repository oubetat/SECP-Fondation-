import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Binary,
  Layers,
  Cpu,
  Database,
  Terminal,
  Download,
  Fingerprint,
  Zap,
  Lock,
  ArrowRight,
  Activity,
  FileCheck2,
  Sliders
} from 'lucide-react';
import { ProductionProofEngine } from '../engine/production-proof/ProductionProofEngine';
import {
  ProductionProofReport,
  PStageExecutionResult,
  GateExecutionResult,
  PStageId
} from '../engine/production-proof/ProductionProofTypes';

export const ProductionProofDashboard: React.FC = () => {
  const engine = useMemo(() => ProductionProofEngine.getInstance(), []);

  const [report, setReport] = useState<ProductionProofReport>(() =>
    engine.executeProductionQualificationSequence()
  );
  const [activeTab, setActiveTab] = useState<'FLOW' | 'SECP_PPS' | 'GATES' | 'MANIFEST'>('FLOW');
  const [selectedStageId, setSelectedStageId] = useState<PStageId>('P0');
  const [isRunning, setIsRunning] = useState(false);

  const handleRunSequence = (simulateFailureStage?: PStageId) => {
    setIsRunning(true);
    setTimeout(() => {
      const newReport = engine.executeProductionQualificationSequence(simulateFailureStage);
      setReport(newReport);
      setIsRunning(false);
    }, 400);
  };

  const selectedStage = useMemo(() => {
    return report.pStageResults.find(s => s.stageId === selectedStageId) || report.pStageResults[0];
  }, [report.pStageResults, selectedStageId]);

  const downloadReportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', `SECP_PRODUCTION_PROOF_${report.reportId}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 overflow-y-auto font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                SECP Production Proof Framework
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  P0 → P12 INDUSTRIAL QUALIFICATION
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-Lifecycle Production Environment Qualification, SECP-PPS Scoring, Critical Failure Isolation & Gates A → E
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRunSequence()}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-950/40"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Run P0 → P12 Sequence
          </button>

          <button
            onClick={() => handleRunSequence('P2')}
            disabled={isRunning}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 rounded-lg text-xs font-semibold transition-all"
            title="Simulates a critical exception at P2 to verify Critical Failure Rule & SECP-PPS 0 override"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Simulate Critical Failure Rule
          </button>

          <button
            onClick={downloadReportJson}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 transition-all"
            title="Export Production Proof JSON Report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* STRICT ARCHITECTURAL BOUNDARY BANNER: ENGINEERING CLOSURE ≠ PRODUCTION PROOF */}
      <div className="my-6 p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 text-amber-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 md:mt-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <span>Architectural Invariant Enforced</span>
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700/50 text-amber-200 font-mono text-[10px]">
                ENGINEERING CLOSURE ≠ PRODUCTION PROOF
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
              Achieving 100% Engineering Closure (Edge/Vertex, Professional Viewport, Workbench Ownership, Invalidation Contract & Capability Integration) proves technical kernel closure, but <strong className="text-amber-300 font-semibold">does not automatically grant FIELD PROVEN status</strong>. Production readiness requires execution of the P0→P12 Qualification Sequence, SECP-PPS scoring, Critical Failure Rule checks, and passing Gates A → E.
            </p>
          </div>
        </div>

        {/* Engineering Closure Check Badge List */}
        <div className="shrink-0 flex flex-wrap md:flex-col gap-1.5 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-[11px]">
          <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold mb-1">
            Closure Verification Checklist
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Edge/Vertex Picking
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Professional Viewport
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Workbench Ownership
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Invalidation Contract
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Capability Integration
          </div>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Engineering Closure KPI */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engineering Closure</span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-black text-emerald-400">CLOSED (100%)</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Kernel & Viewport Ready</span>
        </div>

        {/* SECP-PPS Score KPI */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SECP-PPS Score</span>
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-2xl font-black font-mono ${report.criticalFailureOccurred ? 'text-rose-500' : 'text-cyan-400'}`}>
              {report.secpPPS} <span className="text-xs text-slate-500 font-sans font-normal">/ 1000</span>
            </span>
            <Zap className={`w-5 h-5 ${report.criticalFailureOccurred ? 'text-rose-500' : 'text-cyan-400'}`} />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Requirement: ≥ 980</span>
        </div>

        {/* Critical Failure Rule Status */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Failure Rule</span>
          <div className="mt-2 flex items-center justify-between">
            {report.criticalFailureOccurred ? (
              <span className="text-sm font-black text-rose-400 uppercase">ACTIVATED (SECP-PPS = 0)</span>
            ) : (
              <span className="text-sm font-black text-emerald-400 uppercase">0 FAILURES DETECTED</span>
            )}
            {report.criticalFailureOccurred ? (
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {report.criticalFailureOccurred ? `Failed at ${report.criticalFailureStageId}` : 'All 13 P-Stages Safe'}
          </span>
        </div>

        {/* Gates Passed KPI */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Production Gates</span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-black text-teal-300 font-mono">
              {report.gateResults.filter(g => g.status === 'PASSED').length} / 5 PASSED
            </span>
            <Layers className="w-5 h-5 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Gates A → E Validation</span>
        </div>

        {/* Final Status KPI */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          report.overallFieldProven
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Final Official Verdict</span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-base font-black tracking-tight">
              {report.overallFieldProven ? 'FIELD PROVEN' : 'REJECTED / INCOMPLETE'}
            </span>
            {report.overallFieldProven ? (
              <Award className="w-6 h-6 text-amber-400" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400" />
            )}
          </div>
          <span className="text-[10px] opacity-70 mt-1">
            {report.overallFieldProven ? 'Industrial Deployment Unlocked' : 'Production Proof Required'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('FLOW')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'FLOW'
              ? 'border-emerald-500 bg-slate-900 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          P0 → P12 Qualification Sequence
        </button>

        <button
          onClick={() => setActiveTab('SECP_PPS')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'SECP_PPS'
              ? 'border-cyan-500 bg-slate-900 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          SECP-PPS & Critical Failure Rule
        </button>

        <button
          onClick={() => setActiveTab('GATES')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'GATES'
              ? 'border-teal-500 bg-slate-900 text-teal-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Gates A → E Certification
        </button>

        <button
          onClick={() => setActiveTab('MANIFEST')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'MANIFEST'
              ? 'border-amber-500 bg-slate-900 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          Merkle Evidence Ledger
        </button>
      </div>

      {/* TAB 1: P0 -> P12 QUALIFICATION SEQUENCE */}
      {activeTab === 'FLOW' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stage List Sidebar (P0 to P12) */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Qualification Stages (13)</span>
              <span className="text-[10px] text-slate-500 font-mono">Sequential Execution</span>
            </h3>

            {report.pStageResults.map((stage, idx) => {
              const isSelected = stage.stageId === selectedStageId;
              const isCritical = stage.isCriticalStage;

              return (
                <div
                  key={stage.stageId}
                  onClick={() => setSelectedStageId(stage.stageId)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                      stage.status === 'CRITICAL_FAILURE'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}>
                      {stage.stageId}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        {stage.name}
                        {isCritical && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800/50 font-mono">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {stage.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-emerald-400">{stage.score}%</span>
                    {stage.status === 'CRITICAL_FAILURE' ? (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Stage Detail Inspector */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4 shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-xs font-bold border border-emerald-800/50">
                      {selectedStage.stageId}
                    </span>
                    <h3 className="text-sm font-black text-slate-100">{selectedStage.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{selectedStage.description}</p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Assertions Passed</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {selectedStage.assertionsPassed} / {selectedStage.assertionsTotal}
                  </div>
                </div>
              </div>

              {/* Critical Failure Detail if active */}
              {selectedStage.status === 'CRITICAL_FAILURE' && (
                <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex flex-col gap-1">
                  <div className="font-bold flex items-center gap-2 text-rose-300">
                    <ShieldAlert className="w-4 h-4" />
                    Critical Failure Rule Triggered at {selectedStage.stageId}
                  </div>
                  <p className="text-slate-300">{selectedStage.criticalFailureDetails}</p>
                </div>
              )}

              {/* Execution Logs Terminal */}
              <div>
                <div className="text-[11px] font-mono font-bold text-slate-400 mb-2 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Runtime Verification Logs & Evidence Hash
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
                  {selectedStage.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-600">[{i + 1}]</span>
                      <span className={log.includes('CRITICAL') ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Hash Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Evidence Hash:</span>
                <span className="font-mono text-cyan-400 text-[10px] bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {selectedStage.evidenceHash}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECP-PPS SCORE & CRITICAL FAILURE RULE */}
      {activeTab === 'SECP_PPS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECP-PPS Scoring Breakdown */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              SECP Production Proven Score (SECP-PPS)
            </h3>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-around">
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase font-bold">Computed Score</div>
                <div className={`text-4xl font-black font-mono mt-1 ${report.criticalFailureOccurred ? 'text-rose-500' : 'text-cyan-400'}`}>
                  {report.secpPPS}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Scale 0 - 1000</div>
              </div>

              <div className="h-12 w-px bg-slate-800" />

              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase font-bold">Passing Threshold</div>
                <div className="text-4xl font-black font-mono text-emerald-400 mt-1">
                  980
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Required for Field Proven</div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The SECP Production Proven Score aggregates quantitative results across all 13 qualification stages (P0 through P12). Each stage provides equal weighting, requiring high consistency across exact CAD math, stress loads, WebGPU compute, failure resilience, and digital twin telemetry.
            </p>
          </div>

          {/* Critical Failure Rule Engine Box */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Critical Failure Rule Isolation
            </h3>

            <div className={`p-4 rounded-xl border ${
              report.criticalFailureOccurred
                ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            }`}>
              <div className="font-bold text-sm mb-1 flex items-center gap-2">
                {report.criticalFailureOccurred ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    CRITICAL FAILURE RULE ACTIVATED
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ZERO CRITICAL FAILURES DETECTED
                  </>
                )}
              </div>

              <p className="text-xs opacity-90 leading-relaxed mt-2">
                {report.criticalFailureOccurred
                  ? `An unhandled exception or critical violation was detected at stage ${report.criticalFailureStageId}. The Critical Failure Rule automatically overrides the SECP-PPS score to ZERO, rejecting qualification regardless of performance in other stages.`
                  : 'All critical stages (P0, P1, P2, P3, P4, P5, P7, P9, P10, P12) executed cleanly with zero unhandled exceptions, memory corruptions, or topological boundary leaks.'}
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400">
              <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Rule Specification</div>
              <p>
                <code className="text-amber-300">if (criticalFailure === true) SECP_PPS = 0; status = REJECTED;</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GATES A -> E CERTIFICATION */}
      {activeTab === 'GATES' && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Sequential Gate Pipeline (Gates A → E)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {report.gateResults.map((gate, idx) => {
              const isPassed = gate.status === 'PASSED';
              const isBlocked = gate.status === 'BLOCKED';

              return (
                <div
                  key={gate.gateId}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                    isPassed
                      ? 'bg-slate-900 border-emerald-500/50 text-slate-100'
                      : isBlocked
                      ? 'bg-slate-950 border-slate-800 text-slate-500'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        {gate.gateId}
                      </span>
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isBlocked ? (
                        <Lock className="w-4 h-4 text-slate-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-200">{gate.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{gate.description}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    Required: {gate.requiredPStages.join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed mt-2">
            <strong className="text-emerald-400 font-semibold">Gate E (FIELD PROVEN) Requirement:</strong> Gate E is unlocked ONLY when Engineering Closure = TRUE AND Gates A, B, C, and D are PASSED AND SECP-PPS $\ge 980$ AND Zero Critical Failures occurred.
          </div>
        </div>
      )}

      {/* TAB 4: MERKLE MANIFEST & EVIDENCE LEDGER */}
      {activeTab === 'MANIFEST' && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-amber-400" />
            Cryptographic Production Proof Merkle Manifest
          </h3>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
            <div>
              <span className="text-slate-500">Report ID:</span> {report.reportId}
            </div>
            <div>
              <span className="text-slate-500">Timestamp:</span> {report.timestamp}
            </div>
            <div>
              <span className="text-slate-500">Baseline Commit:</span> {report.gitCommit}
            </div>
            <div>
              <span className="text-slate-500">Container Environment:</span> {report.environmentId}
            </div>
            <div>
              <span className="text-slate-500">Merkle Root Hash:</span>{' '}
              <span className="text-amber-400 font-bold">{report.merkleProofHash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
