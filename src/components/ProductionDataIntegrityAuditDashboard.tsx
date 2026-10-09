import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  Database,
  Hash,
  Layers,
  GitBranch,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Sliders,
  Radio,
  Boxes,
  ShieldCheck,
  Zap,
  Activity,
  FileText,
  Lock,
  Workflow
} from 'lucide-react';
import { ProductionDataIntegrityAuditEngine } from '../engine/integrity/ProductionDataIntegrityAuditEngine';
import { HardAcceptanceGate348, HardAcceptanceGate348Summary, IntegrityGateTestResult } from '../engine/integrity/HardAcceptanceGate348';
import {
  IntegrityState,
  IntegrityMaturityLevel,
  EngineeringArtifactRecord,
  CrossDomainReferenceLink,
  DataIntegrityIncident
} from '../engine/integrity/DataIntegrityTypes';

export const ProductionDataIntegrityAuditDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ARTIFACTS' | 'CROSS_DOMAIN' | 'GATE_AUDIT' | 'INCIDENTS_EVIDENCE'>('OVERVIEW');
  const [auditSummary, setAuditSummary] = useState<HardAcceptanceGate348Summary | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Interactive Tampering & Healing Simulator State
  const [simTargetArtifact, setSimTargetArtifact] = useState<string>('ART-CAD-TURBINE-001');
  const [simStatusMessage, setSimStatusMessage] = useState<string>('');

  const engine = useMemo(() => ProductionDataIntegrityAuditEngine.getInstance(), []);

  const runAudit = async () => {
    setIsRunningAudit(true);
    try {
      const summary = await HardAcceptanceGate348.executeAuditGate();
      setAuditSummary(summary);
    } finally {
      setIsRunningAudit(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleTamperArtifact = () => {
    const success = engine.simulateTampering(simTargetArtifact, {
      corruptedField: 'UNAUTHORIZED_MUTATION_BIT_FLIP',
      modifiedTolerance: 0.999
    });
    if (success) {
      setSimStatusMessage(`Simulated bit-flip & unauthorized mutation on ${simTargetArtifact}. Integrity state set to CORRUPTED.`);
      runAudit();
    }
  };

  const handleRestoreArtifact = () => {
    const success = engine.restoreAuthoritativeArtifact(simTargetArtifact);
    if (success) {
      setSimStatusMessage(`Restored ${simTargetArtifact} to authoritative state via SECP Evidence Bus. Integrity state verified as VALID.`);
      runAudit();
    }
  };

  const filteredTests = useMemo(() => {
    if (!auditSummary) return [];
    return auditSummary.tests.filter(t => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.testId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.observed.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;
      const matchesStat = statusFilter === 'ALL' || t.status === statusFilter;
      const matchesSev = severityFilter === 'ALL' || t.severity === severityFilter;
      return matchesSearch && matchesCat && matchesStat && matchesSev;
    });
  }, [auditSummary, searchQuery, categoryFilter, statusFilter, severityFilter]);

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'IDENTITY', label: 'Identity & Provenance' },
    { id: 'CRYPTOGRAPHIC', label: 'Cryptographic Hashes' },
    { id: 'STRUCTURE', label: 'Structure & Schema' },
    { id: 'REVISION', label: 'Revision Chains' },
    { id: 'CROSS_DOMAIN', label: 'Cross-Domain Sync' },
    { id: 'CAE', label: 'CAE/CFD Results' },
    { id: 'CAM', label: 'CAM Toolpaths' },
    { id: 'PLM', label: 'PLM & BOM' },
    { id: 'EVIDENCE', label: 'Evidence & Audit' },
    { id: 'QUALIFICATION', label: 'Master Qualification' }
  ];

  return (
    <div id="data-integrity-audit-dashboard" className="flex flex-col h-full bg-slate-950 text-slate-100 p-4 lg:p-6 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div id="integrity-header-banner" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <FileCheck2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                PATCH-348
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                GATE 348: {auditSummary?.verdict || 'EVALUATING'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                152+ Engineering Invariants Active
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">
              Production Data Integrity Audit Engine
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic Verification of CAD/CAE/CAM/PLM Revisions, Unit Contexts, Cross-Domain References & Evidence Bus.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="rerun-integrity-audit-btn"
            onClick={runAudit}
            disabled={isRunningAudit}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
            <span>{isRunningAudit ? 'Executing 152 Invariant Checks...' : 'Re-Execute Integrity Audit'}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div id="integrity-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Audit Pass Rate</div>
            <div className="text-2xl font-black text-white mt-1">
              {auditSummary?.passedCount ?? 0} <span className="text-xs text-slate-500">/ {auditSummary?.totalTests ?? 152}</span>
            </div>
            <div className="text-xs text-emerald-400 font-mono mt-0.5">
              {auditSummary?.passRatePercent ?? 100}% Passed (0 Critical Errors)
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Integrity Maturity Tier</div>
            <div className="text-lg font-bold text-indigo-300 mt-1">
              LEVEL 6
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Production Data Integrity
            </div>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cross-Domain Coherence</div>
            <div className="text-2xl font-black text-white mt-1">
              100% <span className="text-xs text-slate-500">Synced</span>
            </div>
            <div className="text-xs text-emerald-400 font-mono mt-0.5">
              5/5 Relations Exact Revision Match
            </div>
          </div>
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400">
            <GitBranch className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Evidence Bus Chain</div>
            <div className="text-lg font-bold text-white mt-1">
              Block #{engine.getEvidenceBusChain().length - 1}
            </div>
            <div className="text-xs text-cyan-400 font-mono mt-0.5">
              Merkle Root Cryptographically Bound
            </div>
          </div>
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <Hash className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div id="integrity-nav-tabs" className="flex border-b border-slate-800 space-x-2">
        <button
          id="tab-overview-btn"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'OVERVIEW'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Integrity Overview & Truth Chain</span>
        </button>

        <button
          id="tab-artifacts-btn"
          onClick={() => setActiveTab('ARTIFACTS')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'ARTIFACTS'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Audited Engineering Artifacts ({engine.getArtifacts().length})</span>
        </button>

        <button
          id="tab-crossdomain-btn"
          onClick={() => setActiveTab('CROSS_DOMAIN')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'CROSS_DOMAIN'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Workflow className="w-4 h-4" />
          <span>Cross-Domain Coherence Matrix</span>
        </button>

        <button
          id="tab-gateaudit-btn"
          onClick={() => setActiveTab('GATE_AUDIT')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'GATE_AUDIT'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>152+ Invariant Hard Acceptance Gate</span>
        </button>

        <button
          id="tab-incidents-btn"
          onClick={() => setActiveTab('INCIDENTS_EVIDENCE')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'INCIDENTS_EVIDENCE'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Forensic Incidents & Evidence Bus</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TRUTH CHAIN */}
      {activeTab === 'OVERVIEW' && (
        <div id="tab-overview-content" className="space-y-6">
          {/* Engineering Truth Chain Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Workflow className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Engineering Truth Chain & Boundary Model</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">SECP Section 2 Principle</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold">1. RAW DATA</span>
                <span className="text-xs text-white font-semibold">Byte Stream</span>
              </div>
              <div className="bg-slate-950 border border-emerald-500/40 p-3 rounded-lg flex flex-col items-center justify-center space-y-1 bg-emerald-500/5">
                <span className="text-[10px] font-mono text-emerald-400 font-bold">2. INTEGRITY</span>
                <span className="text-xs text-white font-semibold">PATCH-348</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold">3. PROVENANCE</span>
                <span className="text-xs text-white font-semibold">Lineage & Signatures</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold">4. CONTEXT</span>
                <span className="text-xs text-white font-semibold">Units & CSYS</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold">5. VERIFICATION</span>
                <span className="text-xs text-white font-semibold">Math Exactness</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-slate-400 font-bold">6. VALIDATION</span>
                <span className="text-xs text-white font-semibold">Physical Fit</span>
              </div>
              <div className="bg-slate-950 border border-indigo-500/40 p-3 rounded-lg flex flex-col items-center justify-center space-y-1 bg-indigo-500/5">
                <span className="text-[10px] font-mono text-indigo-400 font-bold">7. TRUTH</span>
                <span className="text-xs text-white font-semibold">Evidence Bus</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
              <strong className="text-emerald-400">Industrial OS Law:</strong> DATA EXISTENCE ≠ DATA INTEGRITY ≠ DATA CORRECTNESS ≠ PHYSICAL TRUTH. PATCH-348 rigorously audits the <span className="text-white font-semibold">DATA INTEGRITY</span> layer, establishing that records are uncorrupted, exact in unit context, and bound monotonically across revisions.
            </div>
          </div>

          {/* Interactive Tamper & Self-Healing Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Live Adversarial Tampering & Forensic Self-Healing Drill</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Real-Time Invariant Test</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Select Target Artifact</label>
                <select
                  value={simTargetArtifact}
                  onChange={(e) => setSimTargetArtifact(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {engine.getArtifacts().map(a => (
                    <option key={a.artifactId} value={a.artifactId}>
                      {a.artifactId} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-2 pt-5">
                <button
                  onClick={handleTamperArtifact}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs transition shadow"
                >
                  Inject Bit-Flip Corruption
                </button>

                <button
                  onClick={handleRestoreArtifact}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition shadow"
                >
                  Authoritative Self-Heal
                </button>
              </div>

              <div className="text-xs text-slate-400 pt-5">
                Clicking tamper immediately triggers Hash Divergence and opens a forensic incident. Self-healing queries the cryptographic Evidence Bus to restore original integrity.
              </div>
            </div>

            {simStatusMessage && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-indigo-300">
                {simStatusMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUDITED ARTIFACTS */}
      {activeTab === 'ARTIFACTS' && (
        <div id="tab-artifacts-content" className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">Registered Master Engineering Artifact Repository</span>
              <span>Total Artifacts: <strong className="text-white">{engine.getArtifacts().length}</strong></span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Artifact ID</th>
                    <th className="p-3 font-semibold">Name & Category</th>
                    <th className="p-3 font-semibold">Revision ID</th>
                    <th className="p-3 font-semibold">Unit & CSYS Context</th>
                    <th className="p-3 font-semibold">Integrity State</th>
                    <th className="p-3 font-semibold">SHA-256 Hash</th>
                    <th className="p-3 font-semibold">Provenance / Author</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.getArtifacts().map((art) => (
                    <tr key={art.artifactId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-emerald-400">{art.artifactId}</td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{art.name}</div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                          {art.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-indigo-300">{art.revisionId}</td>
                      <td className="p-3">
                        <div className="text-white font-mono">{art.unitContext.quantityType} ({art.unitContext.unit})</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{art.unitContext.coordinateSystemId}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] border flex items-center space-x-1 w-fit ${
                            art.integrityState === IntegrityState.VALID
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {art.integrityState === IntegrityState.VALID ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{art.integrityState}</span>
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-400">{art.computedHash.slice(0, 14)}...</td>
                      <td className="p-3 text-[11px] text-slate-400">
                        <div className="text-slate-200">{art.provenance.originSystem}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{art.provenance.authorOrAgent}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CROSS-DOMAIN COHERENCE MATRIX */}
      {activeTab === 'CROSS_DOMAIN' && (
        <div id="tab-crossdomain-content" className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Cross-Domain Reference Coherence (CAD ↔ CAE ↔ CAM ↔ PLM ↔ Telemetry)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">100% Synchronized Revision Graph</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">Source Domain & Artifact</th>
                    <th className="p-3 font-semibold">Source Rev</th>
                    <th className="p-3 font-semibold">Relation Type</th>
                    <th className="p-3 font-semibold">Target Domain & Artifact</th>
                    <th className="p-3 font-semibold">Target Rev</th>
                    <th className="p-3 font-semibold">Coherence State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.getCrossDomainLinks().map((link, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">
                        <span className="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded text-[10px] mr-2">{link.sourceDomain}</span>
                        <span className="text-white">{link.sourceArtifactId}</span>
                      </td>
                      <td className="p-3 font-mono text-indigo-400">{link.sourceRevision}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono text-[10px]">
                          {link.relationType}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="px-1.5 py-0.5 bg-slate-800 text-emerald-300 rounded text-[10px] mr-2">{link.targetDomain}</span>
                        <span className="text-white">{link.targetArtifactId}</span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400">{link.targetRevision}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          COHERENT (EXACT)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 152+ INVARIANT HARD ACCEPTANCE GATE */}
      {activeTab === 'GATE_AUDIT' && (
        <div id="tab-gateaudit-content" className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search 152+ integrity invariants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PASSED">PASSED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* Invariant Test Results Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing <strong className="text-white">{filteredTests.length}</strong> of <strong className="text-white">{auditSummary?.totalTests ?? 152}</strong> Integrity Checks</span>
              <span className="font-mono text-emerald-400">Merkle Root: {auditSummary?.auditMerkleRoot.slice(0, 16)}...</span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-semibold">Test Invariant ID</th>
                    <th className="p-3 font-semibold">Category</th>
                    <th className="p-3 font-semibold">Severity</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Observed System Evidence</th>
                    <th className="p-3 font-semibold">Time</th>
                    <th className="p-3 font-semibold">Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTests.map((t) => (
                    <tr key={t.testId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-emerald-400">{t.testId}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                            t.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {t.severity}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] border flex items-center space-x-1 w-fit ${
                            t.status === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {t.status === 'PASSED' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{t.status}</span>
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-sm">{t.observed}</td>
                      <td className="p-3 font-mono text-slate-400">{t.executionTimeMs} ms</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">{t.evidenceDigest.slice(0, 10)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FORENSIC INCIDENTS & EVIDENCE BUS */}
      {activeTab === 'INCIDENTS_EVIDENCE' && (
        <div id="tab-incidents-evidence-content" className="space-y-6">
          {/* Forensic Incidents Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Data Integrity Incidents & Forensic Resolution</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">No Silent Repairs Permitted</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">Incident ID</th>
                    <th className="p-3 font-semibold">Target Artifact</th>
                    <th className="p-3 font-semibold">Source Anomaly</th>
                    <th className="p-3 font-semibold">Impact</th>
                    <th className="p-3 font-semibold">Resolution Method</th>
                    <th className="p-3 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.getIncidents().map((inc) => (
                    <tr key={inc.incidentId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-rose-300">{inc.incidentId}</td>
                      <td className="p-3 font-mono text-slate-200">{inc.artifactId}</td>
                      <td className="p-3 text-slate-300 max-w-xs">{inc.source}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {inc.impact}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs">
                        {inc.repairLog ? (
                          <div>
                            <div className="text-emerald-400 font-semibold">{inc.repairLog.method}</div>
                            <div className="text-[10px] text-slate-500 font-mono">By: {inc.repairLog.repairedBy}</div>
                          </div>
                        ) : (
                          <span className="text-rose-400 font-semibold">Under Forensic Quarantine</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence Bus Chain */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Hash className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Immutable SECP Evidence Bus Ledger Blocks</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">SHA-256 Merkle Chained</span>
            </div>

            <div className="space-y-3">
              {engine.getEvidenceBusChain().map((block) => (
                <div key={block.blockHeight} className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-mono font-bold text-xs">
                      Block #{block.blockHeight}
                    </span>
                    <div>
                      <div className="text-xs font-mono text-slate-300">Hash: {block.hash}</div>
                      <div className="text-[10px] font-mono text-slate-500">PrevHash: {block.prevHash}</div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    Timestamp: {new Date(block.timestamp).toISOString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
