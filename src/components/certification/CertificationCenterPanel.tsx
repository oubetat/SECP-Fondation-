import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Settings, FileCheck, AlertTriangle, Download, FileSignature, Lock, ExternalLink, CheckCircle2, XCircle, RefreshCw, Terminal, Database, Layers, HelpCircle, Cpu, Fingerprint, Link, GitCommit, AlertCircle } from 'lucide-react';
import { 
  CertificationLevel, 
  CertificationVerdict, 
  EngineeringTruthCertificationGate, 
  CertificationRulesEngine, 
  EvaluationContext, 
  CertificationRecord 
} from '../../engine/certification/truth/CertificationFramework';

const CAPABILITIES = [
  { key: 'CAD', name: 'Computer-Aided Design (CAD)', version: '1.2.0', group: 'Geometry' },
  { key: 'B-Rep', name: 'Boundary Representation (B-Rep)', version: '1.0.0', group: 'Geometry' },
  { key: 'NURBS', name: 'NURBS Geometry Engine', version: '2.1.0', group: 'Geometry' },
  { key: 'Boolean', name: 'Boolean Modeler & CAD GCS', version: '1.0.5', group: 'Geometry' },
  { key: 'GCS', name: 'Geometric Constraint Solver (GCS)', version: '3.0.0', group: 'Geometry' },
  { key: 'CFD', name: 'Computational Fluid Dynamics (CFD)', version: '2.4.0', group: 'Simulation' },
  { key: 'FEM', name: 'Finite Element Method (FEM)', version: '2.5.0', group: 'Simulation' },
  { key: 'Materials', name: 'Materials DB & Interpolation', version: '1.1.0', group: 'Material' },
  { key: 'CAM', name: 'Computer-Aided Manufacturing (CAM)', version: '1.5.0', group: 'Manufacturing' },
  { key: 'Assembly', name: 'Multi-Component Assembly Engine', version: '2.0.0', group: 'Geometry' },
  { key: 'PLM', name: 'Enterprise PLM Coordinator', version: '4.0.0', group: 'Infrastructure' },
  { key: 'Digital Twin', name: 'Cyber-Physical Digital Twin', version: '1.0.0', group: 'Infrastructure' },
  { key: 'GPU', name: 'Accelerated WebGPU Solver', version: '1.0.0', group: 'Performance' },
  { key: 'WASM', name: 'WASM Solver Kernel', version: '1.1.0', group: 'Performance' },
  { key: 'MPI', name: 'MPI Parallel Clustering', version: '1.0.0', group: 'Performance' },
  { key: 'Cloud', name: 'Cloud HPC Orchestrator', version: '2.0.0', group: 'Performance' },
  { key: 'Evidence', name: 'Forensic Evidence Ledger', version: '1.0.0', group: 'Integrity' },
  { key: 'Determinism', name: 'Deterministic PRNG System', version: '1.0.0', group: 'Integrity' },
  { key: 'Reproducibility', name: 'Reproducibility Benchmark', version: '1.0.0', group: 'Integrity' }
];

export function CertificationCenterPanel() {
  const [selectedCap, setSelectedCap] = useState<string>('CAD');
  const [records, setRecords] = useState<Record<string, CertificationRecord>>({});
  const [contexts, setContexts] = useState<Record<string, EvaluationContext>>({});
  const [revokedReasons, setRevokedReasons] = useState<Record<string, string>>({});
  const [exportedPackage, setExportedPackage] = useState<any | null>(null);
  const [verificationOutput, setVerificationOutput] = useState<{ [certId: string]: any }>({});
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({});

  // Initialize contexts and records
  useEffect(() => {
    const initialContexts: Record<string, EvaluationContext> = {};
    const initialRecords: Record<string, CertificationRecord> = {};

    CAPABILITIES.forEach(cap => {
      const isSim = cap.group === 'Simulation';
      const ctx: EvaluationContext = {
        subjectId: `SUBJ-NATIVE-${cap.key}-001`,
        capabilityVersion: cap.version,
        implementationEvidence: true,
        requiredTests: [
          { id: `${cap.key}-T1`, name: 'Integration Sanity', passed: true, isMandatory: true },
          { id: `${cap.key}-T2`, name: 'Functional Coverage', passed: true, isMandatory: true }
        ],
        benchmarks: [
          { id: `${cap.key}-B1`, name: 'Standard Performance', passed: true, isSimulationOnly: isSim }
        ],
        adversarialTests: [
          { id: `${cap.key}-A1`, name: 'Fuzzing Suite', passed: true }
        ],
        independentVerification: true,
        tamperDetected: false,
        isSimulationOnly: isSim,
        dependencies: ['SECP-CORE-V2']
      };

      initialContexts[cap.key] = ctx;
      initialRecords[cap.key] = EngineeringTruthCertificationGate.evaluateCapability(cap.key, ctx);
    });

    setContexts(initialContexts);
    setRecords(initialRecords);
  }, []);

  const handleContextChange = (capKey: string, updates: Partial<EvaluationContext>) => {
    setContexts(prev => {
      const updatedCtx = { ...prev[capKey], ...updates };
      const updatedRecords = { ...records };
      updatedRecords[capKey] = EngineeringTruthCertificationGate.evaluateCapability(capKey, updatedCtx);
      setRecords(updatedRecords);
      return { ...prev, [capKey]: updatedCtx };
    });
  };

  const handleTestToggle = (capKey: string, testId: string, passed: boolean) => {
    const ctx = contexts[capKey];
    if (!ctx) return;
    const updatedTests = ctx.requiredTests.map(t => t.id === testId ? { ...t, passed } : t);
    handleContextChange(capKey, { requiredTests: updatedTests });
  };

  const handleBenchmarkToggle = (capKey: string, benchId: string, passed: boolean) => {
    const ctx = contexts[capKey];
    if (!ctx) return;
    const updatedBench = ctx.benchmarks.map(b => b.id === benchId ? { ...b, passed } : b);
    handleContextChange(capKey, { benchmarks: updatedBench });
  };

  const handleAdversarialToggle = (capKey: string, advId: string, passed: boolean) => {
    const ctx = contexts[capKey];
    if (!ctx) return;
    const updatedAdv = ctx.adversarialTests.map(a => a.id === advId ? { ...a, passed } : a);
    handleContextChange(capKey, { adversarialTests: updatedAdv });
  };

  const triggerRevocation = (capKey: string) => {
    const currentRecord = records[capKey];
    if (!currentRecord) return;
    const reason = revokedReasons[capKey] || "Forensic audit detected regression or discrepancy";
    const revoked = EngineeringTruthCertificationGate.revoke(currentRecord, reason);
    setRecords(prev => ({ ...prev, [capKey]: revoked }));
  };

  const triggerRevalidation = (capKey: string, newVersion: string) => {
    const currentCtx = contexts[capKey];
    if (!currentCtx) return;
    const updatedCtx: EvaluationContext = {
      ...currentCtx,
      capabilityVersion: newVersion,
      implementationEvidence: false, // Reset implementation to simulate LEVEL 0 revalidation
      requiredTests: currentCtx.requiredTests.map(t => ({ ...t, passed: false })),
      benchmarks: currentCtx.benchmarks.map(b => ({ ...b, passed: false })),
      adversarialTests: currentCtx.adversarialTests.map(a => ({ ...a, passed: false })),
      independentVerification: false
    };

    setContexts(prev => ({ ...prev, [capKey]: updatedCtx }));
    setRecords(prev => ({
      ...prev,
      [capKey]: EngineeringTruthCertificationGate.evaluateCapability(capKey, updatedCtx)
    }));
  };

  const runIndependentVerification = async (capKey: string) => {
    const record = records[capKey];
    if (!record) return;

    setIsVerifying(prev => ({ ...prev, [capKey]: true }));

    const result = EngineeringTruthCertificationGate.verifyCertificate(record);
    setVerificationOutput(prev => ({
      ...prev,
      [capKey]: {
        timestamp: new Date().toISOString(),
        isValid: result.isValid,
        reason: result.reason,
        recomputedHash: EngineeringTruthCertificationGate.computeHash(record)
      }
    }));
    setIsVerifying(prev => ({ ...prev, [capKey]: false }));
  };

  const exportAuditPackage = () => {
    const activeRecords = Object.values(records) as CertificationRecord[];
    const pkg = EngineeringTruthCertificationGate.exportPackage(activeRecords);
    setExportedPackage(pkg);
  };

  const getVerdictStyles = (verdict?: CertificationVerdict) => {
    switch (verdict) {
      case CertificationVerdict.PROVEN:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case CertificationVerdict.PARTIALLY_PROVEN:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case CertificationVerdict.SIMULATED:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case CertificationVerdict.FAILED:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold animate-pulse';
      case CertificationVerdict.UNPROVEN:
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getLevelProgressBar = (level?: CertificationLevel) => {
    switch (level) {
      case CertificationLevel.LEVEL_0_DECLARED: return { percent: '10%', color: 'bg-slate-600', text: 'L0: Declared' };
      case CertificationLevel.LEVEL_1_IMPLEMENTED: return { percent: '30%', color: 'bg-rose-500', text: 'L1: Implemented' };
      case CertificationLevel.LEVEL_2_VERIFIED: return { percent: '50%', color: 'bg-amber-500', text: 'L2: Verified' };
      case CertificationLevel.LEVEL_3_QUALIFIED: return { percent: '70%', color: 'bg-blue-500', text: 'L3: Qualified' };
      case CertificationLevel.LEVEL_4_INDEPENDENTLY_VALIDATED: return { percent: '85%', color: 'bg-indigo-500', text: 'L4: Validated' };
      case CertificationLevel.LEVEL_5_CERTIFIED: return { percent: '100%', color: 'bg-emerald-500', text: 'L5: Certified' };
      default: return { percent: '0%', color: 'bg-slate-700', text: 'Unknown' };
    }
  };

  const activeCtx = contexts[selectedCap];
  const activeRecord = records[selectedCap];
  const activeVerify = verificationOutput[selectedCap];

  return (
    <div className="flex flex-col gap-6 text-slate-100 max-w-7xl mx-auto w-full">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            PATCH-186 — Engineering Truth Certification Framework
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Formal multi-tier verification audit center. Real-time deterministic rules, cryptographically secure hashes, and independent audit trails.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportAuditPackage}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/10"
          >
            <Download className="w-4 h-4" /> Export Verification Package
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Capability Cards Grid (8/12 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {CAPABILITIES.map(cap => {
              const rec = records[cap.key];
              const levelBar = getLevelProgressBar(rec?.CertificationLevel);
              const isSelected = selectedCap === cap.key;

              return (
                <div 
                  key={cap.key}
                  onClick={() => setSelectedCap(cap.key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-40 ${
                    isSelected 
                      ? 'bg-slate-850 border-emerald-500/60 shadow-lg shadow-emerald-500/5' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">{cap.group}</span>
                      <span className="text-[10px] font-mono text-slate-400">v{rec?.CapabilityVersion || cap.version}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{cap.name}</h4>
                  </div>

                  <div className="space-y-3 mt-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[8px] px-2 py-0.5 rounded border ${getVerdictStyles(rec?.Verdict)}`}>
                        {rec?.Verdict || 'PENDING'}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">{levelBar.text}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${levelBar.color}`}
                          style={{ width: levelBar.percent }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                        <span>L0</span>
                        <span>L1</span>
                        <span>L2</span>
                        <span>L3</span>
                        <span>L4</span>
                        <span>L5</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export View */}
          <AnimatePresence>
            {exportedPackage && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-100">Exported Certification Package (JSON)</h3>
                  </div>
                  <button 
                    onClick={() => setExportedPackage(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">Package Version</span>
                    <span className="text-slate-300 font-bold">{exportedPackage.manifest.packageVersion}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Records</span>
                    <span className="text-slate-300 font-bold">{exportedPackage.manifest.totalRecords}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Timestamp</span>
                    <span className="text-slate-300 font-bold text-[10px] truncate">{exportedPackage.manifest.exportTimestamp}</span>
                  </div>
                  <div className="col-span-1 truncate">
                    <span className="text-slate-500 block">Package Root Hash</span>
                    <span className="text-emerald-400 font-bold text-[10px]">{exportedPackage.manifest.packageHash.substring(0, 16)}...</span>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 block mb-2">RAW PACKAGE MANIFEST</span>
                  <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto max-h-40 p-2 bg-slate-900 rounded">
                    {JSON.stringify(exportedPackage, null, 2)}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Interactive Settings & Verification audit (4/12 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {activeCtx && activeRecord ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-blue-400 animate-spin-slow" />
                  Audit Sandbox
                </span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">{activeRecord.Capability}</span>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                {/* Core Parameters */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Verification Variables</span>
                  
                  {/* Implementation Evidence */}
                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-900 transition-all">
                    <div>
                      <span className="text-xs font-bold block text-slate-200">Implementation Evidence</span>
                      <span className="text-[9px] text-slate-500 font-mono block mt-0.5">EVID-IMP-{activeRecord.Capability}-001</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={activeCtx.implementationEvidence}
                      onChange={(e) => handleContextChange(selectedCap, { implementationEvidence: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>

                  {/* Independent verification */}
                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-900 transition-all">
                    <div>
                      <span className="text-xs font-bold block text-slate-200">Independent Verification Portal</span>
                      <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Independent forensics run</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={activeCtx.independentVerification}
                      onChange={(e) => handleContextChange(selectedCap, { independentVerification: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                  </label>

                  {/* Simulation-Only Capability */}
                  <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-900 transition-all">
                    <div>
                      <span className="text-xs font-bold block text-slate-200">Simulation-Only Flow</span>
                      <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Disables hardware validation</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={activeCtx.isSimulationOnly}
                      onChange={(e) => handleContextChange(selectedCap, { isSimulationOnly: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                  </label>

                  {/* Tamper detection */}
                  <label className="flex items-center justify-between p-3 bg-rose-950/10 border border-rose-500/20 rounded-lg cursor-pointer hover:bg-rose-950/20 transition-all">
                    <div>
                      <span className="text-xs font-bold block text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Adversarial Tamper Alert
                      </span>
                      <span className="text-[9px] text-rose-500 font-mono block mt-0.5">Force signature/hash invalidation</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={activeCtx.tamperDetected}
                      onChange={(e) => handleContextChange(selectedCap, { tamperDetected: e.target.checked })}
                      className="rounded border-rose-900 bg-slate-900 text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                  </label>
                </div>

                {/* Sub-tests and benchmarks */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Required Gate Tests</span>
                  
                  {activeCtx.requiredTests.map(t => (
                    <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold block text-slate-200">{t.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5">ID: TEST-{t.id} {t.isMandatory && '• Mandatory'}</span>
                      </div>
                      <button 
                        onClick={() => handleTestToggle(selectedCap, t.id, !t.passed)}
                        className={`px-3 py-1 font-mono text-[9px] font-bold rounded transition-all ${
                          t.passed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {t.passed ? 'PASSED' : 'FAILED'}
                      </button>
                    </div>
                  ))}

                  {activeCtx.benchmarks.map(b => (
                    <div key={b.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold block text-slate-200">{b.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5">ID: BENCH-{b.id} {b.isSimulationOnly && '• Sim Only'}</span>
                      </div>
                      <button 
                        onClick={() => handleBenchmarkToggle(selectedCap, b.id, !b.passed)}
                        className={`px-3 py-1 font-mono text-[9px] font-bold rounded transition-all ${
                          b.passed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {b.passed ? 'PASSED' : 'FAILED'}
                      </button>
                    </div>
                  ))}

                  {activeCtx.adversarialTests.map(a => (
                    <div key={a.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold block text-slate-200">{a.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5">ID: ADV-{a.id}</span>
                      </div>
                      <button 
                        onClick={() => handleAdversarialToggle(selectedCap, a.id, !a.passed)}
                        className={`px-3 py-1 font-mono text-[9px] font-bold rounded transition-all ${
                          a.passed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {a.passed ? 'PASSED' : 'FAILED'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Revocation Controls */}
                {activeRecord.RevocationStatus === 'ACTIVE' ? (
                  <div className="space-y-3 border-t border-slate-800 pt-5">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Revocation Gateway</span>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Provide revocation reason..."
                        value={revokedReasons[selectedCap] || ''}
                        onChange={(e) => setRevokedReasons(prev => ({ ...prev, [selectedCap]: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs flex-1 text-slate-300 focus:outline-none focus:border-slate-750 font-mono"
                      />
                      <button 
                        onClick={() => triggerRevocation(selectedCap)}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-500 font-bold text-xs rounded-lg transition-all"
                      >
                        Revoke Cert
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block uppercase tracking-wide">CERTIFICATE REVOKED</span>
                        <p className="text-[10px] text-rose-400/80 mt-1">{activeRecord.RevocationReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Revalidation Gate */}
                <div className="space-y-3 border-t border-slate-800 pt-5">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Revalidation & Version Control</span>
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div>
                      <span className="text-xs font-bold block text-slate-300">Upgrade Version</span>
                      <span className="text-[9px] text-slate-500 font-mono">Triggers full level revalidation</span>
                    </div>
                    <button 
                      onClick={() => triggerRevalidation(selectedCap, '2.0.0')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xs font-mono transition-all"
                    >
                      v2.0.0 REVAL
                    </button>
                  </div>
                </div>

                {/* Cryptographic Signature Block */}
                <div className="space-y-3 border-t border-slate-800 pt-5">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Cryptographic Attestation</span>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500">Issuer:</span>
                      <span className="text-blue-400 font-bold">{activeRecord.Issuer}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-500">Node URN:</span>
                      <span className="text-slate-400">{activeRecord.Provenance.originNodeId}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono text-slate-500 block uppercase">SHA256 Fingerprint</span>
                      <span className="text-[9px] font-mono text-indigo-400 block break-all bg-slate-900 p-2 rounded border border-slate-800">{activeRecord.CertificationHash}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono text-slate-500 block uppercase">ECC ED25519 Signature</span>
                      <span className="text-[9px] font-mono text-slate-400 block break-all bg-slate-900 p-2 rounded border border-slate-800">{activeRecord.Provenance.signature}</span>
                    </div>
                  </div>
                </div>

                {/* Independent Verification Area */}
                <div className="space-y-3 border-t border-slate-800 pt-5">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Independent Auditor Portal</span>
                  
                  <button 
                    onClick={() => runIndependentVerification(selectedCap)}
                    disabled={isVerifying[selectedCap]}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15"
                  >
                    {isVerifying[selectedCap] ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                    VERIFY AUDIT INTEGRITY
                  </button>

                  <AnimatePresence>
                    {activeVerify && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border space-y-3 ${
                          activeVerify.isValid 
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' 
                            : 'bg-rose-500/5 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {activeVerify.isValid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {activeVerify.isValid ? "AUDIT VERIFIED" : "AUDIT REJECTED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                          {activeVerify.isValid 
                            ? "All hashes verified. Signature has cryptographic provenance. Immutable records fully matched!" 
                            : `Audit failed: ${activeVerify.reason || "Integrity violation"}`}
                        </p>
                        <div className="bg-slate-950 p-2 rounded border border-slate-850 space-y-1">
                          <span className="text-[8px] text-slate-500 font-mono block">RECOMPUTED AUDIT HASH</span>
                          <span className="text-[8px] font-mono text-indigo-300 break-all block">{activeVerify.recomputedHash}</span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-500 block">Verified at: {activeVerify.timestamp}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-600 bg-slate-900 border border-slate-800 rounded-xl">
              <RefreshCw className="w-8 h-8 animate-spin mb-2" />
              <span className="text-xs font-mono">Initializing Sandbox context...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
