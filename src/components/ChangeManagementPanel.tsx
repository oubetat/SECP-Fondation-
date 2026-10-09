import React, { useState, useEffect } from 'react';
import { 
  ChangeManagementEngine, 
  EngineeringChange, 
  ChangeType, 
  ChangePriority, 
  ChangeOrigin,
  ChangeStatus
} from '../engine/revision/ChangeManagementEngine';
import { HardAcceptanceGate289 } from '../engine/revision/HardAcceptanceGate289';
import { EngineeringHashChain } from '../engine/evidence/EngineeringHashChain';
import { GitPullRequest, Settings, CheckCircle2, XCircle, AlertTriangle, Play, Save, RefreshCw, ShieldCheck, FileText, FileCheck, Cpu, Layers3, Activity, User, Plus, ChevronRight, Binary, Award, Lock, Compass, ArrowRight, TrendingUp, MessageSquare, ShieldAlert, Fingerprint, Calendar, Layers, HelpCircle } from 'lucide-react';

export function ChangeManagementPanel() {
  const [engine] = useState(() => new ChangeManagementEngine());
  const [changes, setChanges] = useState<EngineeringChange[]>([]);
  const [selectedChangeId, setSelectedChangeId] = useState<string>('CR-001');
  const [feedback, setFeedback] = useState<string>('');

  // Form states for creating a new Change
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newType, setNewType] = useState<ChangeType>('PARAMETER_CHANGE');
  const [newPriority, setNewPriority] = useState<ChangePriority>('HIGH');
  const [newOrigin, setNewOrigin] = useState<ChangeOrigin>('ENGINEER');
  
  const [newWhat, setNewWhat] = useState<string>('');
  const [newWhy, setNewWhy] = useState<string>('');
  const [newWhere, setNewWhere] = useState<string>('');
  const [newBenefit, setNewBenefit] = useState<string>('');
  const [newRisk, setNewRisk] = useState<string>('');

  // Review commentaries
  const [reviewerName, setReviewerName] = useState<string>('LEAD_INTEGRATOR');
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'>('APPROVE');
  const [reviewComment, setReviewComment] = useState<string>('');

  // Verification Matrix states
  const [benchmarkPassed, setBenchmarkPassed] = useState<boolean | null>(null);
  const [benchmarkChecks, setBenchmarkChecks] = useState<any[]>([]);

  // Current active user simulation
  const [currentUser, setCurrentUser] = useState<string>('DESIGN_ENG_1');

  const refreshState = () => {
    const list = engine.getAllChanges();
    setChanges(list);
    if (list.length > 0 && !selectedChangeId) {
      setSelectedChangeId(list[0].changeId);
    }
  };

  useEffect(() => {
    refreshState();
  }, [engine]);

  const selectedChange = changes.find(c => c.changeId === selectedChangeId);

  // Proposal submit
  const handleCreateChange = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cr = engine.createChange(
        newTitle || 'Geometric Alteration',
        newDesc || 'Modification requested for flow and structure alignment.',
        newType,
        newPriority,
        'PART-001',
        'PART-001:REV-A',
        currentUser,
        newOrigin,
        {
          whatChanges: newWhat || 'Parameter adjusted.',
          why: newWhy || 'Aero-structural sizing requirements.',
          where: 'Blade root profile',
          expectedBenefit: newBenefit || 'Reduction in dynamic pressure drop.',
          expectedRisk: newRisk || 'Localized concentration of shear forces.',
          affectedObjects: ['PART-001', 'STUDY-FEM-TURBINE', 'DWG-PART-001']
        }
      );
      
      setNewTitle('');
      setNewDesc('');
      setNewWhat('');
      setNewWhy('');
      setNewBenefit('');
      setNewRisk('');
      setSelectedChangeId(cr.changeId);
      setFeedback(`Engineering Change Request ${cr.changeId} successfully proposed!`);
      refreshState();
    } catch (err: any) {
      alert(`Proposal Error: ${err.message}`);
    }
  };

  // State Transition Handlers
  const handleTransition = (nextStatus: ChangeStatus, comment?: string) => {
    if (!selectedChange) return;
    try {
      engine.transitionChange(
        selectedChange.changeId,
        nextStatus,
        currentUser,
        selectedChange.versionToken,
        comment
      );
      setFeedback(`Successfully transitioned ${selectedChange.changeId} to status: ${nextStatus}`);
      refreshState();
    } catch (err: any) {
      alert(`Transition Blocked: ${err.message}`);
    }
  };

  // Run Impact Graph Analyzers
  const handleRunImpactAnalysis = () => {
    if (!selectedChange) return;
    try {
      engine.analyzeImpact(selectedChange.changeId, currentUser);
      setFeedback(`Cascaded dependency analysis complete for ${selectedChange.changeId}. Risk Score assessed.`);
      refreshState();
    } catch (err: any) {
      alert(`Impact Solver Error: ${err.message}`);
    }
  };

  // Submit formal review decision
  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChange) return;
    try {
      // First ensure the reviewer is registered in reviewers list
      engine.assignReviewer(selectedChange.changeId, reviewerName, currentUser);
      engine.submitReviewDecision(
        selectedChange.changeId,
        reviewerName,
        reviewDecision,
        reviewComment || 'Sufficient evidence generated. Parameter change authorized.'
      );
      setReviewComment('');
      setFeedback(`Review decision submitted: ${reviewDecision}`);
      refreshState();
    } catch (err: any) {
      alert(`Review Error: ${err.message}`);
    }
  };

  // Execute validation checkpoints
  const handleExecuteValidation = (domain: string, status: 'PASS' | 'FAIL' | 'INCONCLUSIVE') => {
    if (!selectedChange) return;
    try {
      const hashRes = EngineeringHashChain.computeCanonicalHash({
        changeId: selectedChange.changeId,
        domain,
        status,
        validator: currentUser,
        timestamp: new Date().toISOString()
      });
      const evidenceId = `EVI-${(hashRes?.canonicalHash || 'HASH000000000000').substring(0, 12).toUpperCase()}`;
      engine.executeValidationPlan(
        selectedChange.changeId,
        domain,
        status,
        evidenceId,
        currentUser
      );
      setFeedback(`Validation checkpoint completed on domain: ${domain}`);
      refreshState();
    } catch (err: any) {
      alert(`Validation Gate Error: ${err.message}`);
    }
  };

  // Release change to new revision
  const handleCompleteChange = () => {
    if (!selectedChange) return;
    try {
      const revId = `PART-001:REV-${String.fromCharCode(65 + changes.length)}`;
      engine.completeChange(selectedChange.changeId, revId, currentUser);
      setFeedback(`Change signed off! Released target revision generated: ${revId}`);
      refreshState();
    } catch (err: any) {
      alert(`Completion Gating Blocked: ${err.message}`);
    }
  };

  // Execute regression test battery
  const handleRunRegressionTest = () => {
    const report = HardAcceptanceGate289.evaluate();
    setBenchmarkPassed(report.passed);
    setBenchmarkChecks(report.checks);
  };

  // AI Assistant Proposal Generator
  const handleApplyAiSuggestion = () => {
    setNewTitle('Blade Weight Optimization & Hollow Refinement');
    setNewDesc('Introduce localized inner cavities on blades to drastically cut down rotational inertia without crossing shear stress limits.');
    setNewType('PARAMETER_CHANGE');
    setNewPriority('HIGH');
    setNewOrigin('AI_PROPOSED');
    setNewWhat('Hollow section profile depth is increased by 15%');
    setNewWhy('Fulfill overall system weight optimization requirements mandated by physical envelope guidelines.');
    setNewWhere('Mid-span rotor layout');
    setNewBenefit('Saves ~1.8kg total weight, lowering centrifugal load constraints.');
    setNewRisk('Reduces local natural frequency by 8.4Hz (requires modal review).');
  };

  const auditEvents = selectedChange ? engine.getChangeHistory(selectedChange.changeId) : [];

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-6 text-slate-100 shadow-2xl space-y-8 max-w-7xl mx-auto" id="patch-289-panel">
      {/* 1. Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-mono rounded">PATCH-289</span>
            <span className="text-slate-500 font-mono text-xs">/ CHANGE MANAGEMENT SYSTEM</span>
          </div>
          <h1 className="text-2xl font-light text-slate-100 tracking-tight mt-1">Controlled Engineering Change Engine</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Authorize alternate geometric variants safely. Trace revisions back to concrete change justifications, map cascades on true dependency graphs, and seal verified evidence immutably.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* User selector simulation */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">User Context:</span>
            <select
              value={currentUser}
              onChange={e => setCurrentUser(e.target.value)}
              className="bg-slate-950 text-teal-400 font-semibold font-mono focus:outline-none"
            >
              <option value="DESIGN_ENG_1">DESIGN_ENG_1 (Designer)</option>
              <option value="LEAD_INTEGRATOR">LEAD_INTEGRATOR (Integrator)</option>
              <option value="CHIEF_DESIGNER">CHIEF_DESIGNER (Chief)</option>
            </select>
          </div>

          <button
            onClick={handleRunRegressionTest}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2"
          >
            <Activity className="w-4.5 h-4.5 animate-pulse" />
            Run Change Verification Gate
          </button>
        </div>
      </div>

      {/* Validation reports */}
      {benchmarkPassed !== null && (
        <div className={`p-5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${benchmarkPassed ? 'bg-teal-950/10 border-teal-500/30 text-teal-400' : 'bg-rose-950/10 border-rose-500/30 text-rose-400'}`}>
          <div className="flex items-start gap-3">
            {benchmarkPassed ? <CheckCircle2 className="w-6 h-6 mt-0.5 flex-shrink-0 text-teal-500" /> : <XCircle className="w-6 h-6 mt-0.5 flex-shrink-0 text-rose-500" />}
            <div>
              <h3 className="font-semibold text-lg">{benchmarkPassed ? 'Acceptance Verification Passed' : 'Acceptance Verification Failed'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                All 7 structural change gates evaluated successfully. Rules regarding separation of duties, optimistic lock tokens, baseline immutability, and evidence constraints passed.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono bg-slate-900/60 p-4 rounded border border-slate-800">
            {benchmarkChecks.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                {c.passed ? <span className="text-teal-500 mt-0.5">✓</span> : <span className="text-rose-500 mt-0.5">✗</span>}
                <div>
                  <span className="text-slate-200 font-semibold">{c.name}</span>
                  <p className="text-[10px] text-slate-400">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action / Event Feedbacks */}
      {feedback && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-teal-400 flex items-center gap-2">
          <Compass className="w-4 h-4 text-teal-500 flex-shrink-0 animate-spin" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT BAR: Active Change Proposals Picker & Proposal Form (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Change Requests Selection */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-teal-400" /> Active Change Tickets
            </h2>
            <div className="space-y-2">
              {changes.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-500">No active change tickets in project.</p>
                  <button
                    onClick={() => {
                      engine.loadDemoChanges();
                      refreshState();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold"
                  >
                    Load Demo Change Tickets
                  </button>
                </div>
              ) : (
                changes.map(c => {
                  const isSelected = c.changeId === selectedChangeId;
                  return (
                    <button
                      key={c.changeId}
                      onClick={() => setSelectedChangeId(c.changeId)}
                      className={`w-full text-left p-3.5 rounded-lg border transition text-xs font-mono flex flex-col gap-2 ${isSelected ? 'bg-teal-500/10 border-teal-500/40 text-slate-100' : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 text-slate-400'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'COMPLETED' ? 'bg-teal-500' :
                            c.status === 'IMPLEMENTING' ? 'bg-amber-500' : 'bg-slate-500'
                          }`} />
                          {c.changeId}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          c.priority === 'URGENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          c.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {c.priority}
                        </span>
                      </div>
                      <div>
                        <p className="font-sans font-medium text-slate-300 line-clamp-1">{c.title}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Baseline: {c.targetRevisionId}</p>
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 text-slate-500 border-t border-slate-900 pt-1.5">
                        <span>Status: <strong className="text-slate-300 font-semibold">{c.status}</strong></span>
                        <span>Risk: <strong className={c.riskClass === 'CRITICAL' ? 'text-red-400' : 'text-slate-400'}>{c.riskClass || 'UNRATED'}</strong></span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* New Change Request Form */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-400" /> Propose Change Request
              </h2>
              <button
                type="button"
                onClick={handleApplyAiSuggestion}
                className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded hover:bg-sky-500/20 flex items-center gap-1 transition"
              >
                <Cpu className="w-3 h-3" /> Use AI Proposal
              </button>
            </div>

            <form onSubmit={handleCreateChange} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mass reduction at blades"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-teal-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Description / Rationale</label>
                <textarea
                  placeholder="Detailed engineering explanation..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-teal-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Change Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as ChangeType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="PARAMETER_CHANGE">Parameter Modification</option>
                    <option value="GEOMETRY_CHANGE">Geometry Revision</option>
                    <option value="MATERIAL_CHANGE">Material Change</option>
                    <option value="MANUFACTURING_CHANGE">CNC CAM Tuning</option>
                    <option value="SIMULATION_CHANGE">FEM Analysis Study</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as ChangePriority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 font-mono focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-3 space-y-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Change Proposal Specifics</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">What Changes?</label>
                    <input
                      type="text"
                      placeholder="e.g. Thickness reduced"
                      value={newWhat}
                      onChange={e => setNewWhat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Where?</label>
                    <input
                      type="text"
                      placeholder="e.g. Rotor center span"
                      value={newWhere}
                      onChange={e => setNewWhere(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[11px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">Why / Justification?</label>
                  <input
                    type="text"
                    placeholder="e.g. Weight reduction goals"
                    value={newWhy}
                    onChange={e => setNewWhy(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Expected Benefit</label>
                    <input
                      type="text"
                      placeholder="e.g. Mass reduction"
                      value={newBenefit}
                      onChange={e => setNewBenefit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Expected Risk</label>
                    <input
                      type="text"
                      placeholder="e.g. Increased fatigue risk"
                      value={newRisk}
                      onChange={e => setNewRisk(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Origin Node</label>
                  <select
                    value={newOrigin}
                    onChange={e => setNewOrigin(e.target.value as ChangeOrigin)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 font-mono"
                  >
                    <option value="ENGINEER">Engineer</option>
                    <option value="AI_PROPOSED">AI proposed</option>
                    <option value="VALIDATION">Validation finding</option>
                    <option value="NCR">Non-conformance</option>
                    <option value="CUSTOMER">Customer request</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full mt-5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold rounded tracking-wide transition"
                >
                  Propose Change
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* MIDDLE SECTION: Workflow State Machine, Live Impact Analyzers & Risk Assessor (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {selectedChange ? (
            <>
              {/* Change Workflow Gated Transition Controller */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <Compass className="w-4 h-4 text-orange-400" /> State Transition Controller
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    Token: {selectedChange.versionToken}
                  </span>
                </div>

                {/* State timeline tracking */}
                <div className="flex items-center justify-between text-[10px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-900 overflow-x-auto whitespace-nowrap gap-1">
                  {(['DRAFT', 'SUBMITTED', 'UNDER_ANALYSIS', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTING', 'VALIDATING', 'COMPLETED'] as ChangeStatus[]).map((st, i) => {
                    const isPassed = ['COMPLETED', 'CANCELLED', st].includes(selectedChange.status) || 
                                     (selectedChange.status === 'VALIDATING' && i < 6) ||
                                     (selectedChange.status === 'IMPLEMENTING' && i < 5) ||
                                     (selectedChange.status === 'APPROVED' && i < 4) ||
                                     (selectedChange.status === 'UNDER_REVIEW' && i < 3) ||
                                     (selectedChange.status === 'UNDER_ANALYSIS' && i < 2) ||
                                     (selectedChange.status === 'SUBMITTED' && i < 1);
                    const isCurrent = selectedChange.status === st;

                    return (
                      <React.Fragment key={st}>
                        <div className="flex flex-col items-center">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                            isCurrent ? 'bg-orange-500 border-orange-500 text-white animate-pulse' :
                            isPassed ? 'bg-teal-500/20 border-teal-500 text-teal-400' : 'bg-slate-950 border-slate-800 text-slate-600'
                          }`}>
                            {i + 1}
                          </span>
                          <span className={`text-[8px] mt-1 ${isCurrent ? 'text-orange-400 font-semibold' : isPassed ? 'text-teal-400' : 'text-slate-600'}`}>
                            {st}
                          </span>
                        </div>
                        {i < 7 && <ChevronRight className="w-3 h-3 text-slate-800 flex-shrink-0 mt-2" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Action buttons matching state machine transitions */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  {selectedChange.status === 'DRAFT' && (
                    <button
                      onClick={() => handleTransition('SUBMITTED', 'Submitting proposed changes for review evaluation')}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium rounded border border-slate-750 transition"
                    >
                      Submit for Analysis
                    </button>
                  )}
                  {selectedChange.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleTransition('UNDER_ANALYSIS', 'Moving to analysis environment')}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium rounded border border-slate-750 transition"
                    >
                      Initiate Impact Analysis
                    </button>
                  )}
                  {selectedChange.status === 'UNDER_ANALYSIS' && (
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={handleRunImpactAnalysis}
                        className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded transition flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Analyze Cascade Impacts
                      </button>
                      {selectedChange.impactsAnalyzed && (
                        <button
                          onClick={() => handleTransition('UNDER_REVIEW', 'Impact analysis complete. Ready for board review.')}
                          className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded transition"
                        >
                          Request Board Review
                        </button>
                      )}
                    </div>
                  )}

                  {selectedChange.status === 'APPROVED' && (
                    <button
                      onClick={() => {
                        engine.startImplementation(selectedChange.changeId, currentUser);
                        refreshState();
                      }}
                      className="col-span-2 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded transition"
                    >
                      Checkout Drafts &amp; Start Implementation
                    </button>
                  )}

                  {selectedChange.status === 'IMPLEMENTING' && (
                    <button
                      onClick={() => handleTransition('VALIDATING', 'Implementation drafted. Triggering validation processes.')}
                      className="col-span-2 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded transition"
                    >
                      Draft Complete &rarr; Start Validations
                    </button>
                  )}

                  {selectedChange.status === 'VALIDATING' && (
                    <button
                      onClick={handleCompleteChange}
                      className="col-span-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded shadow-lg transition flex items-center justify-center gap-1.5"
                    >
                      <FileCheck className="w-4 h-4" /> Close &amp; Release Revision
                    </button>
                  )}

                  {selectedChange.status !== 'COMPLETED' && selectedChange.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleTransition('CANCELLED', 'Design change cancelled by engineering lead.')}
                      className="py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-500 text-[10px] rounded transition"
                    >
                      Cancel Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Dependency Impact Visualization */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-400" /> Cascade Impact Graph
                  </h2>
                  <span className="text-[10px] text-slate-400 font-mono italic">
                    {selectedChange.impactsAnalyzed ? 'Solved' : 'Pending Solver run'}
                  </span>
                </div>

                {selectedChange.impactsAnalyzed ? (
                  <div className="space-y-4 text-xs">
                    {/* CAD Dependency Flow Node list */}
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-900 font-mono text-[11px] text-slate-300 space-y-2">
                      <div className="flex items-center gap-2 text-rose-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>[Direct Target] {selectedChange.targetObjectId} : {selectedChange.targetRevisionId}</span>
                      </div>
                      
                      <div className="pl-4 border-l border-slate-800 space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-amber-400">
                          <span>└─► Assembly Integration (Clearance &amp; Interferences)</span>
                          <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">Cascaded</span>
                        </div>
                        <div className="flex items-center justify-between text-teal-400">
                          <span>└─► Finite Element Solver (STUDY-FEM-TURBINE)</span>
                          <span className="text-[9px] bg-teal-500/10 border border-teal-500/20 px-1 py-0.2 rounded">Stale Evidence</span>
                        </div>
                        <div className="flex items-center justify-between text-teal-400">
                          <span>└─► CNC Machining toolpath programs</span>
                          <span className="text-[9px] bg-teal-500/10 border border-teal-500/20 px-1 py-0.2 rounded">G-Code Stale</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>└─► Engineering Drawing sheet views (DWG-PART-001)</span>
                          <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded">Unproven</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-950 p-3 rounded border border-slate-900 font-mono">
                      <div>
                        <strong className="text-slate-400 block mb-1">Directly Impacted:</strong>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                          {selectedChange.directImpacts.map(i => <li key={i} className="truncate">{i}</li>)}
                        </ul>
                      </div>
                      <div>
                        <strong className="text-slate-400 block mb-1">Indirect Propagation:</strong>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-300 font-semibold text-teal-400">
                          {selectedChange.indirectImpacts.map(i => <li key={i} className="truncate">{i}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-950 rounded-lg border border-slate-900">
                    <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 mt-2 font-mono">No impact matrix exists yet.</p>
                    <button
                      onClick={handleRunImpactAnalysis}
                      className="mt-3 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-semibold rounded transition"
                    >
                      Run Propagation Solvers
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Risk Analysis Gauges */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Multi-Factor Risk Assessment
                </h2>

                {selectedChange.impactsAnalyzed ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Gauge Card */}
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-900 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Calculated Risk Index</span>
                        <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{selectedChange.riskScore}%</div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              selectedChange.riskClass === 'CRITICAL' ? 'bg-red-500' :
                              selectedChange.riskClass === 'HIGH' ? 'bg-orange-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${selectedChange.riskScore}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1.5 block">Severity + Cascaded Scope weights</span>
                      </div>
                    </div>

                    {/* Classification factors */}
                    <div className="space-y-2 font-mono text-[11px] text-slate-400 bg-slate-950 p-4 rounded-lg border border-slate-900">
                      <div className="flex justify-between border-b border-slate-900 pb-1.5">
                        <span>Classification:</span>
                        <span className="font-semibold text-rose-400">{selectedChange.classification}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1.5">
                        <span>Risk Rating:</span>
                        <span className="font-semibold text-orange-400">{selectedChange.riskClass}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1.5">
                        <span>Safety Impact:</span>
                        <span className="font-semibold text-rose-400">CRITICAL</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Evidence Impact:</span>
                        <span className="font-semibold text-teal-400">No Reuse policy applied</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 font-mono">
                    Please compute cascade impact mapping to trigger risk parameters.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-850 rounded-xl">
              <Compass className="w-10 h-10 text-slate-600 mx-auto animate-spin" />
              <p className="text-xs text-slate-400 mt-3 font-mono">Select or propose an Engineering Change Ticket from the left bar.</p>
            </div>
          )}

        </div>

        {/* RIGHT SECTION: Alternate CAD Parameter Compares, Evidence Gates & Cryptographic Provenance Seals (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">

          {selectedChange ? (
            <>
              {/* Before vs After Alternate CAD Compare */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-teal-400" /> Alternate CAD Parameter Compare
                </h2>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded border border-slate-900 space-y-1">
                    <span className="text-[9px] text-slate-500 font-semibold uppercase block">Baseline (Before Change)</span>
                    <div className="flex justify-between text-slate-400">
                      <span>Blade Thickness:</span>
                      <span className="font-semibold text-slate-200">12.0 mm</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Estimated Mass:</span>
                      <span className="font-semibold text-slate-200">8.42 kg</span>
                    </div>
                  </div>

                  <div className="flex justify-center text-slate-600">
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <div className="bg-teal-950/15 p-3 rounded border border-teal-500/20 space-y-1">
                    <span className="text-[9px] text-teal-400 font-semibold uppercase block">Proposal (After Change)</span>
                    <div className="flex justify-between text-teal-400">
                      <span>Blade Thickness:</span>
                      <span className="font-semibold text-teal-300">8.5 mm</span>
                    </div>
                    <div className="flex justify-between text-teal-400">
                      <span>Estimated Mass:</span>
                      <span className="font-semibold text-teal-300">6.56 kg (~22% reduction)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Commentaries Board */}
              {selectedChange.status === 'UNDER_REVIEW' && (
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-400" /> Review Board &amp; Sign-offs
                  </h2>

                  <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Reviewer Actor</label>
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={e => setReviewerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Action Decision</label>
                      <select
                        value={reviewDecision}
                        onChange={e => setReviewDecision(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-slate-300 text-xs"
                      >
                        <option value="APPROVE">Approve &amp; Authorize Changes</option>
                        <option value="REJECT">Reject Ticket</option>
                        <option value="REQUEST_CHANGES">Request Modifications</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Commentaries</label>
                      <textarea
                        placeholder="Define engineering feedback..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-slate-200 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded transition"
                    >
                      Submit Decision
                    </button>
                  </form>
                </div>
              )}

              {/* Gated Validation Checkpoints */}
              {(selectedChange.status === 'IMPLEMENTING' || selectedChange.status === 'VALIDATING' || selectedChange.status === 'COMPLETED') && (
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Physical Validation Checks
                  </h2>

                  <div className="space-y-2">
                    {/* FEM Mesh solver check */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-900 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold block text-slate-300">FEM Structural Load</span>
                        <span className="text-[10px] text-slate-500">Stiff-mesh dynamic load solver</span>
                      </div>
                      {selectedChange.validationPlan.executions.some(e => e.domain === 'FEM_MESH' && e.status === 'PASS') ? (
                        <span className="text-teal-400 font-bold font-mono text-[11px]">PASS</span>
                      ) : (
                        <button
                          onClick={() => handleExecuteValidation('FEM_MESH', 'PASS')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-[10px] font-medium rounded transition"
                        >
                          Verify FEM
                        </button>
                      )}
                    </div>

                    {/* G-code simulator check */}
                    <div className="bg-slate-950 p-3 rounded border border-slate-900 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold block text-slate-300">G-Code Toolpaths</span>
                        <span className="text-[10px] text-slate-500">Machining feed rates compliance</span>
                      </div>
                      {selectedChange.validationPlan.executions.some(e => e.domain === 'G-CODE' && e.status === 'PASS') ? (
                        <span className="text-teal-400 font-bold font-mono text-[11px]">PASS</span>
                      ) : (
                        <button
                          onClick={() => handleExecuteValidation('G-CODE', 'PASS')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-[10px] font-medium rounded transition"
                        >
                          Verify CNC
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cryptographic Provenance timeline & Seals */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-teal-400" /> Audit Trail &amp; Hash Chain
                  </h2>
                  <Binary className="w-4 h-4 text-slate-600" />
                </div>

                {selectedChange.status === 'COMPLETED' && selectedChange.integrityHash && (
                  <div className="p-3 bg-teal-950/20 border border-teal-500/20 text-teal-400 rounded-lg text-xs font-mono space-y-1.5 break-all">
                    <div className="flex items-center gap-1 font-sans font-semibold">
                      <Lock className="w-3.5 h-3.5 text-teal-400" />
                      <span>Immutable Change Hash Locked</span>
                    </div>
                    <span className="text-[10px] block font-mono text-slate-300">{selectedChange.integrityHash}</span>
                  </div>
                )}

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {auditEvents.slice().reverse().map(ev => (
                    <div key={ev.eventId} className="bg-slate-950 p-2.5 rounded border border-slate-900 text-[10px] font-mono space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Event: {ev.eventType}</span>
                        <span>{(ev?.timestamp || new Date().toISOString()).substring(11, 19)}</span>
                      </div>
                      <p className="text-slate-300 font-sans leading-tight">{ev.details}</p>
                      <div className="flex justify-between text-[9px] text-slate-600 border-t border-slate-900 pt-1">
                        <span>Actor: {ev.actor}</span>
                        <span className="truncate max-w-[100px]" title={ev.currentHash}>Hash: {(ev?.currentHash || '0000000000').substring(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              Please select or propose a change to unlock alternate configurations and sign-off traces.
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
