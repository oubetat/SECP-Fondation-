import React, { useState, useEffect } from 'react';
import { AccessControlEngine } from '../engine/collaboration/AccessControlEngine';
import { 
  AuthContext, 
  EngineeringRole, 
  EngineeringAction, 
  ResourceType, 
  ProjectMember,
  ResourceState,
  AccessDecision,
  SecurityEventClassification,
  AccessAuditEvent,
  MembershipStatus
} from '../engine/collaboration/AccessControlTypes';
import { HardAcceptanceGate293, Gate293Report } from '../engine/collaboration/HardAcceptanceGate293';
import { ShieldCheck, UserPlus, Lock, Unlock, AlertOctagon, UserCog, History, Search, ShieldAlert, CheckCircle2, XCircle, Users, Fingerprint, Server, Layers, ChevronRight, Filter, Eye, KeyRound, FileCheck, Ban, Clock, Building, Cpu, RefreshCw, Sliders, Check, Shield, Activity, Award } from 'lucide-react';

export function AccessControlPanel() {
  const [engine] = useState(() => new AccessControlEngine());
  const [projectId, setProjectId] = useState('PROJ-SECP-2026');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [testReport, setTestReport] = useState<Gate293Report | null>(null);
  const [auditLogs, setAuditLogs] = useState<AccessAuditEvent[]>([]);
  const [filterClass, setFilterClass] = useState<string>('ALL');

  // Simulation Sandbox State
  const [currentUser, setCurrentUser] = useState<string>('ENGINEER_SARAH');
  const [currentRole, setCurrentRole] = useState<EngineeringRole>('ENGINEER');
  const [targetResource, setTargetResource] = useState<ResourceType>('PART');
  const [targetAction, setTargetAction] = useState<EngineeringAction>('UPDATE');
  const [isReleased, setIsReleased] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockedByUser, setLockedByUser] = useState<string>('OTHER_USER');
  const [resourceOwner, setResourceOwner] = useState<string>('OTHER_USER');
  const [confidentiality, setConfidentiality] = useState<'INTERNAL' | 'RESTRICTED' | 'PUBLIC' | 'SUPPLIER_SHARED'>('INTERNAL');
  const [isAiAgent, setIsAiAgent] = useState<boolean>(false);
  const [currentTenant, setCurrentTenant] = useState<string>('TENANT-MAIN');
  const [resourceTenant, setResourceTenant] = useState<string>('TENANT-MAIN');

  // Interactive Live Decision Result
  const [lastDecision, setLastDecision] = useState<AccessDecision | null>(null);
  const [activeTab, setActiveTab] = useState<'SANDBOX' | 'MEMBERS' | 'MATRIX' | 'AUDIT' | 'GATE'>('SANDBOX');

  const refreshState = () => {
    setMembers(engine.getMembers(projectId));
    setAuditLogs(engine.getAuditLogs(projectId));
  };

  useEffect(() => {
    // Initialize seed members
    engine.addMember({
      userId: 'OWNER_ROOT',
      projectId: projectId,
      role: 'OWNER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 3600000,
      grantedBy: 'SYSTEM'
    });
    engine.addMember({
      userId: 'ADMIN_CHIEF',
      projectId: projectId,
      role: 'PROJECT_ADMIN',
      status: 'ACTIVE',
      grantedAt: Date.now() - 3000000,
      grantedBy: 'OWNER_ROOT'
    });
    engine.addMember({
      userId: 'ENGINEER_SARAH',
      projectId: projectId,
      role: 'ENGINEER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 2000000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'CAE_SPECIALIST',
      projectId: projectId,
      role: 'CAE_ENGINEER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 1500000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'CAM_PROGRAMMER',
      projectId: projectId,
      role: 'CAM_ENGINEER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 1200000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'REVIEWER_MARK',
      projectId: projectId,
      role: 'REVIEWER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 1000000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'QUALITY_LEAD',
      projectId: projectId,
      role: 'QUALITY',
      status: 'ACTIVE',
      grantedAt: Date.now() - 800000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'SUPPLIER_GLOBAL',
      projectId: projectId,
      role: 'SUPPLIER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 500000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'VIEWER_INTERN',
      projectId: projectId,
      role: 'VIEWER',
      status: 'ACTIVE',
      grantedAt: Date.now() - 300000,
      grantedBy: 'ADMIN_CHIEF'
    });
    engine.addMember({
      userId: 'AUDITOR_EXTERNAL',
      projectId: projectId,
      role: 'AUDITOR',
      status: 'ACTIVE',
      grantedAt: Date.now() - 100000,
      grantedBy: 'ADMIN_CHIEF'
    });

    // Run initial gate check
    const report = HardAcceptanceGate293.evaluate();
    setTestReport(report);

    refreshState();
  }, []);

  const handleTestAuth = () => {
    const ctx: AuthContext = { 
      userId: currentUser, 
      sessionId: `SESS-${currentUser}`, 
      tenantId: currentTenant,
      isAiAgent
    };

    const state: ResourceState = {
      objectId: `${targetResource}-OBJ-001`,
      projectId,
      tenantId: resourceTenant,
      ownerId: resourceOwner,
      isReleased,
      isApproved,
      isLocked,
      lockedByUserId: isLocked ? lockedByUser : undefined,
      confidentialityLevel: confidentiality
    };

    const decision = engine.authorize(ctx, projectId, targetResource, targetAction, state);
    setLastDecision(decision);
    refreshState();
  };

  const handleAddMember = (uid: string, role: EngineeringRole) => {
    engine.addMember({
      userId: uid,
      projectId: projectId,
      role: role,
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: currentUser
    });
    refreshState();
  };

  const handleUpdateStatus = (uid: string, status: MembershipStatus) => {
    engine.updateMemberStatus(projectId, uid, status, currentUser);
    refreshState();
  };

  const handleRunGate = () => {
    const report = HardAcceptanceGate293.evaluate();
    setTestReport(report);
    refreshState();
  };

  const filteredLogs = auditLogs.filter(log => {
    if (filterClass === 'ALL') return true;
    return log.classification === filterClass;
  });

  return (
    <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-8 max-w-7xl mx-auto" id="access-control-panel">
      
      {/* 1. Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-mono rounded font-bold">PATCH-293</span>
            <span className="text-slate-500 font-mono text-xs font-bold uppercase tracking-wider">/ DOMAIN-DRIVEN ACCESS CONTROL</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-2 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-teal-400" />
            Engineering Access Control & Security Boundaries
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Zero-trust, deterministic authorization engine enforcing strict security boundaries across API, domain, and transaction layers. Protects CAD topology, assembly, CAM toolpaths, FEM/CFD solvers, and immutable released revisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunGate}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-teal-950/30 flex items-center gap-2 font-mono"
          >
            <ShieldAlert className="w-4 h-4" />
            Run Security Gate 293
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Project Members</div>
            <div className="text-lg font-black text-white">{members.length} Active</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">RBAC Roles</div>
            <div className="text-lg font-black text-white">12 Defined</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Audit Events</div>
            <div className="text-lg font-black text-white">{auditLogs.length} Logged</div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${testReport?.passed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${testReport?.passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Security Gate 293</div>
            <div className={`text-lg font-black ${testReport?.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
              {testReport?.passed ? 'PROVEN (24/24)' : 'FAILED'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab Selectors */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'SANDBOX', label: 'Interactive Evaluator', icon: Fingerprint },
          { id: 'MEMBERS', label: 'Project Membership', icon: Users },
          { id: 'MATRIX', label: 'RBAC Permission Matrix', icon: KeyRound },
          { id: 'AUDIT', label: 'Security Audit Stream', icon: History },
          { id: 'GATE', label: 'Hard Gate 293 Report', icon: ShieldAlert },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-extrabold transition-all font-mono ${
                isActive 
                  ? 'bg-slate-900 text-teal-400 border-t border-x border-slate-800 shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Tab 1: Interactive Authorization Sandbox */}
      {activeTab === 'SANDBOX' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
          
          {/* Subject & Context Column */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider font-mono">
                  <UserCog className="w-4 h-4 text-teal-400" /> Subject Identity
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Context Binding</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1">Actor User ID</label>
                  <select
                    value={currentUser}
                    onChange={e => {
                      const uid = e.target.value;
                      setCurrentUser(uid);
                      const m = members.find(x => x.userId === uid);
                      if (m) setCurrentRole(m.role);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-teal-400 focus:outline-none"
                  >
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.userId} ({m.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1">Assigned Role</label>
                  <select 
                    value={currentRole}
                    onChange={e => setCurrentRole(e.target.value as EngineeringRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="PROJECT_ADMIN">PROJECT_ADMIN</option>
                    <option value="ENGINEER">ENGINEER</option>
                    <option value="DESIGNER">DESIGNER</option>
                    <option value="CAE_ENGINEER">CAE_ENGINEER</option>
                    <option value="CAM_ENGINEER">CAM_ENGINEER</option>
                    <option value="REVIEWER">REVIEWER</option>
                    <option value="QUALITY">QUALITY</option>
                    <option value="MANUFACTURING">MANUFACTURING</option>
                    <option value="SUPPLIER">SUPPLIER</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-300">Is Autonomous AI Agent?</span>
                  <button
                    onClick={() => setIsAiAgent(!isAiAgent)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold font-mono transition ${isAiAgent ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
                  >
                    {isAiAgent ? 'AI AGENT IDENTITY' : 'HUMAN USER'}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1">Tenant ID</label>
                  <input
                    type="text"
                    value={currentTenant}
                    onChange={e => setCurrentTenant(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Object State Constraints */}
            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl space-y-4">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider font-mono">
                <Lock className="w-4 h-4 text-amber-400" /> Object Lifecycle State
              </span>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Released (Immutable)?</span>
                  <button 
                    onClick={() => setIsReleased(!isReleased)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold font-mono transition ${isReleased ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
                  >
                    {isReleased ? 'RELEASED' : 'DRAFT/IN-WORK'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approved State?</span>
                  <button 
                    onClick={() => setIsApproved(!isApproved)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold font-mono transition ${isApproved ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
                  >
                    {isApproved ? 'APPROVED' : 'UNAPPROVED'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Object Locked by Other?</span>
                  <button 
                    onClick={() => setIsLocked(!isLocked)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold font-mono transition ${isLocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
                  >
                    {isLocked ? 'LOCKED' : 'UNLOCKED'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Resource Owner ID</span>
                  <input 
                    type="text" 
                    value={resourceOwner} 
                    onChange={e => setResourceOwner(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300 w-32 text-right"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Confidentiality</span>
                  <select 
                    value={confidentiality}
                    onChange={e => setConfidentiality(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300"
                  >
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="RESTRICTED">RESTRICTED</option>
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="SUPPLIER_SHARED">SUPPLIER_SHARED</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Operation & Result Column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <Sliders className="w-5 h-5 text-teal-400" /> Target Engineering Operation
                </span>
                <span className="text-[10px] text-slate-500 font-mono uppercase">Pre-Mutation Security Guard</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1">Target Resource</label>
                  <select 
                    value={targetResource}
                    onChange={e => setTargetResource(e.target.value as ResourceType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200"
                  >
                    <option value="PROJECT">PROJECT (Workspace / Metadata)</option>
                    <option value="PART">PART (3D Solid / CAD Body)</option>
                    <option value="SKETCH">SKETCH (2D Parametric Geometry)</option>
                    <option value="FEATURE">FEATURE (Extrude / Revolve / Fillet)</option>
                    <option value="ASSEMBLY">ASSEMBLY (Tree & Constraints)</option>
                    <option value="SIMULATION">SIMULATION (FEM Mesh & CFD Case)</option>
                    <option value="CAM">CAM (Toolpath & G-Code)</option>
                    <option value="DRAWING">DRAWING (2D Blueprint / PMI / GD&T)</option>
                    <option value="REVISION">REVISION (PLM Lifecycle Item)</option>
                    <option value="ECO">ECO (Engineering Change Order)</option>
                    <option value="DOCUMENT">DOCUMENT (Specifications)</option>
                    <option value="EVIDENCE">EVIDENCE (Certification Ledger)</option>
                    <option value="AUDIT_LOG">AUDIT_LOG (Security Trails)</option>
                    <option value="USER_MANAGEMENT">USER_MANAGEMENT (Roles & Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-mono mb-1">Target Action</label>
                  <select 
                    value={targetAction}
                    onChange={e => setTargetAction(e.target.value as EngineeringAction)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200"
                  >
                    <option value="READ">READ (Inspect / View Data)</option>
                    <option value="CREATE">CREATE (Instantiate New Entity)</option>
                    <option value="UPDATE">UPDATE (Mutate / Edit Geometry or State)</option>
                    <option value="DELETE">DELETE (Remove / Destroy Entity)</option>
                    <option value="EXECUTE">EXECUTE (Run FEM/CFD Solver or Toolpath)</option>
                    <option value="REVIEW">REVIEW (Formal Engineering Peer Review)</option>
                    <option value="APPROVE">APPROVE (Quality / Lead Sign-Off)</option>
                    <option value="RELEASE">RELEASE (Publish Production Revision)</option>
                    <option value="EXPORT">EXPORT (STEP / IGES / G-Code / PDF)</option>
                    <option value="ADMINISTER">ADMINISTER (Manage Access & Roles)</option>
                  </select>
                </div>
              </div>

              {/* Evaluation Action Button */}
              <button
                onClick={handleTestAuth}
                className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-xl shadow-teal-950/30 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Evaluate Authorization Decision (Pre-Mutation Check)
              </button>

              {/* Live Decision Display Card */}
              {lastDecision && (
                <div className={`p-5 rounded-2xl border flex flex-col gap-3 animate-in slide-in-from-top-2 ${
                  lastDecision.allowed 
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {lastDecision.allowed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono text-xs font-black uppercase tracking-wider">
                          DECISION: {lastDecision.decision}
                        </span>
                        <div className="text-[11px] font-bold text-white mt-0.5">
                          {lastDecision.allowed 
                            ? `Operation authorized under policy ${lastDecision.policyVersion}.`
                            : `Operation BLOCKED: ${lastDecision.reason}`
                          }
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold border ${
                      lastDecision.allowed 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {lastDecision.explicitPermission || `${lastDecision.resource}.${lastDecision.action}`}
                    </span>
                  </div>

                  {lastDecision.detailedMessage && (
                    <div className="p-3 bg-slate-950/60 rounded-xl text-slate-300 text-xs font-mono border border-slate-850/50">
                      {lastDecision.detailedMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/40">
                    <div>User: <strong className="text-slate-200">{lastDecision.userId}</strong></div>
                    <div>Resource: <strong className="text-slate-200">{lastDecision.resource}</strong></div>
                    <div>Action: <strong className="text-slate-200">{lastDecision.action}</strong></div>
                    <div>Timestamp: <strong className="text-slate-200">{new Date(lastDecision.timestamp).toLocaleTimeString()}</strong></div>
                  </div>
                </div>
              )}

              {/* Security Boundary Invariant Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-850/60 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-200 block">Default Deny</span>
                    <span className="text-slate-400 text-[10px]">Zero-trust default: all unmapped actions rejected.</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-850/60 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-200 block">Immutable Released</span>
                    <span className="text-slate-400 text-[10px]">Released revisions cannot be directly modified or deleted.</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-850/60 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-200 block">Four-Eyes Principle</span>
                    <span className="text-slate-400 text-[10px]">Creators barred from self-approving changes/ECOs.</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* 5. Tab 2: Project Membership Directory */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <Users className="w-5 h-5 text-teal-400" /> Project Membership Directory
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Assigned roles and lifecycle statuses in {projectId}</p>
              </div>

              {/* Add Member Bar */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="NEW_USER_ID"
                  id="new-user-input"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 w-36"
                />
                <select id="new-user-role" className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-mono text-slate-200">
                  <option value="ENGINEER">ENGINEER</option>
                  <option value="CAE_ENGINEER">CAE_ENGINEER</option>
                  <option value="CAM_ENGINEER">CAM_ENGINEER</option>
                  <option value="REVIEWER">REVIEWER</option>
                  <option value="QUALITY">QUALITY</option>
                  <option value="SUPPLIER">SUPPLIER</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="AUDITOR">AUDITOR</option>
                </select>
                <button
                  onClick={() => {
                    const input = document.getElementById('new-user-input') as HTMLInputElement;
                    const roleSelect = document.getElementById('new-user-role') as HTMLSelectElement;
                    if (input.value) {
                      handleAddMember(input.value.trim().toUpperCase(), roleSelect.value as EngineeringRole);
                      input.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Provision</span>
                </button>
              </div>
            </div>

            {/* Membership Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-mono">
                    <th className="py-2.5 px-3">User Identifier</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Provisioned By</th>
                    <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                  {members.map(m => (
                    <tr key={m.userId} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-teal-400 border border-slate-700">
                          {(m.userId || 'US').substring(0, 2)}
                        </div>
                        <span>{m.userId || 'Unknown'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.status === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : m.status === 'SUSPENDED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{m.grantedBy}</td>
                      <td className="py-3 px-3 text-right space-x-1.5">
                        {m.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleUpdateStatus(m.userId, 'SUSPENDED')}
                            className="px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-800/40 rounded-lg text-[10px] font-bold transition"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(m.userId, 'ACTIVE')}
                            className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 rounded-lg text-[10px] font-bold transition"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(m.userId, 'REMOVED')}
                          className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 rounded-lg text-[10px] font-bold transition"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* 6. Tab 3: RBAC Role-Permission Matrix */}
      {activeTab === 'MATRIX' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                <KeyRound className="w-5 h-5 text-teal-400" /> Engineering Role-Permission Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Explicit authorization mapping across domain disciplines</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                    <th className="py-2.5 px-3 text-left">Role Title</th>
                    <th className="py-2 px-2">CAD Part Create/Edit</th>
                    <th className="py-2 px-2">Assembly Constrain</th>
                    <th className="py-2 px-2">FEM/CFD Solve</th>
                    <th className="py-2 px-2">CAM G-Code</th>
                    <th className="py-2 px-2">Drawing Release</th>
                    <th className="py-2 px-2">ECO Approval</th>
                    <th className="py-2 px-2">Production Release</th>
                    <th className="py-2 px-2">User Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {[
                    { role: 'OWNER', cad: true, asm: true, cae: true, cam: true, dwg: true, eco: true, rel: true, adm: true },
                    { role: 'PROJECT_ADMIN', cad: true, asm: true, cae: false, cam: true, dwg: true, eco: true, rel: false, adm: true },
                    { role: 'ENGINEER', cad: true, asm: true, cae: true, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'DESIGNER', cad: true, asm: true, cae: false, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'CAE_ENGINEER', cad: false, asm: false, cae: true, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'CAM_ENGINEER', cad: false, asm: false, cae: false, cam: true, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'REVIEWER', cad: false, asm: false, cae: false, cam: false, dwg: false, eco: true, rel: false, adm: false },
                    { role: 'QUALITY', cad: false, asm: false, cae: false, cam: false, dwg: true, eco: true, rel: false, adm: false },
                    { role: 'MANUFACTURING', cad: false, asm: false, cae: false, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'SUPPLIER', cad: false, asm: false, cae: false, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'VIEWER', cad: false, asm: false, cae: false, cam: false, dwg: false, eco: false, rel: false, adm: false },
                    { role: 'AUDITOR', cad: false, asm: false, cae: false, cam: false, dwg: false, eco: false, rel: false, adm: false }
                  ].map(row => (
                    <tr key={row.role} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 text-left font-bold text-white">{row.role}</td>
                      <td className="py-2 px-2">{row.cad ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.asm ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.cae ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.cam ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.dwg ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.eco ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.rel ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                      <td className="py-2 px-2">{row.adm ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* 7. Tab 4: Security Audit Trail */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <History className="w-5 h-5 text-teal-400" /> Security Audit Log Stream
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Immutable event trail for all authorization decisions</p>
              </div>

              {/* Classification filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200"
                >
                  <option value="ALL">ALL EVENTS</option>
                  <option value="NORMAL_ALLOW">NORMAL_ALLOW</option>
                  <option value="NORMAL_DENIAL">NORMAL_DENIAL</option>
                  <option value="PRIVILEGE_ESCALATION_ATTEMPT">PRIVILEGE_ESCALATION_ATTEMPT</option>
                  <option value="CROSS_PROJECT_ACCESS">CROSS_PROJECT_ACCESS</option>
                  <option value="CROSS_TENANT_ACCESS">CROSS_TENANT_ACCESS</option>
                  <option value="UNAUTHORIZED_MUTATION_ATTEMPT">UNAUTHORIZED_MUTATION_ATTEMPT</option>
                  <option value="AI_UNAUTHORIZED_MUTATION">AI_UNAUTHORIZED_MUTATION</option>
                </select>
              </div>
            </div>

            {/* Audit List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredLogs.map(log => (
                <div 
                  key={log.eventId}
                  className={`p-3 bg-slate-950 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-mono ${
                    log.decision === 'ALLOW' ? 'border-slate-800/80 hover:border-emerald-500/30' : 'border-rose-900/40 hover:border-rose-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      log.decision === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {log.decision}
                    </span>
                    <span className="text-slate-300 font-bold">{log.userId}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-teal-400 font-bold">{log.action}</span>
                    <span className="text-slate-400 font-bold">[{log.resource}]</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {log.classification}
                    </span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* 8. Tab 5: Hard Acceptance Gate 293 Report */}
      {activeTab === 'GATE' && testReport && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <Award className="w-5 h-5 text-teal-400" /> Hard Acceptance Gate 293 Execution Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">24 Comprehensive Security Invariant & Regression Checks</p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                testReport.passed 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {testReport.passedChecks} / {testReport.totalChecks} PASSED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testReport.checks.map(c => (
                <div 
                  key={c.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                    c.passed ? 'bg-slate-950/80 border-slate-800/80 text-slate-300' : 'bg-rose-950/20 border-rose-800/50 text-rose-300'
                  }`}
                >
                  {c.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">{c.name}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">{c.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{c.message}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
