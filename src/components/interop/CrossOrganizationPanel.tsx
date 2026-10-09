import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Send, Download, CheckCircle2, AlertTriangle, Building2, FileCheck, Database, ArrowRightLeft, FileSignature, History, Activity, UserCheck, Lock, Search, ChevronRight, RefreshCw, X } from 'lucide-react';
import { CrossOrganizationEvidenceEngine } from '../../engine/interop/organization/CrossOrganizationEvidenceEngine';
import { OrganizationType, CrossOrganizationEvidencePackage, CrossOrganizationVerificationReport } from '../../engine/interop/organization/types';
import { VerificationStatus } from '../../engine/verification/portal/types';
import { HardAcceptanceGate168 } from '../../engine/verification/portal/HardAcceptanceGate168';
import { EngineeringHashChain } from '../../engine/evidence/EngineeringHashChain';

export function CrossOrganizationPanel() {
  const [activeStage, setActiveStage] = useState<'SOURCE' | 'TRANSFER' | 'DESTINATION'>('SOURCE');
  const [transferLog, setTransferLog] = useState<string[]>([]);
  const [currentPackage, setCurrentPackage] = useState<CrossOrganizationEvidencePackage | null>(null);
  const [verificationReport, setVerificationReport] = useState<CrossOrganizationVerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const sourceOrg = CrossOrganizationEvidenceEngine.createOrganization("ORG-ENG-01", "Engineering Solutions Ltd", OrganizationType.ENGINEERING_COMPANY);
  const destOrg = CrossOrganizationEvidenceEngine.createOrganization("ORG-MFG-02", "Advanced Manufacturing Group", OrganizationType.MANUFACTURER);

  const addLog = (msg: string) => {
    setTransferLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handlePreparePackage = () => {
    addLog("Initializing Cross-Organization Evidence Protocol...");
    const basePkg = (HardAcceptanceGate168 as any).createMockPackage();
    
    const txHash = EngineeringHashChain.computeCanonicalHash({
      src: sourceOrg.organizationId,
      dest: destOrg.organizationId,
      policy: "POL-ISO-9001",
      domain: "Supplier Quality Assurance"
    }).canonicalHash;
    const txId = `TX-${txHash.substring(0, 8).toUpperCase()}`;

    const xorgPkg = CrossOrganizationEvidenceEngine.preparePackage(
      basePkg,
      sourceOrg,
      destOrg.organizationId,
      txId,
      "POL-ISO-9001",
      "Supplier Quality Assurance"
    );

    setCurrentPackage(xorgPkg);
    addLog(`Evidence Package Prepared: ${xorgPkg.packageId}`);
    addLog(`Source Identity Attached: ${sourceOrg.organizationName}`);
    addLog(`Cryptographic Signature Generated: ${xorgPkg.packageSignature.substring(0, 20)}...`);
  };

  const handleTransfer = () => {
    if (!currentPackage) return;
    addLog(`Initiating Transfer to ${destOrg.organizationName}...`);
    setActiveStage('TRANSFER');
    addLog("Package transmitted via SECP Local Protocol.");
    addLog("Destination RECEIVED acknowledgement logged.");
    setActiveStage('DESTINATION');
  };

  const handleVerify = async () => {
    if (!currentPackage) return;
    setIsVerifying(true);
    addLog("Receiver: Starting Multi-Step Verification Pipeline...");
    
    const report = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(currentPackage);
    setVerificationReport(report);
    setIsVerifying(false);

    if (report.overallStatus === VerificationStatus.VERIFIED) {
      addLog("VERIFIED: Cross-Organization trust anchor established.");
    } else {
      addLog(`FAILED: ${report.overallStatus}`);
    }
  };

  const handleReset = () => {
    setActiveStage('SOURCE');
    setCurrentPackage(null);
    setVerificationReport(null);
    setTransferLog([]);
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-indigo-400" />
            PATCH-169 — Cross-Organization Evidence Exchange
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Secure, verifiable engineering evidence sharing between independent organizations.
          </p>
        </div>
        <button 
          onClick={handleReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-mono transition-colors"
        >
          RESET SCENARIO
        </button>
      </div>

      {/* Stage Tracker */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { id: 'SOURCE', label: 'Organization A (Source)', icon: Building2 },
          { id: 'TRANSFER', label: 'Transfer Protocol', icon: Send },
          { id: 'DESTINATION', label: 'Organization B (Receiver)', icon: Database }
        ].map((stage, idx) => (
          <div 
            key={stage.id}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeStage === stage.id 
                ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                : 'bg-slate-900 border-slate-800 opacity-50'
            }`}
          >
            <stage.icon className={`w-5 h-5 ${activeStage === stage.id ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
            {activeStage === stage.id && (
              <motion.div 
                layoutId="active-dot"
                className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" 
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspace Area */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Active Workspace: {activeStage === 'SOURCE' ? 'Source Preparation' : 'Receiver Verification'}
            </span>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-700" />
              <div className="w-2 h-2 rounded-full bg-slate-700" />
              <div className="w-2 h-2 rounded-full bg-slate-700" />
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeStage === 'SOURCE' && (
                <motion.div 
                  key="source"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl">
                    <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4" /> Organization Identity
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500">Name:</span>
                        <div className="text-slate-200">{sourceOrg.organizationName}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Type:</span>
                        <div className="text-slate-200">{sourceOrg.organizationType}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Identity ID:</span>
                        <div className="text-slate-200">{sourceOrg.organizationId}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Status:</span>
                        <div className="text-emerald-400 font-bold">{sourceOrg.status}</div>
                      </div>
                    </div>
                  </div>

                  {!currentPackage ? (
                    <button 
                      onClick={handlePreparePackage}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      PREPARE EVIDENCE PACKAGE
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                            <FileCheck className="w-4 h-4" /> Package Manifest
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">ID: {currentPackage.packageId}</span>
                        </div>
                        <div className="space-y-2 text-[10px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Root Artifact:</span>
                            <span className="text-slate-300">{currentPackage.manifest.rootArtifactId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Evidence Count:</span>
                            <span className="text-slate-300">{currentPackage.evidenceRecords.length} Items</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Package Hash:</span>
                            <span className="text-blue-400 truncate w-32 ml-4">{currentPackage.packageHash}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleTransfer}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Send className="w-5 h-5" />
                        SIGN & TRANSFER PACKAGE
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {activeStage === 'TRANSFER' && (
                <motion.div 
                  key="transfer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center gap-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                    <Send className="w-10 h-10 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-indigo-300">Synchronizing Cross-Org Evidence</div>
                    <div className="text-xs text-slate-500 font-mono mt-1 italic">Protocol Layer: SECP-LOCAL-V1</div>
                  </div>
                </motion.div>
              )}

              {activeStage === 'DESTINATION' && (
                <motion.div 
                  key="dest"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
                      <Download className="w-4 h-4 text-emerald-400" /> Received Package
                    </h3>
                    {currentPackage && (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <div className="text-[10px] font-bold">Source: {currentPackage.sourceOrganization}</div>
                          </div>
                          <div className="text-[9px] font-mono px-2 py-0.5 bg-slate-800 rounded">SIGNED</div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 break-all bg-slate-950 p-2 rounded border border-slate-800">
                          {currentPackage.packageSignature}
                        </div>
                      </div>
                    )}
                  </div>

                  {!verificationReport ? (
                    <button 
                      onClick={handleVerify}
                      disabled={isVerifying}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          VERIFYING INTEGRITY...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          VERIFY INCOMING EVIDENCE
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 text-center ${
                        verificationReport.overallStatus === VerificationStatus.VERIFIED
                          ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400'
                          : 'bg-rose-600/10 border-rose-500/50 text-rose-400'
                      }`}>
                        {verificationReport.overallStatus === VerificationStatus.VERIFIED ? (
                          <CheckCircle2 className="w-12 h-12" />
                        ) : (
                          <AlertTriangle className="w-12 h-12" />
                        )}
                        <div>
                          <div className="text-xl font-black tracking-tighter uppercase">{verificationReport.overallStatus}</div>
                          <div className="text-[10px] font-mono opacity-80">Report ID: {verificationReport.reportId}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Identity', val: verificationReport.organizationIdentityVerified },
                          { label: 'Package Hash', val: verificationReport.packageIntegrityVerified },
                          { label: 'Signature', val: verificationReport.senderSignatureVerified },
                          { label: 'Independent', val: verificationReport.independentVerificationStatus === VerificationStatus.VERIFIED }
                        ].map((check, i) => (
                          <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{check.label}</span>
                            {check.val ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-slate-400">
              <History className="w-4 h-4" /> Cross-Organization Audit Trail
            </span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-2 font-mono text-[10px]">
            {transferLog.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                Awaiting protocol initialization...
              </div>
            ) : (
              transferLog.map((log, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="py-2 border-b border-slate-800/50 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {log}
                </motion.div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Protocol Active</span>
            </div>
            <span className="text-[9px] text-slate-600">SECP INDUSTRIAL OS v2.0</span>
          </div>
        </div>
      </div>

      {/* Verification Logic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <FileSignature className="w-5 h-5 text-blue-400" />
          </div>
          <h4 className="text-sm font-bold">Deterministic Serialization</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Packages use deterministic canonical serialization to ensure that hashes generated at Organization A remain valid after transmission to Organization B.
          </p>
        </div>
        <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-400" />
          </div>
          <h4 className="text-sm font-bold">Zero-Trust Verification</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Organization B ignores any PASS/FAIL flags from Organization A. It re-verifies every hash, signature, and provenance link locally.
          </p>
        </div>
        <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <h4 className="text-sm font-bold">Identity Asserted</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Organization identities are cryptographically bound to the Evidence Package, preventing spoofing or unauthorized re-transmissions.
          </p>
        </div>
      </div>
    </div>
  );
}
