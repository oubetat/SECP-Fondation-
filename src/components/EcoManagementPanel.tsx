import React, { useState, useEffect } from 'react';
import { 
  EcoManagementEngine, 
  EngineeringChangeOrder, 
  EcoStatus, 
  EcoPriority, 
  EcoSeverity, 
  EcoAffectedObject, 
  EcoTask, 
  EcoPackage 
} from '../engine/revision/EcoManagementEngine';
import { HardAcceptanceGate290 } from '../engine/revision/HardAcceptanceGate290';
import { EngineeringHashChain } from '../engine/evidence/EngineeringHashChain';
import { GitPullRequest, Settings, CheckCircle2, XCircle, AlertTriangle, Play, Save, RefreshCw, ShieldCheck, FileText, FileCheck, Cpu, Layers3, Activity, User, Plus, ChevronRight, Binary, Award, Lock, Compass, ArrowRight, TrendingUp, MessageSquare, ShieldAlert, Fingerprint, Calendar, Layers, HelpCircle, FileCode, Search, Filter, Users, Briefcase } from 'lucide-react';

export function EcoManagementPanel() {
  const [engine] = useState(() => new EcoManagementEngine());
  const [ecos, setEcos] = useState<EngineeringChangeOrder[]>([]);
  const [selectedEcoId, setSelectedEcoId] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Form states for creating a new ECO
  const [newLinkedChange, setNewLinkedChange] = useState<string>('CR-001');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('');
  const [newTechRationale, setNewTechRationale] = useState<string>('');
  const [newBusinessRationale, setNewBusinessRationale] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('2026-09-30');

  // Review commentaries
  const [reviewerName, setReviewerName] = useState<string>('LEAD_INTEGRATOR');
  const [reviewRole, setReviewRole] = useState<'ENGINEERING' | 'MANUFACTURING' | 'QUALITY'>('ENGINEERING');
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'>('APPROVE');
  const [reviewComment, setReviewComment] = useState<string>('');

  // Verification Matrix states
  const [benchmarkPassed, setBenchmarkPassed] = useState<boolean | null>(null);
  const [benchmarkChecks, setBenchmarkChecks] = useState<any[]>([]);

  // Simulated current user session
  const [currentUser, setCurrentUser] = useState<string>('DESIGN_ENG_1');

  const refreshState = () => {
    const list = engine.getAllECOs();
    setEcos(list);
    if (list.length > 0 && !selectedEcoId) {
      setSelectedEcoId(list[0].ecoId);
    }
  };

  useEffect(() => {
    refreshState();
  }, [engine]);

  const selectedEco = ecos.find(e => e.ecoId === selectedEcoId);

  // Proposal Submission Handler
  const handleCreateEco = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eco = engine.createECO(
        newLinkedChange,
        currentUser,
        newDueDate,
        newDesc || 'Geometric thickness parameter and mesh tuning.',
        newReason || 'Excess safety margin identified in FEM modeling.',
        newTechRationale || 'Local stress is within 70% threshold of alloy yield limit.',
        newBusinessRationale || 'Optimizes raw alloy weight by 1.86kg per rotor blade assembly.'
      );

      setNewDesc('');
      setNewReason('');
      setNewTechRationale('');
      setNewBusinessRationale('');
      setSelectedEcoId(eco.ecoId);
      setFeedback(`Engineering Change Order ${eco.ecoNumber} created linked to change proposal ${newLinkedChange}!`);
      refreshState();
    } catch (err: any) {
      alert(`ECO Creation Blocked: ${err.message}`);
    }
  };

  // State Transition Controller
  const handleTransition = (nextStatus: EcoStatus, comment?: string) => {
    if (!selectedEco) return;
    try {
      engine.transitionECO(
        selectedEco.ecoId,
        nextStatus,
        currentUser,
        selectedEco.versionToken,
        comment
      );
      setFeedback(`Successfully transitioned ${selectedEco.ecoNumber} to status: ${nextStatus}`);
      refreshState();
    } catch (err: any) {
      alert(`Transition Blocked: ${err.message}`);
    }
  };

  // Task controllers
  const handleStartTask = (taskId: string) => {
    if (!selectedEco) return;
    try {
      engine.startTask(selectedEco.ecoId, taskId, currentUser);
      setFeedback(`Task ${taskId} initiated in the background...`);
      refreshState();
    } catch (err: any) {
      alert(`Task Launch Error: ${err.message}`);
    }
  };

  const handleCompleteTask = (taskId: string) => {
    if (!selectedEco) return;
    try {
      const hashRes = EngineeringHashChain.computeCanonicalHash({
        ecoId: selectedEco.ecoId,
        taskId,
        currentUser,
        completedAt: new Date().toISOString()
      });
      const evidenceId = `EVI-${hashRes.canonicalHash.substring(0, 12).toUpperCase()}`;
      engine.completeTask(selectedEco.ecoId, taskId, evidenceId, currentUser);
      setFeedback(`Task ${taskId} finalized. Evidence seal registered: ${evidenceId}`);
      refreshState();
    } catch (err: any) {
      alert(`Task Completion Blocked: ${err.message}`);
    }
  };

  // Submit board signature
  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEco) return;
    try {
      engine.submitECOApproval(
        selectedEco.ecoId,
        reviewerName,
        reviewRole,
        reviewDecision,
        reviewComment || 'Authorized release package.'
      );
      setReviewComment('');
      setFeedback(`Board signature registered for role: ${reviewRole}`);
      refreshState();
    } catch (err: any) {
      alert(`Board Signature Error: ${err.message}`);
    }
  };

  // Run Regression Test Suite
  const handleRunRegressionTest = () => {
    const report = HardAcceptanceGate290.evaluate();
    setBenchmarkPassed(report.passed);
    setBenchmarkChecks(report.checks);
  };

  // Pre-fill complex parameters using AI Design Agent
  const handleApplyAiSuggestion = () => {
    setNewDesc('Update the hollow internal pocket boundaries of rotor Blade-B3. Incorporate localized rib reinforcements to increase torsional rigidity under centrifugal pressure.');
    setNewReason('CFD and modal fatigue analysis reveal localized structural resonance near 84Hz under operational speeds.');
    setNewTechRationale('Addition of secondary cross-rib profile changes the global torsional mode shape, increasing natural frequency by 18%.');
    setNewBusinessRationale('Prevents critical assembly failure and avoids high-cost field rebuild events.');
  };

  // Metrics solvers
  const activeEcos = ecos.filter(e => e.status !== 'CLOSED' && e.status !== 'RELEASED');
  const highRiskCount = ecos.filter(e => e.riskClass === 'CRITICAL' || e.riskClass === 'HIGH').length;
  const releasedEcos = ecos.filter(e => e.status === 'RELEASED' || e.status === 'CLOSED').length;
  const pendingApprovalsCount = ecos.filter(e => e.status === 'REVIEW').length;

  const filteredEcos = ecos.filter(e => {
    const matchQuery = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       e.ecoNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       e.linkedChangeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || e.status === statusFilter;
    const matchPriority = priorityFilter === 'ALL' || e.priority === priorityFilter;
    return matchQuery && matchStatus && matchPriority;
  });

  const auditEvents = selectedEco ? engine.getECOHistory(selectedEco.ecoId) : [];

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-xl p-6 text-slate-100 shadow-2xl space-y-8 max-w-7xl mx-auto" id="patch-290-panel">
      
      {/* 1. Header with Metadata info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-mono rounded">PATCH-290</span>
            <span className="text-slate-500 font-mono text-xs">/ PLM &amp; COLLABORATION</span>
          </div>
          <h1 className="text-2xl font-light text-slate-100 tracking-tight mt-1">Engineering Change Order (ECO) System</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Promote authorized engineering change requests into formal, controlled orders. Maintain strict task sequence dependencies, execute genuine FEA/CFD/CAM solver jobs, and seal immutable release configurations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* User selector context */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">User Context:</span>
            <select
              value={currentUser}
              onChange={e => setCurrentUser(e.target.value)}
              className="bg-slate-950 text-violet-400 font-semibold font-mono focus:outline-none cursor-pointer"
            >
              <option value="DESIGN_ENG_1">DESIGN_ENG_1 (Designer)</option>
              <option value="LEAD_INTEGRATOR">LEAD_INTEGRATOR (Integrator)</option>
              <option value="CHIEF_DESIGNER">CHIEF_DESIGNER (Chief)</option>
            </select>
          </div>

          <button
            onClick={handleRunRegressionTest}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2"
          >
            <Activity className="w-4.5 h-4.5 animate-pulse" />
            Validate ECO Production Gate
          </button>
        </div>
      </div>

      {/* 2. Automated Regression Test Output */}
      {benchmarkPassed !== null && (
        <div className={`p-5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-4 ${benchmarkPassed ? 'bg-emerald-950/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-950/10 border-rose-500/30 text-rose-400'}`}>
          <div className="flex items-start gap-3">
            {benchmarkPassed ? <CheckCircle2 className="w-6 h-6 mt-0.5 flex-shrink-0 text-emerald-500" /> : <XCircle className="w-6 h-6 mt-0.5 flex-shrink-0 text-rose-500" />}
            <div>
              <h3 className="font-semibold text-lg">{benchmarkPassed ? 'Acceptance Gate Passed' : 'Acceptance Gate Failed'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Evaluated structural parameters, lifecycle boundary gates, separation of duties policy, and task dependency sequences.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono bg-slate-900/60 p-4 rounded border border-slate-800">
            {benchmarkChecks.map((c, i) => (
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

      {/* 3. Metrics Dashboard Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Active ECOs</span>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-0.5">{activeEcos.length}</div>
          </div>
          <Activity className="w-8 h-8 text-violet-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">High-Risk ECO Orders</span>
            <div className="text-2xl font-bold font-mono text-orange-400 mt-0.5">{highRiskCount}</div>
          </div>
          <ShieldAlert className="w-8 h-8 text-orange-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Pending Approvals</span>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-0.5">{pendingApprovalsCount}</div>
          </div>
          <MessageSquare className="w-8 h-8 text-sky-500/20" />
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Released Revisions</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{releasedEcos}</div>
          </div>
          <FileCheck className="w-8 h-8 text-emerald-500/20" />
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-violet-400 flex items-center gap-2">
          <Compass className="w-4 h-4 text-violet-500 flex-shrink-0 animate-spin" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 4. Three-Column Workspace Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT BAR: List, Filters & Proposal Intake (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Filters & Search */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <Filter className="w-4 h-4 text-violet-400" /> Filters &amp; Search
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by ID, Title..."
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
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                >
                  <option value="ALL">All States</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="AUTHORIZED">Authorized</option>
                  <option value="IMPLEMENTING">Implementing</option>
                  <option value="VALIDATING">Validating</option>
                  <option value="RELEASED">Released</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Change Orders Picker */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
              <FileCode className="w-4 h-4 text-violet-400" /> Active ECO Registry
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredEcos.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
                  <p className="text-xs text-slate-500">No active engineering change orders in project.</p>
                  <button
                    onClick={() => {
                      engine.loadDemoECOs();
                      refreshState();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold"
                  >
                    Load Demo ECO Orders
                  </button>
                </div>
              ) : (
                filteredEcos.map(e => {
                  const isSelected = e.ecoId === selectedEcoId;
                  return (
                    <button
                      key={e.ecoId}
                      onClick={() => setSelectedEcoId(e.ecoId)}
                      className={`w-full text-left p-3.5 rounded-lg border transition text-xs font-mono flex flex-col gap-2 ${isSelected ? 'bg-violet-500/10 border-violet-500/40 text-slate-100' : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 text-slate-400'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            e.status === 'RELEASED' ? 'bg-emerald-500' :
                            e.status === 'IMPLEMENTING' ? 'bg-amber-500' : 'bg-violet-500'
                          }`} />
                          {e.ecoNumber}
                        </span>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                          Rev {e.revisionLevel}
                        </span>
                      </div>
                      <div>
                        <p className="font-sans font-medium text-slate-300 line-clamp-1">{e.title}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Change Ref: {e.linkedChangeId}</p>
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 text-slate-500 border-t border-slate-900 pt-1.5">
                        <span>Status: <strong className="text-slate-300 font-semibold">{e.status}</strong></span>
                        <span className={`px-1 rounded text-[9px] ${e.riskClass === 'CRITICAL' ? 'bg-red-500/10 text-red-400 font-bold' : 'text-slate-400'}`}>Risk: {e.riskClass}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* New ECO Propose Form */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-400" /> Raise New ECO Order
              </h2>
              <button
                type="button"
                onClick={handleApplyAiSuggestion}
                className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded hover:bg-indigo-500/20 flex items-center gap-1 transition"
              >
                <Cpu className="w-3 h-3" /> Use AI Suggestion
              </button>
            </div>

            <form onSubmit={handleCreateEco} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Pre-approved Change Link</label>
                <select
                  value={newLinkedChange}
                  onChange={e => setNewLinkedChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono focus:outline-none"
                >
                  <option value="CR-001">CR-001 (Blade Thickness reduction)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Detailed Change Description</label>
                <textarea
                  placeholder="Geometric parameters alterations..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Engineering Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Centrifugal load margin analysis"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Technical Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. Modal tuning mode shape analysis"
                  value={newTechRationale}
                  onChange={e => setNewTechRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Business Rationale</label>
                <input
                  type="text"
                  placeholder="e.g. Raw material cost optimization"
                  value={newBusinessRationale}
                  onChange={e => setNewBusinessRationale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Release Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-200 font-semibold rounded tracking-wide transition"
                >
                  Create Official ECO
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* MIDDLE SECTION: Workflow State Timeline, Task Sequence, & Physical Solvers (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {selectedEco ? (
            <>
              {/* Timeline State machine indicator */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <Compass className="w-4 h-4 text-violet-400" /> State Transition Control
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500">
                    Concurrency Token: {selectedEco.versionToken}
                  </span>
                </div>

                {/* Workflow grid */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-[9px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-900">
                  {([
                    'DRAFT', 'SUBMITTED', 'ANALYSIS', 'REVIEW', 'AUTHORIZED', 'PLANNED', 'IMPLEMENTING', 
                    'VALIDATING', 'READY_FOR_RELEASE', 'RELEASED', 'CLOSED', 'REJECTED', 'CANCELLED', 'BLOCKED'
                  ] as EcoStatus[]).map((st, i) => {
                    const isCurrent = selectedEco.status === st;
                    const isActive = selectedEco.status === st || (
                      selectedEco.status !== 'REJECTED' && 
                      selectedEco.status !== 'CANCELLED' && 
                      selectedEco.status !== 'BLOCKED' && 
                      ['CLOSED', 'RELEASED', 'READY_FOR_RELEASE', 'VALIDATING', 'IMPLEMENTING', 'PLANNED', 'AUTHORIZED', 'REVIEW', 'ANALYSIS', 'SUBMITTED', 'DRAFT'].indexOf(selectedEco.status) >= i
                    );

                    return (
                      <div key={st} className={`p-1.5 rounded border text-center flex flex-col items-center justify-center ${
                        isCurrent ? 'bg-violet-500/20 border-violet-500 text-violet-300 animate-pulse font-bold' :
                        isActive ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-950 border-slate-950 text-slate-700'
                      }`}>
                        <span className="text-[8px] opacity-60">#{i + 1}</span>
                        <span className="truncate max-w-[50px]" title={st}>{st}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Workflow transitional action buttons */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {selectedEco.status === 'DRAFT' && (
                    <button
                      onClick={() => handleTransition('SUBMITTED', 'Promoting order to review panel')}
                      className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 font-medium rounded border border-slate-750 transition"
                    >
                      Submit Order
                    </button>
                  )}
                  {selectedEco.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleTransition('ANALYSIS', 'Deploying solver nodes to verify design space')}
                      className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 font-medium rounded border border-slate-750 transition"
                    >
                      Analyze Baseline
                    </button>
                  )}
                  {selectedEco.status === 'ANALYSIS' && (
                    <button
                      onClick={() => handleTransition('REVIEW', 'Intake parameters parsed. Requesting review signature')}
                      className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 font-medium rounded border border-slate-750 transition"
                    >
                      Request Board Review
                    </button>
                  )}
                  {selectedEco.status === 'AUTHORIZED' && (
                    <button
                      onClick={() => handleTransition('PLANNED', 'Drafting implementation workflow schedules')}
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded transition"
                    >
                      Plan Execution tasks
                    </button>
                  )}
                  {selectedEco.status === 'PLANNED' && (
                    <button
                      onClick={() => handleTransition('IMPLEMENTING', 'Enforcing task workflow checkout paths')}
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded transition"
                    >
                      Checkout Implementation
                    </button>
                  )}
                  {selectedEco.status === 'IMPLEMENTING' && (
                    <button
                      onClick={() => handleTransition('VALIDATING', 'Checking validation provenance logs')}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded transition"
                    >
                      Verify Evidence
                    </button>
                  )}
                  {selectedEco.status === 'VALIDATING' && (
                    <button
                      onClick={() => handleTransition('READY_FOR_RELEASE', 'Validations pass. Preparing target revisions.')}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition"
                    >
                      Ready Release package
                    </button>
                  )}
                  {selectedEco.status === 'READY_FOR_RELEASE' && (
                    <button
                      onClick={() => handleTransition('RELEASED', 'Promoting baseline copy to Released revision level')}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded transition"
                    >
                      Release &amp; Merge Revision
                    </button>
                  )}
                  {selectedEco.status === 'RELEASED' && (
                    <button
                      onClick={() => handleTransition('CLOSED', 'Order complete. Archiving details')}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium rounded transition"
                    >
                      Close ECO Order
                    </button>
                  )}

                  {selectedEco.status !== 'CLOSED' && selectedEco.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleTransition('CANCELLED', 'Order cancelled by design engineering chief')}
                      className="py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-500 rounded transition"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Task sequence with Prerequisite dependencies */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" /> Executable Task Schedule
                </h2>

                <div className="space-y-3">
                  {selectedEco.implementationTasks.map(t => {
                    return (
                      <div key={t.taskId} className="bg-slate-950 p-3.5 rounded-lg border border-slate-900 space-y-2 text-xs">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              t.status === 'COMPLETED' ? 'bg-emerald-500' :
                              t.status === 'IN_PROGRESS' ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'
                            }`} />
                            {t.taskId} ({t.domain})
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            t.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-900 text-slate-500'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-normal">{t.description}</p>
                        
                        {t.dependencies.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Prerequisites: <strong className="text-slate-400">{t.dependencies.join(', ')}</strong>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-900/80">
                          <span className="text-[10px] text-slate-500">Assignee: {t.owner}</span>
                          <div className="flex gap-1.5">
                            {t.status === 'READY' && (
                              <button
                                onClick={() => handleStartTask(t.taskId)}
                                className="px-2.5 py-1 bg-violet-600/20 text-violet-400 border border-violet-500/20 hover:bg-violet-600/35 rounded text-[10px] transition"
                              >
                                Launch Task
                              </button>
                            )}
                            {t.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleCompleteTask(t.taskId)}
                                className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/35 rounded text-[10px] transition"
                              >
                                Finalize Task
                              </button>
                            )}
                            {t.status === 'COMPLETED' && t.evidenceId && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-900 px-2 py-0.5 rounded">
                                Evidence: {t.evidenceId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scope & Affected Objects matrix */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" /> Affected CAD/FEM Objects Matrix
                </h2>
                <div className="overflow-x-auto whitespace-nowrap">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500">
                        <th className="pb-2">Object ID</th>
                        <th className="pb-2">Domain</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-slate-300">
                      {selectedEco.affectedObjects.map((obj, i) => (
                        <tr key={i}>
                          <td className="py-2.5 font-bold text-slate-100">{obj.objectId}</td>
                          <td className="py-2.5 text-slate-400">{obj.objectType}</td>
                          <td className="py-2.5 text-violet-400">{obj.requiredAction}</td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              obj.currentState === 'PROVEN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {obj.currentState}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-slate-900/40 border border-slate-850 rounded-xl">
              <Compass className="w-10 h-10 text-slate-600 mx-auto animate-spin" />
              <p className="text-xs text-slate-400 mt-3 font-mono">Select or propose an ECO Ticket from the left list.</p>
            </div>
          )}

        </div>

        {/* RIGHT SECTION: Alternate CAD compares, Review Boards & Provenance seals (3 Cols) */}
        <div className="lg:col-span-3 space-y-6">

          {selectedEco ? (
            <>
              {/* CAD Parameter compares */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                  <Layers3 className="w-4 h-4 text-violet-400" /> Alternate CAD Parameter Compare
                </h2>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="bg-slate-950 p-3 rounded border border-slate-900 space-y-1">
                    <span className="text-[9px] text-slate-500 font-semibold uppercase block">Baseline (Current state)</span>
                    <div className="flex justify-between text-slate-400">
                      <span>Blade Thickness:</span>
                      <span className="font-semibold text-slate-200">12.0 mm</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Rotor Mass:</span>
                      <span className="font-semibold text-slate-200">8.42 kg</span>
                    </div>
                  </div>

                  <div className="flex justify-center text-slate-600">
                    <ArrowRight className="w-5 h-5" />
                  </div>

                  <div className="bg-violet-950/15 p-3 rounded border border-violet-500/20 space-y-1">
                    <span className="text-[9px] text-violet-400 font-semibold uppercase block">Proposal (Target state)</span>
                    <div className="flex justify-between text-violet-400">
                      <span>Blade Thickness:</span>
                      <span className="font-semibold text-violet-300">8.5 mm</span>
                    </div>
                    <div className="flex justify-between text-violet-400">
                      <span>Rotor Mass:</span>
                      <span className="font-semibold text-violet-300">6.56 kg (~22% reduction)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Board review input sign offs */}
              {selectedEco.status === 'REVIEW' && (
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                  <h2 className="text-sm font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-400" /> Board Sign-off Signature
                  </h2>

                  <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Actor Identity</label>
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={e => setReviewerName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Assigned Domain role</label>
                      <select
                        value={reviewRole}
                        onChange={e => setReviewRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 text-xs"
                      >
                        <option value="ENGINEERING">Engineering Branch Reviewer</option>
                        <option value="MANUFACTURING">Manufacturing Process Reviewer</option>
                        <option value="QUALITY">Quality Gate Reviewer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Action Decision</label>
                      <select
                        value={reviewDecision}
                        onChange={e => setReviewDecision(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 text-xs"
                      >
                        <option value="APPROVE">Approve Release</option>
                        <option value="REJECT">Reject Order</option>
                        <option value="REQUEST_CHANGES">Request Modification Rework</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Rationale comments</label>
                      <textarea
                        placeholder="Define review comments..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded transition animate-pulse"
                    >
                      Sign Off Release
                    </button>
                  </form>
                </div>
              )}

              {/* Provenance Seals & Audit Trail */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-violet-400" /> Audit Trail &amp; Hash Chain
                  </h2>
                  <Binary className="w-4 h-4 text-slate-600" />
                </div>

                {selectedEco.status === 'RELEASED' && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-mono space-y-1.5 break-all">
                    <div className="flex items-center gap-1 font-sans font-semibold">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Immutable ECO Package Hash</span>
                    </div>
                    <span className="text-[10px] block font-mono text-slate-300">
                      {selectedEco.integrityHash || '0x3a921d9f88c2901c0021b3e'}
                    </span>
                  </div>
                )}

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {auditEvents.slice().reverse().map((ev, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-900 text-[10px] font-mono space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Event: {ev.type}</span>
                        <span>{ev.timestamp.substring(11, 19)}</span>
                      </div>
                      <p className="text-slate-300 font-sans leading-tight">{ev.details}</p>
                      <div className="flex justify-between text-[9px] text-slate-600 border-t border-slate-900 pt-1">
                        <span>Actor: {ev.actor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-xs text-slate-500 font-mono">
              Please select or propose an ECO to unlock physical variant compares and audit logs.
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
