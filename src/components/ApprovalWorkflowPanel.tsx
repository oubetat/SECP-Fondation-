import React, { useState, useEffect } from 'react';
import { 
  ApprovalWorkflowEngine, 
  ApprovalWorkflow, 
  ApprovalStep, 
  WorkflowStatus, 
  StepStatus, 
  ApproverRole 
} from '../engine/revision/ApprovalWorkflowEngine';
import { HardAcceptanceGate291 } from '../engine/revision/HardAcceptanceGate291';
import { EngineeringHashChain } from '../engine/evidence/EngineeringHashChain';
import { ShieldCheck, Users, Activity, CheckCircle2, XCircle, AlertTriangle, Clock, Plus, Cpu, Lock, Share2, Compass, TrendingUp, UserCheck, GitMerge, Calendar, Layers, FileSignature, Network, Sliders, FileCode, Sparkles, RefreshCw, Search, Filter, CheckCircle, AlertCircle } from 'lucide-react';

export function ApprovalWorkflowPanel() {
  const [engine] = useState(() => new ApprovalWorkflowEngine());
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // User Context Session
  const [currentUser, setCurrentUser] = useState<string>('LEAD_INTEGRATOR');

  // New Workflow Proposal
  const [newObjectId, setNewObjectId] = useState<string>('ECO-2026-000001');
  const [newObjectType, setNewObjectType] = useState<'ECO' | 'REVISION' | 'CHANGE'>('ECO');
  const [newRiskScore, setNewRiskScore] = useState<number>(75);
  const [newType, setNewType] = useState<any>('ECO_APPROVAL');

  // Sign-off Actions
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'>('APPROVE');
  const [comment, setComment] = useState<string>('');

  // Delegation state
  const [delegateTarget, setDelegateTarget] = useState<string>('QUALITY_DELEGATE');
  const [delegateRole, setDelegateRole] = useState<ApproverRole>('QUALITY_LEAD');
  const [delegateReason, setDelegateReason] = useState<string>('Standard out of office contingency');

  // Interactive Regression Matrix
  const [testReportPassed, setTestReportPassed] = useState<boolean | null>(null);
  const [testReportChecks, setTestReportChecks] = useState<any[]>([]);

  // Simulation parameters
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [simRisk, setSimRisk] = useState<number>(45);

  const refreshState = () => {
    const list = engine.getAllWorkflows();
    setWorkflows(list);
    if (list.length > 0 && !selectedWorkflowId) {
      setSelectedWorkflowId(list[0].workflowId);
    }
  };

  useEffect(() => {
    refreshState();
  }, [engine]);

  const selectedWorkflow = workflows.find(w => w.workflowId === selectedWorkflowId);

  // Submissions
  const handleCreateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const canonicalHashResult = EngineeringHashChain.computeCanonicalHash({
        objectId: newObjectId,
        objectType: newObjectType,
        type: newType,
        riskScore: newRiskScore,
        creator: currentUser,
        count: workflows.length
      });
      const generatedId = `WF-${(canonicalHashResult?.canonicalHash || 'HASH00000000').substring(0, 8).toUpperCase()}`;
      const canonicalHash = canonicalHashResult.canonicalHash;

      engine.createWorkflow(
        generatedId,
        newType,
        newObjectId,
        newObjectType,
        currentUser,
        newRiskScore,
        canonicalHash
      );

      setNewObjectId('');
      setSelectedWorkflowId(generatedId);
      setFeedback(`New secure approval workflow ${generatedId} created and locked to active object state hash.`);
      refreshState();
    } catch (err: any) {
      alert(`Workflow initiation error: ${err.message}`);
    }
  };

  const handleSubmitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkflow || !selectedStepId) return;

    try {
      engine.submitDecision(
        selectedWorkflow.workflowId,
        selectedStepId,
        currentUser,
        selectedWorkflow.steps.find(s => s.stepId === selectedStepId)!.role,
        decision,
        comment || 'Verified target revision attributes.',
        selectedWorkflow.objectHashSnapshot
      );

      setComment('');
      setFeedback(`Sign-off registered successfully! Cycle verification status updated.`);
      refreshState();
    } catch (err: any) {
      alert(`Decision blocked by engine policy rule: ${err.message}`);
    }
  };

  const handleCreateDelegation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkflow) return;
    try {
      engine.addDelegation(
        selectedWorkflow.workflowId,
        currentUser,
        delegateTarget,
        delegateRole,
        delegateReason
      );
      setFeedback(`Delegation parameters securely written into Audit trail context.`);
      refreshState();
    } catch (err: any) {
      alert(`Delegation error: ${err.message}`);
    }
  };

  const handleReworkTrigger = () => {
    if (!selectedWorkflow) return;
    try {
      const newSeed = `${selectedWorkflow.objectHashSnapshot}-REV-${selectedWorkflow.cycleNumber + 1}`;
      const nextHash = Array.from(newSeed)
        .reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0)
        .toString(16);

      engine.triggerReworkCycle(selectedWorkflow.workflowId, currentUser, nextHash);
      setFeedback(`Rework cycle triggered. All step statuses reset for Cycle ${selectedWorkflow.cycleNumber + 1}.`);
      refreshState();
    } catch (err: any) {
      alert(`Rework trigger blocked: ${err.message}`);
    }
  };

  const handleRunGateTests = () => {
    const report = HardAcceptanceGate291.evaluate();
    setTestReportPassed(report.passed);
    setTestReportChecks(report.checks);
  };

  // Metrics computing from real events
  const totalActive = workflows.filter(w => w.status === 'ACTIVE' || w.status === 'WAITING').length;
  const totalApproved = workflows.filter(w => w.status === 'COMPLETED' || w.status === 'APPROVED').length;
  const totalBlocked = workflows.filter(w => w.status === 'BLOCKED' || w.status === 'REJECTED').length;
  const totalStepsPending = workflows.reduce((sum, w) => sum + w.steps.filter(s => s.status === 'PENDING').length, 0);

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = w.workflowId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.objectId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          w.policyId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || w.workflowType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-6 text-slate-100 shadow-2xl space-y-8 max-w-7xl mx-auto" id="approval-workflow-panel">

      {/* 1. Brand Head & Gate Activator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-mono rounded">PATCH-291</span>
            <span className="text-slate-500 font-mono text-xs">/ GOVERNANCE &amp; QUALITY SIGN-OFF</span>
          </div>
          <h1 className="text-2xl font-light text-slate-100 tracking-tight mt-1">Multi-Level Approval Workflows</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Enforce multi-disciplinary reviews across Engineering, QA, and Safety structures. Secure target revision scopes against geometry drift, delegation limits, and self-approval conflicts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mock Actor Identity selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Identity context:</span>
            <select
              value={currentUser}
              onChange={e => {
                setCurrentUser(e.target.value);
                setFeedback(`User context switched to ${e.target.value}`);
              }}
              className="bg-slate-950 text-teal-400 font-semibold font-mono focus:outline-none cursor-pointer"
            >
              <option value="LEAD_INTEGRATOR">LEAD_INTEGRATOR (Lead Engineer)</option>
              <option value="QUALITY_LEAD">QUALITY_LEAD (QA Expert)</option>
              <option value="MFG_LEAD">MFG_LEAD (Mfg Director)</option>
              <option value="CHIEF_DESIGNER">CHIEF_DESIGNER (Chief Architect)</option>
              <option value="QUALITY_DELEGATE">QUALITY_DELEGATE (QA Delegate)</option>
              <option value="DESIGN_ENG_1">DESIGN_ENG_1 (Change Owner)</option>
            </select>
          </div>

          <button
            onClick={handleRunGateTests}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <Activity className="w-4 h-4 animate-pulse" />
            Validate Workflow Gate
          </button>
        </div>
      </div>

      {/* 2. Automated Regression Test Output */}
      {testReportPassed !== null && (
        <div className={`p-5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${testReportPassed ? 'bg-emerald-950/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/10 border-rose-500/30 text-rose-400'}`}>
          <div className="flex items-start gap-3">
            {testReportPassed ? <CheckCircle2 className="w-6 h-6 mt-0.5 flex-shrink-0 text-emerald-500" /> : <XCircle className="w-6 h-6 mt-0.5 flex-shrink-0 text-rose-500" />}
            <div>
              <h3 className="font-semibold text-lg">{testReportPassed ? 'Verification Gate Passed' : 'Verification Gate Failed'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Completed regression evaluations for dynamic policies, delegation lifespans, conflict warnings, and rework sequences.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono bg-slate-900/60 p-4 rounded border border-slate-800">
            {testReportChecks.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                {c.passed ? <span className="text-emerald-500 mt-0.5">✓</span> : <span className="text-rose-500 mt-0.5">✗</span>}
                <div>
                  <span className="text-slate-200 font-semibold">{c.name}</span>
                  <p className="text-[10px] text-slate-400">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Analytics & SLA Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Active Workflows</span>
            <div className="text-2xl font-bold font-mono text-teal-400 mt-0.5">{totalActive}</div>
          </div>
          <Activity className="w-8 h-8 text-teal-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Steps Pending Vote</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">{totalStepsPending}</div>
          </div>
          <Clock className="w-8 h-8 text-amber-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Blocked / Rejected</span>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-0.5">{totalBlocked}</div>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Fully Approved</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{totalApproved}</div>
          </div>
          <ShieldCheck className="w-8 h-8 text-emerald-500/20" />
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-teal-400 flex items-center gap-2">
          <Compass className="w-4 h-4 text-teal-500 flex-shrink-0 animate-spin" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 4. Main Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT BAR: List, Quick Filters & Proposal Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">

          {/* List Filtering */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-400" /> Filter Workflow Registry
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by ID, Object..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All States</option>
                  <option value="ACTIVE">Active</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Type</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="ECO_APPROVAL">ECO Approval</option>
                  <option value="CHANGE_APPROVAL">Change Request</option>
                  <option value="REVISION_APPROVAL">Revision Release</option>
                </select>
              </div>
            </div>
          </div>

          {/* Workflow Registry List */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" /> Active Workflow Pipelines
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredWorkflows.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-500">No active approval workflows in registry.</p>
                  <button
                    onClick={() => {
                      engine.loadDemoWorkflows();
                      refreshState();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold"
                  >
                    Load Demo Approval Workflow
                  </button>
                </div>
              ) : (
                filteredWorkflows.map(w => {
                  const isSelected = w.workflowId === selectedWorkflowId;
                  return (
                    <button
                      key={w.workflowId}
                      onClick={() => setSelectedWorkflowId(w.workflowId)}
                      className={`w-full text-left p-3.5 rounded-lg border transition text-xs font-mono flex flex-col gap-2 ${isSelected ? 'bg-teal-500/10 border-teal-500/45 text-slate-100' : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 text-slate-400'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            w.status === 'COMPLETED' ? 'bg-emerald-500' :
                            w.status === 'BLOCKED' ? 'bg-amber-500' :
                            w.status === 'REJECTED' ? 'bg-rose-500' : 'bg-teal-500 animate-pulse'
                          }`} />
                          {w.workflowId}
                        </span>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                          Policy: {w.policyId}
                        </span>
                      </div>
                      <div>
                        <p className="font-sans font-medium text-slate-300">Target Object: {w.objectId} ({w.objectType})</p>
                        <p className="text-[10px] text-slate-500 mt-1">Initiator: {w.requester}</p>
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 text-slate-500 border-t border-slate-900 pt-1.5">
                        <span>Status: <strong className="text-slate-300 font-semibold">{w.status}</strong></span>
                        <span>Cycle Loop: <strong className="text-slate-300">{w.cycleNumber}</strong></span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* New Workflow Proposal Forms */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-400" /> Initiate Secure Workflow
            </h2>

            <form onSubmit={handleCreateWorkflow} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Target Design Object ID</label>
                <input
                  type="text"
                  value={newObjectId}
                  onChange={e => setNewObjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none"
                  placeholder="e.g. ECO-2026-000001"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Object Type</label>
                  <select
                    value={newObjectType}
                    onChange={e => setNewObjectType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="ECO">ECO</option>
                    <option value="REVISION">REVISION</option>
                    <option value="CHANGE">CHANGE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Workflow Category</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="ECO_APPROVAL">ECO Approval</option>
                    <option value="CHANGE_APPROVAL">Change approval</option>
                    <option value="REVISION_APPROVAL">Revision level</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-400 font-medium">Assessed Risk Parameter Score ({newRiskScore}%)</label>
                  <span className={`text-[10px] font-bold px-1 rounded ${newRiskScore > 60 ? 'text-rose-400 bg-rose-500/10' : 'text-teal-400 bg-teal-500/10'}`}>
                    {newRiskScore > 60 ? 'HIGH RISK POLICY' : 'LOW RISK POLICY'}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={newRiskScore}
                  onChange={e => setNewRiskScore(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-200 font-semibold rounded tracking-wide transition font-mono"
              >
                Initiate Secure Channel
              </button>
            </form>
          </div>

        </div>

        {/* MIDDLE SECTION: Workflow Interactive Timeline, SLA status meters (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {selectedWorkflow ? (
            <>
              {/* Dynamic Interactive Timeline */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <Network className="w-4 h-4 text-teal-400" /> Parallel/Sequential Step Timeline
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500">
                    Cycle Loops: {selectedWorkflow.cycleNumber}
                  </span>
                </div>

                <div className="space-y-4">
                  {selectedWorkflow.steps.map((st, index) => {
                    const isPending = st.status === 'PENDING';
                    const isApproved = st.status === 'APPROVED';
                    const isRejected = st.status === 'REJECTED';
                    const isChanges = st.status === 'CHANGES_REQUESTED';

                    return (
                      <div key={st.stepId} className={`p-4 rounded-xl border transition ${
                        isApproved ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400' :
                        isRejected ? 'bg-rose-950/10 border-rose-500/20 text-rose-400' :
                        isChanges ? 'bg-amber-950/10 border-amber-500/20 text-amber-400' :
                        'bg-slate-950 border-slate-900 text-slate-300'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-slate-500 block uppercase">Step #{index+1} ({st.role})</span>
                            <h3 className="text-xs font-semibold text-slate-200">{st.name}</h3>
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                            isApproved ? 'bg-emerald-500/10 text-emerald-400' :
                            isRejected ? 'bg-rose-500/10 text-rose-400 font-bold' :
                            isChanges ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-900 text-slate-400 animate-pulse'
                          }`}>
                            {st.status}
                          </span>
                        </div>

                        {st.dependencies.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-mono mt-2">
                            Dependencies: <strong className="text-slate-400">{st.dependencies.join(', ')}</strong>
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-900/60 text-[11px]">
                          <span className="text-slate-500 font-mono">Assignee: {st.assignedApprover}</span>
                          {st.evidenceId && (
                            <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-teal-400 flex items-center gap-1">
                              <FileSignature className="w-3 h-3" />
                              {st.evidenceId}
                            </span>
                          )}
                        </div>

                        {st.comment && (
                          <div className="mt-2 text-[10px] bg-slate-900/40 p-2 rounded text-slate-400 italic">
                            Rationales: "{st.comment}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rework controls & Drift detection */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-400" /> Revision Drift Safeguard
                  </h2>
                  <span className="text-[9px] text-slate-500 font-mono">MD5 Snapshot</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3.5 text-xs">
                  <div className="flex justify-between font-mono text-[11px] text-slate-400">
                    <span>Baseline CAD Hash:</span>
                    <span className="text-teal-400 truncate max-w-[200px]" title={selectedWorkflow.objectHashSnapshot}>
                      {selectedWorkflow.objectHashSnapshot}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-normal">
                    If designers alter the core CAD file, blade parameters, or mesh parameters mid-flight, the verification snapshots will mismatch. The workflow engine immediately shifts into the `BLOCKED` status to prevent unverified promotions.
                  </p>

                  <div className="pt-2 border-t border-slate-900/60 flex justify-between gap-3">
                    <button
                      onClick={handleReworkTrigger}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-teal-400 rounded transition font-mono flex items-center gap-1.5 text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Trigger Rework Iteration
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center">
                      Auto-resets steps
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy configurations overview */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-3">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-400" /> Active Policy Configuration
                </h2>
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-900 text-xs font-mono space-y-2 text-slate-400">
                  <div className="flex justify-between">
                    <span>Policy Reference:</span>
                    <span className="text-slate-200 font-bold">{selectedWorkflow.policyId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Policy Version:</span>
                    <span className="text-slate-200">v{selectedWorkflow.policyVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Severity Limit:</span>
                    <span className="text-slate-200">{selectedWorkflow.riskScoreSnapshot > 60 ? 'CRITICAL' : 'MINOR'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unanimous Sign-off:</span>
                    <span className="text-teal-400">ENFORCED</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-850 rounded-xl">
              <Compass className="w-10 h-10 text-slate-600 mx-auto animate-spin" />
              <p className="text-xs text-slate-400 mt-3 font-mono">Select or propose an active workflow from the left panel.</p>
            </div>
          )}

        </div>

        {/* RIGHT SECTION: Signature Decision board, Delegation & Evidence Seal (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">

          {selectedWorkflow ? (
            <>
              {/* Form to submit step votes */}
              {selectedWorkflow.status === 'ACTIVE' && (
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-teal-400" /> Step Sign-off Board
                  </h2>

                  <form onSubmit={handleSubmitDecision} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Target step review</label>
                      <select
                        value={selectedStepId}
                        onChange={e => setSelectedStepId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs"
                        required
                      >
                        <option value="">-- Choose step --</option>
                        {selectedWorkflow.steps.map(s => (
                          <option key={s.stepId} value={s.stepId}>
                            {s.stepId} - {s.name} ({s.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Action Decision</label>
                      <select
                        value={decision}
                        onChange={e => setDecision(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs"
                      >
                        <option value="APPROVE">Approve Release</option>
                        <option value="REJECT">Reject (Closes Pipeline)</option>
                        <option value="REQUEST_CHANGES">Request Modification Rework</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Rationales / Reasons</label>
                      <textarea
                        placeholder="Define signoff rationale..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded transition animate-pulse font-mono text-xs"
                    >
                      Sign Off Vote
                    </button>
                  </form>
                </div>
              )}

              {/* Temporary Delegation Controls */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-400" /> Out-of-Office Delegation
                </h2>

                <form onSubmit={handleCreateDelegation} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Delegate User</label>
                    <input
                      type="text"
                      value={delegateTarget}
                      onChange={e => setDelegateTarget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Authorization Scope</label>
                    <select
                      value={delegateRole}
                      onChange={e => setDelegateRole(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300"
                    >
                      <option value="ENGINEERING_LEAD">Engineering lead</option>
                      <option value="QUALITY_LEAD">Quality lead</option>
                      <option value="MANUFACTURING_LEAD">Manufacturing lead</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Delegation Reason</label>
                    <input
                      type="text"
                      value={delegateReason}
                      onChange={e => setDelegateReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded transition font-mono"
                  >
                    Register Delegate
                  </button>
                </form>
              </div>

              {/* Manifest package exports */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-teal-400" /> Governance Verification Seal
                  </h2>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 text-[10px] font-mono space-y-2 text-slate-400 break-all">
                  <span className="text-slate-500 uppercase font-semibold text-[9px] block">Cryptographic Package SHA-256</span>
                  <div className="bg-slate-900 p-2 rounded text-teal-400">
                    {selectedWorkflow.integrityHash || '0x4d8a1c9ef8902d3f9e2b10'}
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Every registered review vote, comments rationale, user identity, and geometry hash snapshot are bound into a serialized compliance package.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              Propose or select a workflow to unlock sign-off actions and signature packages.
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
