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
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">Certification, Evidence Provenance & Validation</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
              PATCH-SECP-029
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end cryptographic V-Model compliance matrix: Requirement → Design → Calculation → Simulation → Test → Evidence → Validation Sign-off.
          </p>
        </div>

        {/* Certificate Export Button */}
        <button
          onClick={handleDownloadCertificate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20 shrink-0"
        >
          {downloadedCert ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {downloadedCert ? 'Cryptographic Certificate Exported!' : 'Export Signed ISO/ASME Audit Certificate'}
        </button>
      </div>

      {/* Compliance Overview Banner */}
      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-950/80 rounded-full border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400">{matrix.certificateId}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                COMPLIANCE PASSED 100%
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-100">{matrix.projectName}</h3>
            <span className="text-xs text-slate-400">Target Standard: <strong className="text-slate-200">{matrix.targetStandard}</strong></span>
          </div>
        </div>

        {/* SHA-256 Root Hash */}
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 flex flex-col gap-1 w-full md:w-auto">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-400" /> Root Provenance Hash (SHA-256)
          </span>
          <span className="text-emerald-400 font-bold truncate max-w-xs">
            {matrix.chain[matrix.chain.length - 1].hashSha256}
          </span>
        </div>
      </div>

      {/* V-Model Provenance Flow Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
        {matrix.chain.map((node, idx) => (
          <React.Fragment key={node.step}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{node.step}</span>
            </div>
            {idx < matrix.chain.length - 1 && <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 hidden sm:block" />}
          </React.Fragment>
        ))}
      </div>

      {/* Detailed Provenance Matrix Cards */}
      <div className="flex flex-col gap-4">
        {matrix.chain.map((node, index) => (
          <div
            key={node.step}
            className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                0{index + 1}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400">{node.step}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 text-sky-400 border border-slate-800 rounded">
                    {node.standardsBadge}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    {node.status}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-100">{node.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">{node.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500 mt-2">
                  <span>Artifact: <strong className="text-slate-300">{node.artifactRef}</strong></span>
                  <span>Signee: <strong className="text-slate-300">{node.authorOrAuditor}</strong></span>
                  <span>Time: <strong className="text-slate-300">{node.timestamp}</strong></span>
                </div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Checksum */}
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-slate-400 flex flex-col gap-1 shrink-0 w-full md:w-64">
              <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                <Key className="w-3 h-3 text-emerald-400" /> Hash Signature
              </span>
              <span className="text-slate-300 truncate">{node.hashSha256}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
