import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
  Lock,
  Download,
  Key,
  Database,
  Award,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  CertificationEngine,
  CertificationMatrix,
  ProvenanceEvidenceNode,
} from '../engine/certificationEngine';

export const CertificationPanel: React.FC = () => {
  const [matrix] = useState<CertificationMatrix>(() => CertificationEngine.getCertificationMatrix());
  const [downloadedCert, setDownloadedCert] = useState(false);

  const handleDownloadCertificate = () => {
    setDownloadedCert(true);
    setTimeout(() => setDownloadedCert(false), 3000);
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-md text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Compliance & Certification Ledger</h2>
            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 rounded-full font-bold">
              PATCH-SECP-029
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            End-to-end cryptographic V-Model compliance matrix. Requirement → Design → Calculation → Simulation → Test → Evidence → Validation Sign-off.
          </p>
        </div>

        {/* Certificate Export Button */}
        <button
          onClick={handleDownloadCertificate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 shrink-0"
        >
          {downloadedCert ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {downloadedCert ? 'Certificate Exported!' : 'Export ISO/ASME Audit Certificate'}
        </button>
      </div>

      {/* Compliance Overview Banner */}
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

        {/* SHA-256 Root Hash */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400 flex flex-col gap-1.5 w-full md:w-auto shadow-sm">
          <span className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-500" /> Root Provenance Digest
          </span>
          <span className="text-emerald-400 font-bold truncate max-w-xs text-xs">
            {matrix.chain[matrix.chain.length - 1].hashSha256}
          </span>
        </div>
      </div>

      {/* V-Model Provenance Flow Ribbon */}
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

      {/* Detailed Provenance Matrix Cards */}
      <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        {matrix.chain.map((node, index) => (
          <div
            key={node.step}
            className="group bg-slate-950/40 hover:bg-slate-900/60 p-5 rounded-xl border border-slate-800 hover:border-emerald-500/30 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 bg-slate-900 text-slate-500 group-hover:text-emerald-400 group-hover:bg-emerald-950 transition-colors rounded-xl border border-slate-800 group-hover:border-emerald-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 shadow-sm">
                0{index + 1}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-slate-400 transition-colors">{node.step}</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-900 text-sky-400 border border-slate-800 rounded uppercase">
                    {node.standardsBadge}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 uppercase">
                    {node.status}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{node.title}</h4>
                <p className="text-[11px] text-slate-500 group-hover:text-slate-400 transition-colors leading-relaxed max-w-2xl">{node.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-600 mt-2">
                  <span>Artifact: <strong className="text-slate-400">{node.artifactRef}</strong></span>
                  <span>Auditor: <strong className="text-slate-400">{node.authorOrAuditor}</strong></span>
                  <span>Time: <strong className="text-slate-400">{node.timestamp}</strong></span>
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Checksum */}
            <div className="bg-slate-900/50 group-hover:bg-slate-900 p-3 rounded-xl border border-slate-800 group-hover:border-slate-700 font-mono text-[10px] text-slate-500 flex flex-col gap-1.5 shrink-0 w-full md:w-64 transition-all">
              <span className="text-[9px] text-slate-600 uppercase font-bold flex items-center gap-1.5">
                <Key className="w-3 h-3 text-emerald-500/50 group-hover:text-emerald-500" /> Signature
              </span>
              <span className="text-slate-400 truncate text-[10px]">{node.hashSha256}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
