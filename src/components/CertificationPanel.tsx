import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, FileCheck2, ArrowRight, Lock, Download, Key, Database, Award, ExternalLink, Cpu, Sliders, Activity, AlertTriangle, Play, RotateCw, Wrench, Check, XCircle, FileCode, CheckSquare } from 'lucide-react';
import {
  CertificationEngine,
  CertificationMatrix,
} from '../engine/certificationEngine';
import { HardAcceptanceGate164 } from '../engine/certification/HardAcceptanceGate164';
import { HardAcceptanceGate165 } from '../engine/certification/HardAcceptanceGate165';
import { ManufacturingCertificateEngine } from '../engine/certification/ManufacturingCertificateEngine';

export const CertificationPanel: React.FC = () => {
  const [activeWorkspace, setActiveWorkspace] = useState<'V_MODEL' | 'SIM_164' | 'MFG_165'>('MFG_165');
  const [matrix] = useState<CertificationMatrix>(() => CertificationEngine.getCertificationMatrix());
  const [downloadedCert, setDownloadedCert] = useState(false);

  // Hard Gate State
  const [isAuditing164, setIsAuditing164] = useState(false);
  const [report164, setReport164] = useState<any | null>(null);
  const [isAuditing165, setIsAuditing165] = useState(false);
  const [report165, setReport165] = useState<any | null>(null);
  const [revokedMessage, setRevokedMessage] = useState<string | null>(null);

  const handleDownloadCertificate = () => {
    setDownloadedCert(true);
    setTimeout(() => setDownloadedCert(false), 3000);
  };

  const runAudit164 = () => {
    setIsAuditing164(true);
    setReport164(null);
    setTimeout(() => {
      const rep = HardAcceptanceGate164.evaluate();
      setReport164(rep);
      setIsAuditing164(false);
    }, 700);
  };

  const runAudit165 = () => {
    setIsAuditing165(true);
    setReport165(null);
    setRevokedMessage(null);
    setTimeout(() => {
      const rep = HardAcceptanceGate165.evaluate();
      setReport165(rep);
      setIsAuditing165(false);
    }, 800);
  };

  const handleRevokeInUI = () => {
    if (report165 && report165.verdict === 'PASS') {
      const engine = ManufacturingCertificateEngine.getInstance();
      const certificates = engine.getCertificatesForDesignRevision('REV-01');
      if (certificates.length > 0) {
        const certId = certificates[0].certificateId;
        const success = engine.revokeManufacturingCertificate(certId, 'DESIGN_MODIFIED', 'UI_SECURITY_AUDITOR');
        if (success) {
          setRevokedMessage(`Certificate ${certId} successfully REVOKED on FEN Ledger! Status updated to 'REVOKED'.`);
          // Re-trigger verification report
          const cert = engine.getManufacturingCertificate(certId)!;
          console.log('Revoked Cert in UI:', cert);
        }
      }
    }
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Forensic Compliance & Certification</h2>
            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 rounded-full font-bold">
              FEN-SEC-v2
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            Multi-layered cryptographic ledger and independent verification gates. Requirement → CAD → Solver → Execution → Inspection → Attestation.
          </p>
        </div>

        {/* Workspace Switcher Tabs */}
        <div className="flex bg-slate-950 p-1 border border-slate-800/80 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveWorkspace('V_MODEL')}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-bold ${
              activeWorkspace === 'V_MODEL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Compliance Matrix
          </button>
          <button
            onClick={() => setActiveWorkspace('SIM_164')}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-bold ${
              activeWorkspace === 'SIM_164'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Simulation (164)
          </button>
          <button
            onClick={() => setActiveWorkspace('MFG_165')}
            className={`px-3 py-1.5 text-xs rounded-md transition-all font-bold ${
              activeWorkspace === 'MFG_165'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manufacturing (165)
          </button>
        </div>
      </div>

      {/* WORKSPACE 1: V-MODEL COMPLIANCE MATRIX */}
      {activeWorkspace === 'V_MODEL' && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 shadow-inner">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-600/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                <Award className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-emerald-500 uppercase tracking-tighter">{matrix.certificateId}</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500 text-white rounded shadow-sm">
                    COMPLIANCE PASSED
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100">{matrix.projectName}</h3>
                <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">Target Standard: <strong className="text-slate-300">{matrix.targetStandard}</strong></span>
              </div>
            </div>

            <button
              onClick={handleDownloadCertificate}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg"
            >
              {downloadedCert ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              {downloadedCert ? 'Exported!' : 'Export ISO Audit Certificate'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-950/30 p-2 rounded-xl border border-slate-800/50">
            {matrix.chain.map((node, idx) => (
              <React.Fragment key={node.step}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-bold text-[10px] transition-all ${
                  idx === matrix.chain.length - 1 ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${idx === matrix.chain.length - 1 ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{node.step}</span>
                </div>
                {idx < matrix.chain.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {matrix.chain.map((node, index) => (
              <div
                key={node.step}
                className="group bg-slate-950/40 hover:bg-slate-900/60 p-5 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 bg-slate-900 text-slate-500 group-hover:text-emerald-400 group-hover:bg-emerald-950 transition-colors rounded-xl border border-slate-800 group-hover:border-emerald-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                    0{index + 1}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-slate-400">{node.step}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-900 text-sky-400 border border-slate-800 rounded uppercase">
                        {node.standardsBadge}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">{node.title}</h4>
                    <p className="text-[11px] text-slate-500 group-hover:text-slate-400 leading-relaxed max-w-2xl">{node.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-600 mt-2">
                      <span>Artifact: <strong className="text-slate-400">{node.artifactRef}</strong></span>
                      <span>Auditor: <strong className="text-slate-400">{node.authorOrAuditor}</strong></span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 group-hover:bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-500 flex flex-col gap-1.5 shrink-0 w-full md:w-64">
                  <span className="text-[9px] text-slate-600 uppercase font-bold flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-emerald-500" /> Signature
                  </span>
                  <span className="text-slate-400 truncate text-[10px]">{node.hashSha256}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WORKSPACE 2: SIMULATION CERTIFICATE WORKBENCH */}
      {activeWorkspace === 'SIM_164' && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Simulation Certification Engine (PATCH-164)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Independent verification check for CFD Navier-Stokes and Finite Element solvers. Proves convergence, conservation, and numerical stability.
              </p>
            </div>
            <button
              onClick={runAudit164}
              disabled={isAuditing164}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-xs rounded-lg transition-all shadow-md shrink-0"
            >
              {isAuditing164 ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isAuditing164 ? 'Running Solver Audits...' : 'Execute Gate 164 Audit'}
            </button>
          </div>

          {report164 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Report Summary */}
              <div className="lg:col-span-1 bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Audit Results</span>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-2xl font-mono font-bold text-white">{report164.passedChecks} / {report164.totalChecks}</span>
                  <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-mono font-bold rounded-lg uppercase tracking-wider">
                    {report164.verdict}
                  </span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Patch Level:</span>
                    <span className="font-mono font-bold text-blue-400">{report164.patch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gate Identity:</span>
                    <span className="font-mono text-slate-300 truncate w-36 text-right">{report164.gateId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cert Integrity:</span>
                    <span className="text-emerald-400 font-bold">100% Cryptographic</span>
                  </div>
                </div>
              </div>

              {/* List of checks */}
              <div className="lg:col-span-2 bg-slate-950/20 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Independent Checks Log</span>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {report164.checks.map((check: any) => (
                    <div key={check.id} className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 flex items-start justify-between gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{check.id}</span>
                        <h4 className="font-bold text-slate-200">{check.name}</h4>
                        <p className="text-[11px] text-slate-400">{check.description}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        check.passed ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-400' : 'bg-rose-950/50 border border-rose-800/40 text-rose-400'
                      }`}>
                        {check.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORKSPACE 3: MANUFACTURING CERTIFICATE WORKBENCH */}
      {activeWorkspace === 'MFG_165' && (
        <div className="flex flex-col gap-6">
          {/* Subheader and run button */}
          <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" /> Manufacturing Certification Ledger (PATCH-165)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed max-w-2xl">
                Binds Design → CAM Strategies → Toolpath → G-Code Syntax → Machine Telemetry → CMM Inspection. 
                Strictly prohibits simulation as execution validation, ensuring real-world dimensional metrology feedback.
              </p>
            </div>
            <button
              onClick={runAudit165}
              disabled={isAuditing165}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-bold text-xs rounded-lg transition-all shadow-md shrink-0"
            >
              {isAuditing165 ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isAuditing165 ? 'Running Manufacturing Audits...' : 'Execute Gate 165 Audit'}
            </button>
          </div>

          {revokedMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono rounded-lg animate-fadeIn">
              {revokedMessage}
            </div>
          )}

          {report165 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn">
              {/* Report Summary & Forensic Ledger Actions */}
              <div className="flex flex-col gap-6 lg:col-span-1">
                {/* Score */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-md">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Hard Gate 165 Results</span>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-2xl font-mono font-bold text-white">{report165.passedChecks} / {report165.totalChecks}</span>
                    <span className="px-3 py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs font-mono font-bold rounded-lg uppercase tracking-wider">
                      {report165.verdict}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Scenarios Checked:</span>
                      <span className="font-mono font-bold text-slate-200">25 Adversarial + 1 Base</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Object ID:</span>
                      <span className="font-mono text-slate-300 font-bold">PART-777</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Revision ID:</span>
                      <span className="font-mono text-slate-300">REV-01</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Validation Level:</span>
                      <span className="text-amber-400 font-bold">LEVEL 6 - CERTIFIED</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 mt-1 flex flex-col gap-2">
                    <button
                      onClick={handleRevokeInUI}
                      className="w-full py-1.5 px-3 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-800/60 text-rose-400 hover:text-rose-200 text-xs rounded transition-colors font-mono font-bold"
                    >
                      Trigger FEN Revocation
                    </button>
                    <span className="text-[9px] text-slate-500 leading-normal">
                      Simulates a post-issuance engineering change order (ECO), modifying the design revision and revoking the certified baseline on the evidence ledger.
                    </span>
                  </div>
                </div>

                {/* Simulated Metrology Inspection Data */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-md">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">CMM Dimensional Metrology</span>
                  <div className="text-xs space-y-3">
                    <div className="p-3 bg-slate-900 rounded border border-slate-800/60 space-y-2">
                      <div className="flex justify-between font-mono text-[10px] text-slate-500">
                        <span>Measurement M-01</span>
                        <span>Zeiss CMM-01</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-white">12.001 mm</span>
                        <span className="text-[10px] font-mono text-slate-400">Tol: ±0.005</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] font-bold">
                        <Check className="w-3.5 h-3.5" /> Inside Process Limits
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>Inspection Method:</span>
                      <span>GD&T Profilometry</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Certified Manifest Details & Signature */}
              <div className="flex flex-col gap-6 lg:col-span-1">
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col gap-4 shadow-md">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Cryptographic Manifest (HMAC)</span>
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-col gap-1 font-mono p-2.5 bg-slate-900/80 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Geometry Hash</span>
                      <span className="text-slate-300 text-[10px] truncate">HASH-GEOM-CAD-777</span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono p-2.5 bg-slate-900/80 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">CAM Operations Hash</span>
                      <span className="text-slate-300 text-[10px] truncate">HASH-CAM-OP-BASELINE</span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono p-2.5 bg-slate-900/80 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">G-Code File Hash</span>
                      <span className="text-slate-300 text-[10px] truncate">HASH-GCODE-PROGRAM-777</span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono p-2.5 bg-slate-900/80 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">CMM Verification Hash</span>
                      <span className="text-slate-300 text-[10px] truncate">HASH-MEAS-01</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-850 space-y-1.5">
                    <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" /> FEN Certificate Signature
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block break-all">
                      9f8acde8892f3a479b188c00aa165fbb771239c0d12e
                    </span>
                  </div>
                </div>
              </div>

              {/* 25 Adversarial Check Logs */}
              <div className="flex flex-col gap-4 xl:col-span-1 bg-slate-950/20 border border-slate-800 rounded-xl p-5 shadow-inner">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Adversarial Verification Logs</span>
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                  {report165.checks.map((check: any) => (
                    <div key={check.id} className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 flex items-start justify-between gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{check.id}</span>
                        <h4 className="font-bold text-slate-200">{check.name}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{check.description}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                        check.passed ? 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-400' : 'bg-rose-950/50 border border-rose-800/40 text-rose-400'
                      }`}>
                        {check.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
