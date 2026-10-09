import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Fingerprint,
  Download,
  Lock,
  Layers,
  Activity,
  FileCode2,
  ArrowRight,
  GitBranch,
  Terminal,
  Server,
  Zap
} from 'lucide-react';
import { FinalEngineeringClosureForensicAuditEngine } from '../engine/closure-audit/FinalEngineeringClosureForensicAuditEngine';
import {
  FinalEngineeringClosureReport,
  ClosureChainStageId,
  DualTruthCheckId
} from '../engine/closure-audit/FinalEngineeringClosureForensicAuditTypes';

export const FinalEngineeringClosureForensicDashboard: React.FC = () => {
  const engine = useMemo(() => FinalEngineeringClosureForensicAuditEngine.getInstance(), []);

  const [report, setReport] = useState<FinalEngineeringClosureReport>(() =>
    engine.executeForensicAudit()
  );
  const [activeTab, setActiveTab] = useState<'CHAIN' | 'DUAL_TRUTH' | 'MERKLE'>('CHAIN');
  const [selectedStageId, setSelectedStageId] = useState<ClosureChainStageId>(
    'STAGE_01_ENGINEERING_DOCUMENT'
  );
  const [isRunning, setIsRunning] = useState(false);

  const handleRunAudit = (
    simulateBreakageStage?: ClosureChainStageId,
    simulateDualTruthViolation?: DualTruthCheckId
  ) => {
    setIsRunning(true);
    setTimeout(() => {
      const newReport = engine.executeForensicAudit(
        simulateBreakageStage,
        simulateDualTruthViolation
      );
      setReport(newReport);
      setIsRunning(false);
    }, 350);
  };

  const selectedStage = useMemo(() => {
    return (
      report.chainStageResults.find(s => s.stageId === selectedStageId) ||
      report.chainStageResults[0]
    );
  }, [report.chainStageResults, selectedStageId]);

  const downloadReportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', `SECP_FORENSIC_CLOSURE_AUDIT_${report.reportId}.json`);
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
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Final Engineering Closure Forensic Audit Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  LIFECYCLE CHAIN & DUAL-TRUTH ELIMINATION
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-Lifecycle Audit (EngineeringDocument → Evidence) & Verification of Zero Parallel "Engineering Truth" Pathways
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleRunAudit()}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-cyan-950/40"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Run Forensic Audit
          </button>

          <button
            onClick={() => handleRunAudit('STAGE_05_BREP')}
            disabled={isRunning}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/50 text-amber-300 rounded-lg text-xs font-semibold transition-all"
            title="Simulate chain breakage at Stage 05 (B-Rep)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Simulate Chain Breakage
          </button>

          <button
            onClick={() => handleRunAudit(undefined, 'CHECK_ZERO_DUAL_SOT')}
            disabled={isRunning}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 rounded-lg text-xs font-semibold transition-all"
            title="Simulate parallel engineering truth detection"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Simulate Dual-Truth Violation
          </button>

          <button
            onClick={downloadReportJson}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 transition-all"
            title="Export Forensic Audit JSON Report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        {/* Lifecycle Chain Status */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            13-Stage Lifecycle Chain
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-base font-black ${report.overallChainVerified ? 'text-emerald-400' : 'text-rose-400'}`}>
              {report.overallChainVerified ? '13 / 13 VERIFIED' : 'CHAIN BREAKAGE'}
            </span>
            {report.overallChainVerified ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            EngineeringDocument → Evidence
          </span>
        </div>

        {/* Dual-Truth Elimination KPI */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Dual-Truth Elimination
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-base font-black ${report.zeroParallelTruthVerified ? 'text-cyan-400' : 'text-rose-500'}`}>
              {report.zeroParallelTruthVerified ? '0 PARALLEL PATHS' : 'DUAL TRUTH DETECTED'}
            </span>
            {report.zeroParallelTruthVerified ? (
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            Single SOT Execution Invariant
          </span>
        </div>

        {/* Audited Assertions Count */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Audited Assertions
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xl font-black font-mono text-teal-300">
              {report.totalAssertionsPassed} / {report.totalAssertionsAudited}
            </span>
            <Layers className="w-5 h-5 text-teal-400" />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            100% Invariant Coverage
          </span>
        </div>

        {/* Final Official Verdict */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          report.finalVerdict === 'FORENSIC_CLOSURE_VERIFIED'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
            Official Forensic Verdict
          </span>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-black tracking-tight">
              {report.finalVerdict.replace(/_/g, ' ')}
            </span>
            {report.finalVerdict === 'FORENSIC_CLOSURE_VERIFIED' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400" />
            )}
          </div>
          <span className="text-[10px] opacity-70 mt-1">
            {report.finalVerdict === 'FORENSIC_CLOSURE_VERIFIED'
              ? 'Zero Hidden Gaps & Zero Parallel Truth'
              : 'Action Required: Forensic Remediation'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('CHAIN')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'CHAIN'
              ? 'border-cyan-500 bg-slate-900 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          13-Stage Lifecycle Chain Pipeline
        </button>

        <button
          onClick={() => setActiveTab('DUAL_TRUTH')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'DUAL_TRUTH'
              ? 'border-emerald-500 bg-slate-900 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Legacy / Sandbox Dual-Truth Elimination (4 Checks)
        </button>

        <button
          onClick={() => setActiveTab('MERKLE')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'MERKLE'
              ? 'border-amber-500 bg-slate-900 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          Forensic Merkle Ledger
        </button>
      </div>

      {/* TAB 1: 13-STAGE LIFECYCLE CHAIN PIPELINE */}
      {activeTab === 'CHAIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stage List Pipeline Sidebar */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Engineering Lifecycle Chain (13)</span>
              <span className="text-[10px] text-slate-500 font-mono">Sequential Audit</span>
            </h3>

            {report.chainStageResults.map((stage) => {
              const isSelected = stage.stageId === selectedStageId;

              return (
                <div
                  key={stage.stageId}
                  onClick={() => setSelectedStageId(stage.stageId)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                      stage.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      #{stage.stageNumber}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-200">{stage.name}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {stage.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {stage.status === 'VERIFIED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500" />
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
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono text-xs font-bold border border-cyan-800/50">
                      Stage {selectedStage.stageNumber}
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

              {/* Verified Invariants Checklist */}
              <div>
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Verified Engineering Invariants
                </div>

                <div className="space-y-2">
                  {selectedStage.verifiedInvariants.map((inv, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {inv}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-900">
                        VERIFIED
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Execution Notes */}
              <div>
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Audit Execution Log
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
                  {selectedStage.auditNotes.map((note, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-600">[{i + 1}]</span>
                      <span className={note.includes('CRITICAL') ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Hash Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Stage Evidence Hash:</span>
                <span className="font-mono text-cyan-400 text-[10px] bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {selectedStage.evidenceHash}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DUAL TRUTH & LEGACY/SANDBOX ELIMINATION */}
      {activeTab === 'DUAL_TRUTH' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <strong className="text-cyan-400 font-semibold">Anti-Dual-Truth Architecture Invariant:</strong> Re-examined all legacy, parallel, and sandbox execution modules to guarantee that no secondary pathway exists capable of producing a divergent "engineering truth". All state operations resolve strictly through the primary SOT <code className="text-amber-300">EngineeringDocument</code>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.dualTruthResults.map((check) => {
              const isSafe = check.status === 'SAFE_SINGLE_SOT';

              return (
                <div
                  key={check.checkId}
                  className={`p-5 rounded-xl border flex flex-col justify-between gap-3 ${
                    isSafe
                      ? 'bg-slate-900 border-slate-800 text-slate-100'
                      : 'bg-rose-950/50 border-rose-800 text-rose-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                        {check.checkId}
                      </span>
                      {isSafe ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> SAFE SINGLE SOT
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> DUAL TRUTH VIOLATION
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-slate-200">{check.name}</div>
                    <p className="text-xs text-slate-400 mt-1">{check.description}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300">
                    <div className="text-slate-500 uppercase font-bold text-[10px] mb-1">
                      Audited Code & Path References
                    </div>
                    {check.inspectedPaths.map((p, i) => (
                      <div key={i} className="text-cyan-300 flex items-center gap-1.5">
                        <FileCode2 className="w-3.5 h-3.5 text-slate-500" /> {p}
                      </div>
                    ))}
                    <p className="text-slate-400 font-sans mt-2">{check.details}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
                    <span>Evidence Hash:</span>
                    <span className="text-cyan-400">{check.evidenceHash.substring(0, 16)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FORENSIC MERKLE LEDGER */}
      {activeTab === 'MERKLE' && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-amber-400" />
            Cryptographic Forensic Audit Evidence Ledger
          </h3>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
            <div>
              <span className="text-slate-500">Report ID:</span> {report.reportId}
            </div>
            <div>
              <span className="text-slate-500">Audit Timestamp:</span> {report.auditTimestamp}
            </div>
            <div>
              <span className="text-slate-500">Git Commit Seal:</span> {report.gitCommitHash}
            </div>
            <div>
              <span className="text-slate-500">Execution Environment:</span> {report.environmentId}
            </div>
            <div>
              <span className="text-slate-500">Audit Execution Duration:</span> {report.auditExecutionDurationMs} ms
            </div>
            <div>
              <span className="text-slate-500">Forensic Merkle Root Hash:</span>{' '}
              <span className="text-amber-400 font-bold">{report.forensicMerkleRootHash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
