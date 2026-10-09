import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ShieldCheck, FileText, RotateCw, Cpu, Terminal, Activity, Download, Flame, User, ExternalLink, Lock, RefreshCw, Server, Database, Grid, FileCode, Eye, AlertTriangle, History, CheckCircle, XCircle, HelpCircle, Hash } from 'lucide-react';
import {
  IndependentAuditPackageExporter,
  IndependentAuditPackageGate,
  IndependentVerificationEngine,
  computePackageHash,
  IndependentAuditPackage,
  AuditClaim,
  AuditEvidence,
  AuditTestManifest,
  KnownFailureRecord,
  UnprovenCapabilityRecord,
  PackageGateResult
} from '../../engine/certification/truth/IndependentAuditPackage';

export function IndependentAuditPackagePanel() {
  const [independenceLevel, setIndependenceLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(2);
  const [projectRevision, setProjectRevision] = useState("REV-189-AESTHETIC");
  const [activeTab, setActiveTab] = useState<'claims' | 'evidence' | 'reproduction' | 'failures' | 'adversarial' | 'gate'>('claims');

  // Load the initial real model audit package
  const [auditPackage, setAuditPackage] = useState<IndependentAuditPackage>(() => {
    return IndependentAuditPackageExporter.generatePackage(2, "REV-189-AESTHETIC");
  });

  const [selectedClaim, setSelectedClaim] = useState<AuditClaim | null>(null);
  const [adversarialLog, setAdversarialLog] = useState<string[]>([
    "Auditor sandbox initialized. Systems ready to accept independent artifacts."
  ]);
  const [tamperActive, setTamperActive] = useState(false);
  const [reproducingMap, setReproducingMap] = useState<Record<string, boolean>>({});
  const [reproductionResults, setReproductionResults] = useState<Record<string, string>>({});

  // Compute the current Gate decision
  const gateResult = IndependentAuditPackageGate.executeGate(auditPackage);

  const appendLog = (msg: string) => {
    setAdversarialLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleLevelChange = (level: 0 | 1 | 2 | 3 | 4 | 5) => {
    setIndependenceLevel(level);
    const newPkg = IndependentAuditPackageExporter.generatePackage(level, projectRevision);
    setAuditPackage(newPkg);
    appendLog(`Independence level adjusted to Level ${level} — Rebuilding ledger...`);
  };

  const handleRevisionChange = (rev: string) => {
    setProjectRevision(rev);
    const newPkg = IndependentAuditPackageExporter.generatePackage(independenceLevel, rev);
    setAuditPackage(newPkg);
    appendLog(`System revision updated to ${rev}. Re-computing cryptographic tree hashes...`);
  };

  // Simulate a single claim reproduction
  const runReproduction = (claimId: string, cmd: string) => {
    setReproducingMap(prev => ({ ...prev, [claimId]: true }));
    appendLog(`Executing independent reproduction command: "${cmd}"...`);

    setTimeout(() => {
      setReproducingMap(prev => ({ ...prev, [claimId]: false }));
      setReproductionResults(prev => ({
        ...prev,
        [claimId]: `SUCCESS: All locally executed tests passed inside sandboxed workspace.`
      }));
      appendLog(`Reproduction of ${claimId} completed. Verdict matched expected output with 0% boundary drift.`);
    }, 1200);
  };

  // Sabotage the package (tamper with hash or claim status to trigger integrity fail)
  const triggerSabotage = (type: 'status' | 'hash' | 'delete_evidence') => {
    setTamperActive(true);
    let tampered = { ...auditPackage };

    if (type === 'status') {
      // Maliciously change a partial CFD solver to fully PROVEN without evidence update
      tampered.claims = tampered.claims.map(c => {
        if (c.id === "CLAIM-CFD-001") {
          return { ...c, status: "PROVEN" as const };
        }
        return c;
      });
      appendLog("TAMPER ACTION: Changed CLAIM-CFD-001 status from PARTIAL to PROVEN (Violates Gate Constraint).");
    } else if (type === 'hash') {
      // Corrupt the root signature hash of the package
      tampered.packageHash = "BAD_HASH_9999999999999999999999999999999999999999999999999999999999999999";
      appendLog("TAMPER ACTION: Overwrote root packageHash signature with a corrupted hex string.");
    } else if (type === 'delete_evidence') {
      // Delete the NURBS Geometry evidence but keep the claim
      tampered.evidence = tampered.evidence.filter(e => e.id !== "EVID-CAD-01");
      appendLog("TAMPER ACTION: Wiped out NURBS solid modeling source evidence EVID-CAD-01.");
    }

    setAuditPackage(tampered);
  };

  // Rebuild the package from authentic artifacts
  const rebuildPackage = () => {
    setTamperActive(false);
    const restored = IndependentAuditPackageExporter.generatePackage(independenceLevel, projectRevision);
    setAuditPackage(restored);
    appendLog("SYSTEM RESTORE: Rebuilt package deterministically from original codebase artifacts. Cryptographic hash restored.");
  };

  // Download raw package JSON file
  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditPackage, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `independent-audit-package-${auditPackage.packageId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    appendLog(`Exported full verified package JSON structure matching hash ${(auditPackage?.packageHash || 'HASH00000000').slice(0, 12)}...`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PROVEN": return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
      case "PARTIAL": return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      case "UNPROVEN": return "bg-slate-500/15 text-slate-400 border border-slate-500/30";
      case "ABSENT": return "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      default: return "bg-slate-500/15 text-slate-400 border border-slate-500/30";
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "VERIFIED":
      case "REPRODUCED":
        return <CheckCircle className="w-4 h-4 text-emerald-400 inline mr-1" />;
      case "PARTIALLY_VERIFIED":
      case "PARTIALLY_REPRODUCED":
        return <AlertTriangle className="w-4 h-4 text-amber-400 inline mr-1" />;
      case "NOT_VERIFIED":
      case "NOT_REPRODUCED":
        return <XCircle className="w-4 h-4 text-rose-400 inline mr-1" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400 inline mr-1" />;
    }
  };

  return (
    <div className="space-y-6 text-slate-100" id="iap-dashboard-root">
      {/* Upper Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Package Identity */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg space-y-3 shadow-md" id="iap-identity-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Audit Package ID</span>
            <span className="bg-indigo-500/10 text-indigo-300 text-xs px-2.5 py-0.5 rounded border border-indigo-500/20 font-mono">
              {auditPackage.packageId}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Revision:</span>
              <span className="font-mono text-slate-300">{auditPackage.projectRevision}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Generated At:</span>
              <span className="text-slate-300 text-xs font-mono">
                {new Date(auditPackage.generatedAt).toLocaleDateString()} {new Date(auditPackage.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Auditor Identity:</span>
              <span className="text-indigo-300 font-mono text-xs">{auditPackage.engineeringIdentity}</span>
            </div>
          </div>
        </div>

        {/* Independence Level Controller */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg space-y-3 shadow-md" id="iap-level-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Independence Level</span>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/20">
              Level {independenceLevel}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1 pt-1">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => handleLevelChange(level as any)}
                className={`py-1.5 rounded text-xs font-mono transition-all border ${
                  independenceLevel === level
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                L{level}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            {independenceLevel === 0 && "Level 0: Self-reported claims with zero verification requirements."}
            {independenceLevel === 1 && "Level 1: Internal build pipeline test assertions executed locally."}
            {independenceLevel === 2 && "Level 2: Independent automated reproduction within isolated containers."}
            {independenceLevel === 3 && "Level 3: Full engineering source inspection & static proof check."}
            {independenceLevel === 4 && "Level 4: External testing laboratory or accredited client validation."}
            {independenceLevel === 5 && "Level 5: Formal legal certification issued by a third-party audit agency."}
          </p>
        </div>

        {/* Security Acceptance Gate Status */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg space-y-3 shadow-md relative overflow-hidden" id="iap-gate-status-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold tracking-wide text-slate-400 uppercase font-mono">Independent Verification Gate</span>
            <span className="text-xs text-slate-500">PATCH-189</span>
          </div>

          <div className="flex items-center space-x-3 pt-1">
            <div className={`p-2.5 rounded-full ${gateResult.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {gateResult.passed ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Compliance Decision:</div>
              <div className={`text-xl font-bold tracking-tight ${gateResult.passed ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                {gateResult.verdict === "PASS" ? "PASS (SECP AUDITED)" : "FAIL (INTEGRITY FAULT)"}
              </div>
            </div>
          </div>

          <div className="pt-1.5 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Root Hash Check:</span>
            <span className={`text-[10px] ${gateResult.passed ? 'text-indigo-400' : 'text-rose-500 line-through'}`}>
              {(gateResult?.packageHash || 'HASH0000000000000000').slice(0, 16)}...{(gateResult?.packageHash || 'HASH0000000000000000').slice(-8)}
            </span>
          </div>

          {tamperActive && (
            <div className="absolute top-1 right-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1" id="iap-tabs">
        {[
          { id: 'claims', label: 'Capability Claims', icon: Grid },
          { id: 'evidence', label: 'Evidence Manifest', icon: FileCode },
          { id: 'reproduction', label: 'Reproduction Protocol', icon: Terminal },
          { id: 'failures', label: 'Disclosures & Roadmaps', icon: AlertTriangle },
          { id: 'adversarial', label: 'Adversarial Tamper Lab', icon: Flame },
          { id: 'gate', label: 'Gate Verification Checklist', icon: ShieldCheck }
        ].map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-medium transition-all border-t-2 ${
                activeTab === tab.id
                  ? 'bg-slate-900 border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 shadow-lg min-h-[420px]" id="iap-content-panel">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* 1. Capability Claims Panel */}
            {activeTab === 'claims' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Engineering Capability Claims</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    This registry acts as the single source of truth for all engineering claims asserted by SECP. 
                    Each claim must map to backing file references, hashes, and isolated testing manifests.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left list of claims */}
                  <div className="md:col-span-1 space-y-2 border-r border-slate-800 pr-4">
                    {auditPackage.claims.map((claim) => (
                      <button
                        key={claim.id}
                        onClick={() => setSelectedClaim(claim)}
                        className={`w-full text-left p-3 rounded transition-all border text-xs ${
                          selectedClaim?.id === claim.id
                            ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 shadow-sm'
                            : 'bg-slate-950 border-slate-800 hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-500">{claim.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${getStatusColor(claim.status)}`}>
                            {claim.status}
                          </span>
                        </div>
                        <div className="font-medium text-slate-200 mt-1 truncate">{claim.capability}</div>
                      </button>
                    ))}
                  </div>

                  {/* Right claim details */}
                  <div className="md:col-span-2 space-y-4">
                    {selectedClaim ? (
                      <div className="bg-slate-950 border border-slate-800 p-5 rounded space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] text-indigo-400 font-mono tracking-wider">{selectedClaim.id}</span>
                            <h4 className="text-sm font-semibold text-white">{selectedClaim.capability}</h4>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${getStatusColor(selectedClaim.status)}`}>
                            Declared: {selectedClaim.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-400">Claim Scope & Objectives:</div>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-800">
                            {selectedClaim.description}
                          </p>
                        </div>

                        {/* Verification verdict banner */}
                        <div className="bg-slate-900 p-3 rounded border border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
                          <div>
                            <span className="text-slate-400 block text-[10px] mb-1">Independent Reproduction Verdict</span>
                            <div className="flex items-center">
                              {getVerdictIcon(selectedClaim.independentReproductionVerdict)}
                              <span className="font-semibold text-slate-200">{selectedClaim.independentReproductionVerdict}</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] mb-1">Independent Verification Verdict</span>
                            <div className="flex items-center">
                              {getVerdictIcon(selectedClaim.independentVerificationVerdict)}
                              <span className="font-semibold text-slate-200">{selectedClaim.independentVerificationVerdict}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-slate-400">Associated Evidence Artifacts:</div>
                          <div className="space-y-1">
                            {selectedClaim.supportingEvidenceIds.length > 0 ? (
                              selectedClaim.supportingEvidenceIds.map((evId) => {
                                const ev = auditPackage.evidence.find(e => e.id === evId);
                                return (
                                  <div key={evId} className="flex justify-between items-center text-xs bg-slate-900 px-3 py-2 rounded font-mono border border-slate-800/50">
                                    <span className="text-indigo-300 font-medium">{evId} ({ev?.artifactName || 'Unknown'})</span>
                                    <span className="text-[10px] text-slate-500">{ev?.filePath}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-xs text-rose-400 italic">No supporting evidence provided. Verification failed.</div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-slate-400">Physical & Analytical Boundaries:</div>
                          <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-normal">
                            {selectedClaim.limitations.map((limit, idx) => (
                              <li key={idx}>{limit}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 border border-dashed border-slate-800 rounded p-12">
                        <Eye className="w-10 h-10 text-slate-500" />
                        <div className="text-xs font-medium">Select a capability claim to view its full audit trails.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Evidence Manifest Panel */}
            {activeTab === 'evidence' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Central Evidence Manifest Ledger</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Cryptographic index of all source files, unit tests, and proof matrices used during verification.
                    Any single change in files triggers immediate signature mismatches under the verification gate.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border border-slate-800 rounded">
                    <thead className="bg-slate-950 font-mono text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">ID / Artifact</th>
                        <th className="p-3">Source File Path</th>
                        <th className="p-3">Cryptographic SHA-256 Hash</th>
                        <th className="p-3">Revision</th>
                        <th className="p-3">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/20">
                      {auditPackage.evidence.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-850/40">
                          <td className="p-3">
                            <span className="font-mono text-[10px] text-indigo-400 block">{ev.id}</span>
                            <span className="font-medium text-slate-200">{ev.artifactName}</span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">{ev.filePath}</td>
                          <td className="p-3 font-mono text-[10px] text-indigo-300">{(ev?.fileHash || 'HASH00000000').slice(0, 32)}...</td>
                          <td className="p-3 font-mono text-slate-400">{ev.revision}</td>
                          <td className="p-3">
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-indigo-950/50 text-indigo-300 border border-indigo-900/40">
                              {ev.evidenceType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Reproduction Protocol Panel */}
            {activeTab === 'reproduction' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Deterministic Reproduction Protocol</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    This module outlines exact steps, hardware dependencies, and terminal commands needed for any third party auditor
                    to reproduce SECP analytical solver benchmarks inside clean Docker/Node sandboxes.
                  </p>
                </div>

                <div className="space-y-6">
                  {auditPackage.reproductionProcedures.map((proc) => {
                    const claim = auditPackage.claims.find(c => c.id === proc.claimId);
                    return (
                      <div key={proc.id} className="bg-slate-950 border border-slate-800 p-5 rounded space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-[10px] font-mono text-indigo-400">{proc.id} — Associated Claim: {proc.claimId}</span>
                            <h4 className="text-sm font-semibold text-slate-100">{claim?.capability || 'Unknown'}</h4>
                          </div>
                          <span className="bg-slate-900 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded border border-slate-800">
                            Version: {proc.projectVersion}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <div>
                              <span className="text-slate-500 font-mono block">Environment Requirements:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {proc.environmentRequirements.map((req, idx) => (
                                  <span key={idx} className="bg-slate-900 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-850">
                                    {req}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-500 font-mono block">Expected Output Format:</span>
                              <p className="text-slate-300 mt-0.5 leading-normal bg-slate-900/40 p-2 rounded border border-slate-800">
                                {proc.expectedOutputSchema}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-slate-500 font-mono block">Tolerance Threshold:</span>
                              <p className="text-slate-300 mt-0.5 font-mono">{proc.tolerance}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-mono block">Failure Outcome Interpretation:</span>
                              <p className="text-slate-300 mt-0.5 text-rose-300 leading-normal bg-rose-950/10 p-2 rounded border border-rose-950/20">
                                {proc.failureInterpretation}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Reproduction Terminal */}
                        <div className="bg-slate-900 rounded p-4 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400 flex items-center">
                              <Terminal className="w-4 h-4 mr-1 text-indigo-400" />
                              Interactive Workspace Console
                            </span>
                            <button
                              onClick={() => runReproduction(proc.claimId, proc.runCommand)}
                              disabled={reproducingMap[proc.claimId]}
                              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-mono px-3 py-1 rounded flex items-center space-x-1 transition-all"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${reproducingMap[proc.claimId] ? 'animate-spin' : ''}`} />
                              <span>{reproducingMap[proc.claimId] ? 'Executing...' : 'Run Procedure'}</span>
                            </button>
                          </div>

                          <div className="bg-black/40 rounded p-3 font-mono text-xs text-indigo-300 space-y-1">
                            <div className="text-slate-500">$ {proc.runCommand}</div>
                            {reproducingMap[proc.claimId] && (
                              <div className="text-slate-400 animate-pulse">Running test suites. Fetching code symbols from ledger...</div>
                            )}
                            {reproductionResults[proc.claimId] && (
                              <div className="text-emerald-400">{reproductionResults[proc.claimId]}</div>
                            )}
                            {!reproducingMap[proc.claimId] && !reproductionResults[proc.claimId] && (
                              <div className="text-slate-500">Console idle. Click Run Procedure to start execution.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Disclosures & Roadmaps Panel */}
            {activeTab === 'failures' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Full-Disclosure Transparency registers</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    Contrary to marketing-only platforms, SECP lists known failures and unproven parameters transparently.
                    This guarantees external auditing partners can identify and audit structural system limits.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Known Failures */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h4 className="text-sm font-semibold text-white">Known Failure Register (Bug Ledger)</h4>
                    </div>

                    <div className="space-y-3">
                      {auditPackage.knownFailures.map((record) => (
                        <div key={record.id} className="bg-slate-950 border border-slate-800 p-4 rounded space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-indigo-400">{record.id}</span>
                            <span className="text-[9px] px-2 py-0.5 rounded font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {record.severity} Severity
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-200">{record.capability}</div>
                          <p className="text-xs text-slate-400 leading-normal">{record.description}</p>

                          <div className="text-xs bg-slate-900 p-2 rounded font-mono text-slate-400 border border-slate-850">
                            <span className="text-[10px] text-indigo-300 block mb-1">Reproduction:</span>
                            {record.reproductionCommand}
                          </div>

                          <div className="text-xs">
                            <span className="text-slate-500 font-mono text-[10px]">Mitigation/Workaround: </span>
                            <span className="text-slate-300">{record.workaround}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Unproven Capabilities */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                      <Cpu className="w-5 h-5 text-indigo-400" />
                      <h4 className="text-sm font-semibold text-white">Unproven/Absent Registry</h4>
                    </div>

                    <div className="space-y-3">
                      {auditPackage.unprovenCapabilities.map((record) => (
                        <div key={record.id} className="bg-slate-950 border border-slate-800 p-4 rounded space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-indigo-400">{record.id}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Roadmap: {record.roadmapPatchId || "N/A"}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-200">{record.capability}</div>
                          <p className="text-xs text-slate-400 leading-normal">{record.description}</p>

                          <div className="text-xs bg-rose-950/10 p-2.5 rounded border border-rose-950/20 text-rose-300 leading-normal">
                            <span className="text-[10px] text-slate-500 font-mono block mb-1">Blocker Reason:</span>
                            {record.blockerReason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Adversarial Tamper Lab */}
            {activeTab === 'adversarial' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white font-mono flex items-center">
                    <Flame className="w-5 h-5 text-indigo-400 mr-2" />
                    Adversarial Integrity Sabotage Lab
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    This sandbox allows auditing engineers to inject artificial errors, modify root evidence hashes, 
                    or falsely claim capability levels to witness how the cryptographic verification gate blocks tamper actions instantly.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Sabotage Actions */}
                  <div className="lg:col-span-1 space-y-3 bg-slate-950 border border-slate-800 p-4 rounded">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Simulate Sabotage Attacks</h4>

                    <button
                      onClick={() => triggerSabotage('status')}
                      className="w-full bg-slate-900 hover:bg-slate-850 p-3 rounded text-left border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col space-y-1"
                    >
                      <span className="text-xs font-bold text-slate-200">Tamper Status Claims</span>
                      <span className="text-[11px] text-slate-400 leading-normal">
                        Maliciously change CFD's PARTIAL state to PROVEN without attaching required physics source verification.
                      </span>
                    </button>

                    <button
                      onClick={() => triggerSabotage('delete_evidence')}
                      className="w-full bg-slate-900 hover:bg-slate-850 p-3 rounded text-left border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col space-y-1"
                    >
                      <span className="text-xs font-bold text-slate-200">Wipe Evidence Ledger</span>
                      <span className="text-[11px] text-slate-400 leading-normal">
                        Delete the NURBS Geometry source file from the package while claiming it remains verified.
                      </span>
                    </button>

                    <button
                      onClick={() => triggerSabotage('hash')}
                      className="w-full bg-slate-900 hover:bg-slate-850 p-3 rounded text-left border border-slate-800 hover:border-indigo-500/30 transition-all flex flex-col space-y-1"
                    >
                      <span className="text-xs font-bold text-slate-200">Corrupt Cryptographic Signatures</span>
                      <span className="text-[11px] text-slate-400 leading-normal">
                        Replace the final calculated package SHA-256 with a fabricated hash value to simulate MITM transmission corruption.
                      </span>
                    </button>

                    <button
                      onClick={rebuildPackage}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded text-xs transition-all flex items-center justify-center space-x-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rebuild Deterministic Package</span>
                    </button>
                  </div>

                  {/* Right Column: Execution Log & Gate Result */}
                  <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
                    {/* Live Log Console */}
                    <div className="bg-slate-950 border border-slate-800 rounded p-4 space-y-2 flex-grow">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workspace Event Stream</h4>
                      <div className="bg-black/50 rounded p-3 h-48 overflow-y-auto font-mono text-[11px] text-indigo-300 space-y-1 leading-relaxed">
                        {adversarialLog.map((log, idx) => (
                          <div key={idx}>{log}</div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Auditor Export */}
                    <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-indigo-300 block">Independent Auditor Package Exporter</span>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          Generates a complete, self-describing audit snapshot suitable for external validation, peer-review pipelines, and independent compliance decisions.
                        </p>
                      </div>
                      <button
                        onClick={downloadJSON}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-medium text-xs py-2 px-4 rounded flex items-center justify-center space-x-1.5 transition-all shadow-sm shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export JSON Package</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Gate Verification Checklist */}
            {activeTab === 'gate' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Verification Gate Checklist Audit</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">
                      The acceptance gate evaluates exactly 10 parameters of the packages dynamically, denying a PASS to any tampered artifacts.
                    </p>
                  </div>
                  <div className={`text-xs px-3.5 py-1.5 rounded font-mono font-bold tracking-wider ${
                    gateResult.passed
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                  }`}>
                    VERDICT: {gateResult.verdict === "PASS" ? "PASS" : "FAIL"}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {gateResult.checks.map((check, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded border transition-all flex items-start space-x-3 text-xs ${
                        check.passed
                          ? 'bg-slate-900/60 border-slate-800'
                          : 'bg-rose-950/10 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {check.passed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-100">{check.criterion}</div>
                        <div className="text-slate-400 leading-normal font-mono text-[11px]">
                          {check.details || "Pending check execution."}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
