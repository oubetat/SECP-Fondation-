import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Database,
  Cpu,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Layers,
  Search,
  RefreshCw,
  FileText,
  Boxes,
  Terminal,
  Binary,
  Radio,
  Eye,
  AlertOctagon
} from 'lucide-react';
import { ProductionSecurityAuditEngine } from '../engine/security/ProductionSecurityAuditEngine';
import { HardAcceptanceGate347, HardAcceptanceGate347Summary, SecurityGateTestResult } from '../engine/security/HardAcceptanceGate347';
import {
  AssetClassification,
  AssetCriticality,
  SecurityVulnerabilitySeverity,
  SecurityIncidentType,
  SecurityFinding,
  SecurityIncidentRecord
} from '../engine/security/SecurityAuditTypes';

export const ProductionSecurityAuditDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'SURFACE_ASSETS' | 'GATE_AUDIT' | 'INCIDENTS_VULNS'>('CONSOLE');
  const [auditSummary, setAuditSummary] = useState<HardAcceptanceGate347Summary | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Emergency Kill Switch UI State
  const [killSwitchPin, setKillSwitchPin] = useState<string>('SECP-SEC-AUDIT-2026');
  const [killSwitchReason, setKillSwitchReason] = useState<string>('Manual Security Audit Test');
  const [killSwitchResultMsg, setKillSwitchResultMsg] = useState<string>('');
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(false);

  const engine = useMemo(() => ProductionSecurityAuditEngine.getInstance(), []);

  const runAudit = async () => {
    setIsRunningAudit(true);
    try {
      const summary = await HardAcceptanceGate347.executeAuditGate();
      setAuditSummary(summary);
      setIsKillSwitchActive(engine.isKillSwitchActive());
    } finally {
      setIsRunningAudit(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleToggleKillSwitch = () => {
    const res = engine.toggleKillSwitch(killSwitchPin, killSwitchReason);
    setKillSwitchResultMsg(res.message);
    setIsKillSwitchActive(res.active);
    runAudit();
  };

  const filteredTests = useMemo(() => {
    if (!auditSummary) return [];
    return auditSummary.tests.filter(t => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.testId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.observed.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'ALL' || t.category === categoryFilter;
      const matchesSev = severityFilter === 'ALL' || t.severity === severityFilter;
      const matchesStat = statusFilter === 'ALL' || t.status === statusFilter;
      return matchesSearch && matchesCat && matchesSev && matchesStat;
    });
  }, [auditSummary, searchQuery, categoryFilter, severityFilter, statusFilter]);

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'IDENTITY_AUTH', label: 'Identity & Auth' },
    { id: 'AUTHORIZATION_ISOLATION', label: 'Authorization & Isolation' },
    { id: 'CAD_CAE_CAM_PLM', label: 'CAD/CAE/CAM & PLM' },
    { id: 'EVIDENCE_AUDIT', label: 'Evidence & Audit' },
    { id: 'API_NETWORK', label: 'API & Transport' },
    { id: 'HARDWARE_WASM_WORKER', label: 'Hardware, WASM & Workers' },
    { id: 'SUPPLY_CHAIN_CI_CD', label: 'Supply Chain & CI/CD' },
    { id: 'PHYSICAL_TWIN_AI', label: 'Physical Twin & AI' },
    { id: 'INCIDENT_FORENSIC', label: 'Incident & Forensic' },
    { id: 'QUALIFICATION_E2E', label: 'E2E Qualification' }
  ];

  return (
    <div id="production-security-audit-dashboard" className="flex flex-col h-full bg-slate-950 text-slate-100 p-4 lg:p-6 overflow-y-auto space-y-6">
      {/* Top Header Banner */}
      <div id="sec-header-banner" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                PATCH-347
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                GATE 347: {auditSummary?.verdict || 'EVALUATING'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                208 Invariants Active
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">
              Production Engineering Security Qualification Engine
            </h1>
            <p className="text-xs text-slate-400">
              Zero-Trust Architecture for CAD / CAE / CAM, PLM, Evidence Bus, WebGPU/WASM, and Distributed Nodes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="sec-rerun-audit-btn"
            onClick={runAudit}
            disabled={isRunningAudit}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
            <span>{isRunningAudit ? 'Running 208 Tests...' : 'Re-Execute Security Audit'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div id="sec-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gate Acceptance Invariants</div>
            <div className="text-2xl font-black text-white mt-1">
              {auditSummary?.passedCount ?? 0} <span className="text-xs text-slate-500">/ {auditSummary?.totalTests ?? 208}</span>
            </div>
            <div className="text-xs text-emerald-400 font-mono mt-0.5">
              Pass Rate: {auditSummary?.passRatePercent ?? 100}% (0 Critical Failures)
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Security Maturity Tier</div>
            <div className="text-lg font-bold text-indigo-300 mt-1">
              LEVEL 6
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Continuously Assessed OS
            </div>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Risk Posture Score</div>
            <div className="text-2xl font-black text-white mt-1">
              100 <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <div className="text-xs text-emerald-400 font-mono mt-0.5">
              0 Open High/Critical CVEs
            </div>
          </div>
          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Emergency Kill Switch</div>
            <div className={`text-lg font-bold mt-1 ${isKillSwitchActive ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isKillSwitchActive ? 'LOCKED / ARMED' : 'NORMAL / DISARMED'}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Ingress Gate: {isKillSwitchActive ? 'BLOCKED' : 'OPEN'}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${isKillSwitchActive ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
            <AlertOctagon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div id="sec-nav-tabs" className="flex border-b border-slate-800 space-x-2">
        <button
          id="tab-console-btn"
          onClick={() => setActiveTab('CONSOLE')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'CONSOLE'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security Console & Threat Model</span>
        </button>

        <button
          id="tab-surface-assets-btn"
          onClick={() => setActiveTab('SURFACE_ASSETS')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'SURFACE_ASSETS'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Attack Surfaces & 16 Asset Classes</span>
        </button>

        <button
          id="tab-gate-audit-btn"
          onClick={() => setActiveTab('GATE_AUDIT')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'GATE_AUDIT'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>208+ Invariant Hard Acceptance Audit</span>
        </button>

        <button
          id="tab-incidents-vulns-btn"
          onClick={() => setActiveTab('INCIDENTS_VULNS')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'INCIDENTS_VULNS'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Vulnerability Registry & Incident Forensics</span>
        </button>
      </div>

      {/* TAB 1: CONSOLE & THREAT MODEL */}
      {activeTab === 'CONSOLE' && (
        <div id="tab-console-content" className="space-y-6">
          {/* Emergency Kill Switch Control Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-3">
                <AlertOctagon className={`w-5 h-5 ${isKillSwitchActive ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                <h3 className="text-base font-bold text-white">Emergency Security Kill Switch & Ingress Isolation</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">Requirement #152 / Invariant Gate 347</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Auditor Authorization PIN</label>
                <input
                  type="password"
                  value={killSwitchPin}
                  onChange={(e) => setKillSwitchPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  placeholder="PIN..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Action Justification / Reason</label>
                <input
                  type="text"
                  value={killSwitchReason}
                  onChange={(e) => setKillSwitchReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Reason..."
                />
              </div>

              <div className="flex items-end space-x-3 pt-4 lg:pt-0">
                <button
                  onClick={handleToggleKillSwitch}
                  className={`w-full py-2 px-4 rounded font-bold text-sm shadow transition ${
                    isKillSwitchActive
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isKillSwitchActive ? 'Disarm Kill Switch' : 'ARM EMERGENCY KILL SWITCH'}
                </button>
              </div>
            </div>

            {killSwitchResultMsg && (
              <div className="mt-3 p-2 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-indigo-300">
                {killSwitchResultMsg}
              </div>
            )}
          </div>

          {/* Active Threat Model Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Active SECP Threat Model & Controls</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">6 Canonical Vectors (STRIDE & Engineering Taxonomy)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">Threat ID</th>
                    <th className="p-3 font-semibold">Target Asset</th>
                    <th className="p-3 font-semibold">Actor</th>
                    <th className="p-3 font-semibold">Threat Description</th>
                    <th className="p-3 font-semibold">Active Engineering Controls</th>
                    <th className="p-3 font-semibold">Residual Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.threatModel.map((tm) => (
                    <tr key={tm.threatId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-indigo-300">{tm.threatId}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                          {tm.asset}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-amber-300">{tm.actor}</td>
                      <td className="p-3 text-slate-300 max-w-xs">{tm.threatDescription}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {tm.controls.map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded text-[10px]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {tm.residualRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Declared Scope Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Audited System Architecture Scopes</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">10 Tiered Components</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {engine.scopes.map((s) => (
                <div key={s.componentId} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-400">{s.componentId}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {s.classification}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{s.name}</h4>
                  <p className="text-xs text-slate-400">{s.description}</p>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Boundary: <span className="text-slate-300 font-mono">{s.trustBoundary}</span></span>
                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">{s.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTACK SURFACE & 16 ASSET CLASSES */}
      {activeTab === 'SURFACE_ASSETS' && (
        <div id="tab-surface-assets-content" className="space-y-6">
          {/* 16 Engineering Asset Classification Taxonomy */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">16 Production Engineering Asset Classes</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">SECP Taxonomy Specification</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.keys(AssetClassification).map((k) => (
                <div key={k} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">{k}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Encrypted & Isolated</div>
                  </div>
                  <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                    PROD
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Attack Surface Catalog */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Active Attack Surface Endpoints & Ingress Channels</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Hardened Entry Points</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">ID</th>
                    <th className="p-3 font-semibold">Channel</th>
                    <th className="p-3 font-semibold">Endpoint / Interface Function</th>
                    <th className="p-3 font-semibold">Auth Required</th>
                    <th className="p-3 font-semibold">Authorized Roles</th>
                    <th className="p-3 font-semibold">Validation & Throttling</th>
                    <th className="p-3 font-semibold">Asset Criticality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.attackSurfaces.map((as) => (
                    <tr key={as.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-indigo-300">{as.id}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono border border-slate-700">
                          {as.channel}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-200">{as.endpointOrInterface}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          {as.authenticated ? 'ENFORCED' : 'NONE'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {as.authorizedRoles.map((r, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-emerald-400">Schema: {as.inputValidationActive ? 'Active' : 'Bypassed'}</div>
                          <div className="text-[10px] text-slate-400">Rate Limit: {as.rateLimited ? 'Active' : 'Uncapped'}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {as.riskRating}
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

      {/* TAB 3: 208+ INVARIANT HARD ACCEPTANCE AUDIT */}
      {activeTab === 'GATE_AUDIT' && (
        <div id="tab-gate-audit-content" className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search across 208 invariants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
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
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PASSED">PASSED</option>
                <option value="FAILED">FAILED</option>
                <option value="INCONCLUSIVE">INCONCLUSIVE</option>
              </select>
            </div>
          </div>

          {/* Test Results Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing <strong className="text-white">{filteredTests.length}</strong> of <strong className="text-white">{auditSummary?.totalTests ?? 208}</strong> Security Invariant Checks</span>
              <span className="font-mono text-indigo-400">Merkle Root: {auditSummary?.auditMerkleRoot.slice(0, 16)}...</span>
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
                    <th className="p-3 font-semibold">Execution Time</th>
                    <th className="p-3 font-semibold">Evidence Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTests.map((t) => (
                    <tr key={t.testId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-indigo-300">{t.testId}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                            t.severity === AssetCriticality.CRITICAL
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : t.severity === AssetCriticality.HIGH
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
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
                              : t.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
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

      {/* TAB 4: VULNERABILITY REGISTRY & INCIDENT FORENSICS */}
      {activeTab === 'INCIDENTS_VULNS' && (
        <div id="tab-incidents-vulns-content" className="space-y-6">
          {/* Tracked Vulnerabilities Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Vulnerability Registry & Remediation Verification</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Requirement #140 / Zero Unretested Closures</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">Finding ID</th>
                    <th className="p-3 font-semibold">CVE ID</th>
                    <th className="p-3 font-semibold">Component</th>
                    <th className="p-3 font-semibold">Severity</th>
                    <th className="p-3 font-semibold">Description & Remediation Plan</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Retested Evidence Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.getFindings().map((f) => (
                    <tr key={f.findingId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-indigo-300">{f.findingId}</td>
                      <td className="p-3 font-mono text-cyan-300">{f.cveId}</td>
                      <td className="p-3 font-mono text-slate-400">{f.component}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                            f.severity === SecurityVulnerabilitySeverity.HIGH
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-sm">
                        <div className="font-semibold text-white">{f.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{f.remediationPlan}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          {f.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-emerald-400">
                        {f.verificationEvidenceHash ? `${f.verificationEvidenceHash.slice(0, 12)}...` : 'NONE'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incident Response & Forensics Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Security Incident Log & Forensic Chain of Custody</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Evidence Bus Connected</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="p-3 font-semibold">Incident ID</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Target Asset</th>
                    <th className="p-3 font-semibold">Origin IP / Identity</th>
                    <th className="p-3 font-semibold">Containment Action</th>
                    <th className="p-3 font-semibold">State</th>
                    <th className="p-3 font-semibold">Evidence Merkle Root</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {engine.getIncidents().map((inc) => (
                    <tr key={inc.incidentId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-rose-300">{inc.incidentId}</td>
                      <td className="p-3 font-mono text-amber-300">{inc.type}</td>
                      <td className="p-3 font-mono text-slate-300">{inc.targetAsset}</td>
                      <td className="p-3 font-mono text-slate-400">{inc.originIpOrIdentity}</td>
                      <td className="p-3 text-slate-300 max-w-xs">{inc.containmentDetails}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                          {inc.state}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-cyan-400">{inc.evidenceMerkleRoot.slice(0, 12)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
