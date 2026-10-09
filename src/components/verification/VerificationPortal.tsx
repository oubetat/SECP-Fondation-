import React, { useState } from 'react';
import { Shield, FileCheck, AlertTriangle, XCircle, Search, CheckCircle2, Fingerprint, Link, Activity, ChevronDown, ChevronUp, Download, Upload, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  VerificationStatus, 
  IndependentVerificationResult, 
  EvidencePackage,
  VerificationFinding
} from '../../engine/verification/portal/types';
import { IndependentVerificationEngine } from '../../engine/verification/portal/IndependentVerificationEngine';

export const VerificationPortal: React.FC = () => {
  const [pkg, setPkg] = useState<EvidencePackage | null>(null);
  const [result, setResult] = useState<IndependentVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState(false);

  const handleVerify = () => {
    if (!pkg) return;
    setIsVerifying(true);
    // Simulate a brief processing time for UI feel
    setTimeout(() => {
      const vResult = IndependentVerificationEngine.verifyEvidencePackage(pkg);
      setResult(vResult);
      setIsVerifying(false);
    }, 800);
  };

  const handleImportMock = () => {
    // In a real app, this would be a file upload. 
    // Here we use the mock generator from the Gate for demonstration.
    const mock = (IndependentVerificationEngine as any).createMockPackage ? 
                  (IndependentVerificationEngine as any).createMockPackage() : 
                  null; // Fallback if internal
    
    // We'll manually construct a valid one if static helper isn't exposed properly
    const manualMock: EvidencePackage = {
      packageId: "PKG-0823-168",
      manifest: {
        rootArtifactId: "SEC-CORE-V2",
        totalEvidenceItems: 12,
        timestamp: new Date().toISOString(),
        sourceSystem: "SECP-PLATFORM"
      },
      evidenceRecords: [],
      ledgerEntries: [],
      attestations: [],
      custodyRecords: [],
      provenanceNodes: [],
      provenanceEdges: [],
      artifactIdentities: ["SEC-CORE-V2"],
      metadata: {},
      certificate: {
        certificateId: "CERT-999",
        issuedAt: new Date().toISOString(),
        certificationStatus: 'CERTIFIED'
      } as any
    };
    
    setPkg(manualMock);
    setResult(null);
  };

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case VerificationStatus.VERIFIED: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case VerificationStatus.FAILED:
      case VerificationStatus.INVALID:
      case VerificationStatus.TAMPERED:
      case VerificationStatus.INTEGRITY_FAILURE:
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case VerificationStatus.UNPROVEN:
      case VerificationStatus.INCOMPLETE:
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'CRITICAL') return <XCircle className="w-4 h-4 text-rose-500" />;
    if (severity === 'WARNING') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Search className="w-4 h-4 text-blue-500" />;
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-900/40">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Independent Verification Portal</h1>
          </div>
          <p className="text-slate-400 max-w-2xl font-medium">
            Independent cryptographic auditing of Engineering Evidence Packages. 
            Validation is performed locally without reliance on platform internal state.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleImportMock}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl font-semibold text-slate-300 hover:bg-slate-800 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Import Package
          </button>
          <button 
            onClick={handleVerify}
            disabled={!pkg || isVerifying}
            className={`flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-900/20 transition-all ${(!pkg || isVerifying) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700 hover:scale-[1.02] active:scale-95'}`}
          >
            {isVerifying ? <Activity className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            {isVerifying ? 'Verifying...' : 'Start Verification'}
          </button>
        </div>
      </div>

      {!pkg && !result && (
        <div className="border-2 border-dashed border-slate-800 rounded-3xl p-24 flex flex-col items-center justify-center text-center bg-slate-900/40">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
            <Download className="w-10 h-10 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-200 mb-2">No Evidence Package Loaded</h3>
          <p className="text-slate-500 max-w-sm mb-8">
            Upload an encrypted evidence bundle or certificate export to begin the independent audit process.
          </p>
          <button 
            onClick={handleImportMock}
            className="px-8 py-3 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-white transition-all shadow-xl"
          >
            Load Sample Package
          </button>
        </div>
      )}

      {pkg && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Package Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <FileCheck className="w-4 h-4" /> Package Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Package ID</label>
                  <p className="font-mono text-sm font-bold text-slate-300 truncate">{pkg.packageId}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Root Artifact</label>
                  <p className="font-bold text-slate-200">{pkg.manifest.rootArtifactId}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Source System</label>
                  <p className="text-sm text-slate-400">{pkg.manifest.sourceSystem}</p>
                </div>
                <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Evidence Items</label>
                    <p className="text-lg font-black text-slate-100">{pkg.manifest.totalEvidenceItems}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Timestamp</label>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(pkg.manifest.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-6 shadow-md ${getStatusColor(result.overallStatus)}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black uppercase tracking-widest text-xs">Final Verdict</h3>
                  {result.overallStatus === VerificationStatus.VERIFIED ? 
                    <CheckCircle2 className="w-6 h-6" /> : 
                    <XCircle className="w-6 h-6" />
                  }
                </div>
                <div className="text-3xl font-black mb-2 tracking-tight">
                  {result.overallStatus}
                </div>
                <p className="text-sm font-medium opacity-80">
                  {result.overallStatus === VerificationStatus.VERIFIED ? 
                    'The engineering data matches the signed cryptographic assertions perfectly.' : 
                    'Critical integrity or chain violations were detected during independent audit.'}
                </p>
                <div className="mt-6 pt-4 border-t border-current border-opacity-10 text-[10px] font-bold opacity-60 uppercase flex justify-between">
                  <span>Verification ID: {result.verificationId.slice(0, 8)}</span>
                  <span>{result.timestamp.slice(11, 19)} UTC</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Verification Progress/Results */}
          <div className="lg:col-span-2 space-y-6">
            {result ? (
              <div className="space-y-6">
                {/* Audit Categories */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Integrity', status: result.cryptographicChecks.hashesMatch, icon: Fingerprint },
                    { label: 'Signatures', status: result.cryptographicChecks.signaturesValid, icon: Shield },
                    { label: 'Provenance', status: result.provenanceChecks.lineageIntact, icon: Link },
                    { label: 'Custody', status: result.chainOfCustodyChecks.chainIntact, icon: Activity }
                  ].map((cat, idx) => (
                    <motion.div 
                      key={cat.label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cat.status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          <cat.icon className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-200">{cat.label}</span>
                      </div>
                      {cat.status ? 
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/20 uppercase tracking-widest">Pass</div> : 
                        <div className="px-3 py-1 bg-rose-500/10 text-rose-400 text-[10px] font-black rounded-full border border-rose-500/20 uppercase tracking-widest">Fail</div>
                      }
                    </motion.div>
                  ))}
                </div>

                {/* Findings */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                  <div 
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                    onClick={() => setExpandedFindings(!expandedFindings)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-slate-400" />
                      </div>
                      <h3 className="font-bold text-slate-200">Verification Findings</h3>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs font-bold rounded-md">
                        {result.findings.length}
                      </span>
                    </div>
                    {expandedFindings ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                  </div>
                  
                  <AnimatePresence>
                    {expandedFindings && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-slate-800"
                      >
                        <div className="p-2 space-y-1">
                          {result.findings.length > 0 ? result.findings.map((finding, idx) => (
                            <div key={idx} className="flex items-start gap-4 p-4 hover:bg-slate-800/40 rounded-xl transition-colors group">
                              <div className="mt-1">{getSeverityIcon(finding.severity)}</div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-black text-slate-500 tracking-wider uppercase">{finding.code}</span>
                                  {finding.targetId && <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">ID: {finding.targetId.slice(0, 8)}</span>}
                                </div>
                                <p className="text-sm font-medium text-slate-300 leading-relaxed">{finding.message}</p>
                              </div>
                            </div>
                          )) : (
                            <div className="p-12 text-center text-slate-500 font-medium">
                              No findings detected. All cryptographic and semantic assertions passed.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-600">
                  <Activity className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-300">Ready for Audit</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Click "Start Verification" to initiate independent re-computation of hashes and signatures.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
