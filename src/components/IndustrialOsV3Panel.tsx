import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, Zap, Activity, GitPullRequest, Database, Layers, FileCheck, CheckCircle, AlertTriangle, PlayCircle, Server, FileText, Clock, Terminal, RotateCcw, PlusCircle, UserCheck, GitBranch, Search, BookOpen, ArrowRight } from 'lucide-react';
import { HardAcceptanceGate190, IntegrationTestReport } from '../engine/industrial-os/HardAcceptanceGate190';
import { EngineeringObjectOS } from '../engine/industrial-os/EngineeringObjectOS';
import { EngineeringStateMachine } from '../engine/industrial-os/state-machine/EngineeringStateMachine';
import { EngineeringEventStore } from '../engine/industrial-os/event-model/EngineeringEventStore';
import { EvidenceBus } from '../engine/industrial-os/evidence-bus/EvidenceBus';
import { EngineeringObjectType } from '../engine/identity/CanonicalEngineeringIdentity';
import { AdvancedCadWorkbench } from './AdvancedCadWorkbench';

export function IndustrialOsV3Panel() {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'ledger' | 'gate' | 'architecture' | 'cad_expansion'>('sandbox');
  
  // Real-time local state instances
  const [osInstance] = useState(() => new EngineeringObjectOS());
  const [stateMachine] = useState(() => EngineeringStateMachine.getInstance());
  const [eventStore] = useState(() => EngineeringEventStore.getInstance());
  const [evidenceBus] = useState(() => EvidenceBus.getInstance());

  // Interactive sandbox states
  const [objectId, setObjectId] = useState('OBJ-CAD-190');
  const [objectType, setObjectType] = useState<EngineeringObjectType>(EngineeringObjectType.ASSEMBLY);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [creator, setCreator] = useState('lead-designer');
  const [partNumber, setPartNumber] = useState('SECP-190-PN');
  const [registeredObjects, setRegisteredObjects] = useState<any[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  
  // Action state
  const [transitionTarget, setTransitionTarget] = useState<'ACTIVE' | 'VALIDATED' | 'ARCHIVED'>('ACTIVE');
  const [transitionReason, setTransitionReason] = useState('Design finalized and parsed');
  const [hasEvidence, setHasEvidence] = useState(false);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  
  // Hard Acceptance Gate execution state
  const [gateReport, setGateReport] = useState<IntegrationTestReport | null>(null);
  const [isRunningGate, setIsRunningGate] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load & refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  const addSandboxLog = (msg: string) => {
    setSandboxLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    // Populate registered objects list
    const objects = osInstance.listAll ? osInstance.listAll() : [];
    setRegisteredObjects(objects);
  }, [refreshKey, osInstance]);

  // Clean initialization
  const resetSandbox = () => {
    osInstance.clear();
    eventStore.clear();
    evidenceBus.clear();
    setSandboxLogs([]);
    addSandboxLog("Industrial OS v3 registry and Forensic Ledger completely reset.");
    setRefreshKey(prev => prev + 1);
    setSelectedObjectId('');
  };

  // Register dynamic object
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parentList = selectedParentId ? [selectedParentId] : [];
      const newObj = osInstance.register({
        id: objectId,
        objectType,
        author: creator,
        projectId: 'PROJECT-V3-SANDBOX',
        dependencies: parentList,
        metadata: {
          partNumber,
          registeredAt: new Date().toISOString(),
          versionCode: 'REV-A'
        }
      });

      addSandboxLog(`SUCCESS: Registered object "${newObj.id}" (${newObj.identity.objectType}) with identity: ${newObj.identity.identityId.substring(0, 16)}...`);
      setRefreshKey(prev => prev + 1);
      setSelectedObjectId(newObj.id);
      // Reset input fields sequentially
      setObjectId(`OBJ-${(registeredObjects.length + 2).toString().padStart(4, '0')}`);
    } catch (err: any) {
      addSandboxLog(`ERROR registering object: ${err.message}`);
    }
  };

  // State machine transition
  const handleTransition = () => {
    if (!selectedObjectId) {
      addSandboxLog("WARNING: Please select an object from the registry list.");
      return;
    }
    try {
      // If VALIDATED, we optionally supply evidence through evidenceBus
      if (transitionTarget === 'VALIDATED') {
        if (hasEvidence) {
          const targetObj = osInstance.resolve(selectedObjectId);
          if (targetObj) {
            const envelope = evidenceBus.publishSync({
              evidenceType: 'STATE_EVIDENCE',
              sourceCapability: 'capability:industrial_os.object_os',
              sourceOperation: 'manual-validation',
              engineeringObjectId: targetObj.id,
              subjectIdentityId: targetObj.identity.identityId,
              author: creator,
              payload: { valid: true }
            });
            // Update canonical state with verified cryptographic EvidenceEnvelope
            osInstance.attachEvidence(targetObj.id, envelope, creator);
            addSandboxLog(`Cryptographic Evidence [${envelope.id}] published and attached for: ${targetObj.id}`);
          }
        }
      }

      osInstance.transitionState(selectedObjectId, transitionTarget, creator, {
        reason: transitionReason,
        verificationEvidenceExists: hasEvidence
      });

      addSandboxLog(`SUCCESS: Transitioned object "${selectedObjectId}" state to ${transitionTarget}`);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      addSandboxLog(`TRANSITION REJECTED: ${err.message}`);
    }
  };

  // Revise parent object (Triggers cascading invalidation)
  const handleRevise = (objId: string) => {
    try {
      const obj = osInstance.resolve(objId);
      if (!obj) return;

      addSandboxLog(`Revising parent object "${objId}" from REV-A to REV-B...`);
      osInstance.createRevision(objId, 'REV-B', creator, 'Engineering revision update to parent component');

      addSandboxLog(`SUCCESS: Revision created. Cascading Invalidation signal emitted over Event Bus.`);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      addSandboxLog(`REVISION FAILED: ${err.message}`);
    }
  };

  // Trigger Hard Gate Suite
  const runGateSuite = () => {
    setIsRunningGate(true);
    addSandboxLog("Triggered complete Industrial OS v3 16-Point Hard Acceptance Gate Evaluation...");
    setTimeout(() => {
      const report = HardAcceptanceGate190.evaluateSuite();
      setGateReport(report);
      setIsRunningGate(false);
      addSandboxLog(`Gate Suite evaluated. Result: ${report.verdict}`);
    }, 1200);
  };

  const filteredObjects = registeredObjects.filter(obj => 
    obj.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.identity.objectType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allEvents = eventStore.query ? eventStore.query({}) : [];

  return (
    <div className="bg-slate-950 text-slate-100 min-h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col font-sans" id="secp-os-v3-root">
      
      {/* Banner Area */}
      <header className="px-8 py-6 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Zap className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              SECP Industrial OS <span className="text-emerald-400">Kernel Studio</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Truth-thread orchestrator & Advanced CAD expansion.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 font-mono">
          <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] flex items-center gap-2 shadow-inner">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Registry: <strong className="text-white tabular-nums">{registeredObjects.length}</strong> Nodes</span>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] flex items-center gap-2 shadow-inner">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Events: <strong className="text-white tabular-nums">{allEvents.length}</strong> Signed</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 px-8 shrink-0 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`px-6 py-4 text-xs font-mono font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sandbox' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          SANDBOX
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-6 py-4 text-xs font-mono font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ledger' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          FORENSIC LEDGER
        </button>
        <button
          onClick={() => setActiveTab('gate')}
          className={`px-6 py-4 text-xs font-mono font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'gate' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          HARD GATE
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-6 py-4 text-xs font-mono font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'architecture' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          BLUEPRINTS
        </button>
        <button
          onClick={() => setActiveTab('cad_expansion')}
          className={`px-6 py-4 text-xs font-mono font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'cad_expansion' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          ADVANCED KERNEL
        </button>
      </div>

      {/* Tab Contents */}
      <main className="flex-1 overflow-y-auto p-6 min-h-[450px]">
        <AnimatePresence mode="wait">
          
          {/* SANDBOX TAB */}
          {activeTab === 'sandbox' && (
            <motion.div
              key="sandbox-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* Left Column: Register & Transition Controls */}
              <div className="lg:col-span-4 space-y-6 flex flex-col">
                
                {/* Section 1: Object Registration */}
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    Register Object
                  </h3>
                  
                  <form onSubmit={handleRegister} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">OBJECT ID</label>
                      <input
                        type="text"
                        value={objectId}
                        onChange={(e) => setObjectId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">TYPE</label>
                        <select
                          value={objectType}
                          onChange={(e) => setObjectType(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                        >
                          <option value={EngineeringObjectType.ASSEMBLY}>ASSEMBLY</option>
                          <option value={EngineeringObjectType.PART}>PART</option>
                          <option value={EngineeringObjectType.MESH}>MESH</option>
                          <option value={EngineeringObjectType.GEOMETRY}>GEOMETRY</option>
                          <option value={EngineeringObjectType.SIMULATION}>SIMULATION</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">CREATOR ID</label>
                        <input
                          type="text"
                          value={creator}
                          onChange={(e) => setCreator(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">UPSTREAM DEPENDENCY</label>
                      <select
                        value={selectedParentId}
                        onChange={(e) => setSelectedParentId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">-- None (Root Node) --</option>
                        {registeredObjects.map(obj => (
                          <option key={obj.id} value={obj.id}>{obj.id} ({obj.status})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">PART NUMBER</label>
                      <input
                        type="text"
                        value={partNumber}
                        onChange={(e) => setPartNumber(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-mono font-bold text-xs transition-all flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Register in ObjectOS
                    </button>
                  </form>
                </div>

                {/* Section 2: Transitions */}
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-blue-400" />
                    Transition State Machine
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">TARGET STATE</label>
                      <select
                        value={transitionTarget}
                        onChange={(e) => setTransitionTarget(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                      >
                        <option value="ACTIVE">ACTIVE (Requires DRAFT)</option>
                        <option value="VALIDATED">VALIDATED (Requires ACTIVE + Evidence)</option>
                        <option value="ARCHIVED">ARCHIVED (Any)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">REASON / NOTES</label>
                      <input
                        type="text"
                        value={transitionReason}
                        onChange={(e) => setTransitionReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {transitionTarget === 'VALIDATED' && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-blue-900/30 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-200">Include Proof Evidence</p>
                          <p className="text-[9px] text-slate-400">Prerequisite to avoid rejection</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasEvidence}
                          onChange={(e) => setHasEvidence(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-blue-500 focus:ring-0 focus:outline-none"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleTransition}
                      disabled={!selectedObjectId}
                      className={`w-full py-2 rounded-lg font-mono font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                        selectedObjectId
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Execute Transition
                    </button>
                  </div>
                </div>

              </div>

              {/* Middle & Right Column: Registry & Dependency Visualizations */}
              <div className="lg:col-span-8 space-y-6 flex flex-col">
                
                {/* Object Registry List */}
                <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex-1 flex flex-col space-y-4 min-h-[350px]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                        Active Kernel Registry
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Select any object to transition state, inspect metadata, or trigger revision cascades.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search nodes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] font-mono text-slate-300 w-full focus:outline-none focus:border-slate-700"
                        />
                      </div>
                      <button
                        onClick={resetSandbox}
                        className="px-2.5 py-1.5 rounded-lg border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-900/20 text-[11px] font-mono transition-all flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset OS
                      </button>
                    </div>
                  </div>

                  {/* Registered Objects Grid */}
                  <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-1">
                    {filteredObjects.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950">
                        <Layers className="w-8 h-8 text-slate-600 mb-2" />
                        <p className="text-xs text-slate-400">No objects registered in this session.</p>
                        <p className="text-[10px] text-slate-600 mt-1">Use the left panel to populate the Kernel Registry with B-Breps or FEA meshes.</p>
                      </div>
                    ) : (
                      filteredObjects.map(obj => {
                        const isSelected = selectedObjectId === obj.id;
                        return (
                          <div
                            key={obj.id}
                            onClick={() => setSelectedObjectId(obj.id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-slate-950 border-emerald-500/50 shadow-emerald-500/5'
                                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-1.5 rounded-lg ${
                                obj.status === 'VALIDATED' ? 'bg-emerald-500/10 text-emerald-400' :
                                obj.status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-400' :
                                obj.status === 'INVALIDATED' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                              }`}>
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-200">{obj.id}</span>
                                  <span className={`px-1.5 py-0.5 text-[8px] font-mono font-bold rounded uppercase ${
                                    obj.status === 'VALIDATED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    obj.status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    obj.status === 'INVALIDATED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    'bg-slate-800 text-slate-400'
                                  }`}>
                                    {obj.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[9px] text-slate-400 mt-1">
                                  <span className="flex items-center gap-1"><UserCheck className="w-3 h-3 text-slate-500" /> {obj.createdBy}</span>
                                  <span>•</span>
                                  <span>Type: <strong className="text-slate-300">{obj.identity.objectType}</strong></span>
                                  {obj.dependencies.length > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-400">Depends on: {obj.dependencies.join(', ')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions / Info */}
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                              {obj.status === 'VALIDATED' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevise(obj.id);
                                  }}
                                  className="px-2 py-1 bg-red-950/40 hover:bg-red-950/60 border border-red-900/30 text-red-400 text-[10px] font-mono rounded-lg transition-all flex items-center gap-1"
                                  title="Triggers cascading dependency invalidation on child nodes"
                                >
                                  <GitPullRequest className="w-3 h-3" /> Revise Upstream (REV-B)
                                </button>
                              )}
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                                REV: {obj.identity.revisionId}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Sandbox Telemetry Console */}
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        OS Micro-Telemetry Console
                      </span>
                      <button 
                        onClick={() => setSandboxLogs([])} 
                        className="text-[9px] font-mono text-slate-500 hover:text-slate-300"
                      >
                        Clear console
                      </button>
                    </div>
                    <div className="h-[120px] overflow-y-auto font-mono text-[10px] space-y-1.5 text-slate-400 pr-1">
                      {sandboxLogs.length === 0 ? (
                        <p className="text-slate-600 italic">No operations recorded. Try registering an object or transitioning its state.</p>
                      ) : (
                        sandboxLogs.map((log, index) => {
                          const isError = log.includes('ERROR') || log.includes('REJECTED');
                          const isSuccess = log.includes('SUCCESS');
                          const isWarning = log.includes('WARNING');
                          return (
                            <p key={index} className={
                              isError ? 'text-red-400 border-l border-red-500 pl-1.5' :
                              isSuccess ? 'text-emerald-400 border-l border-emerald-500 pl-1.5' :
                              isWarning ? 'text-amber-400 border-l border-amber-500 pl-1.5' : 'text-slate-400'
                            }>
                              {log}
                            </p>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </motion.div>
          )}

          {/* LEDGER TAB */}
          {activeTab === 'ledger' && (
            <motion.div
              key="ledger-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                      Physical Forensic Evidence Ledger (Event Store)
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Immutable audit trail of signed engineering events. Replaying this sequence reconstructs states perfectly.</p>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-mono bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> SECURE LEDGER
                  </span>
                </div>

                {allEvents.length === 0 ? (
                  <div className="text-center p-12 bg-slate-950 border border-slate-800 rounded-xl">
                    <Database className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Forensic ledger is currently empty.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Perform registry operations inside the Sandbox tab to write signed records to the ledger.</p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
                    {allEvents.map((ev, index) => (
                      <div key={ev.id || index} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 font-mono text-[10px]">
                        
                        {/* Event Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600">#{ev.sequence}</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold uppercase">{ev.eventType}</span>
                            <span className="text-slate-500 text-[9px]">{ev.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px]">
                            <span className="text-slate-500">ID:</span>
                            <span className="text-slate-300">{ev.id}</span>
                          </div>
                        </div>

                        {/* Event Metadata */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-400">
                          <div>
                            <span className="block text-[8px] text-slate-600 mb-0.5">ACTOR</span>
                            <strong className="text-slate-200">{ev.actor.id} ({ev.actor.type})</strong>
                          </div>
                          <div>
                            <span className="block text-[8px] text-slate-600 mb-0.5">SOURCE</span>
                            <strong className="text-slate-200">{ev.source.component} v{ev.source.version}</strong>
                          </div>
                          <div>
                            <span className="block text-[8px] text-slate-600 mb-0.5">CORRELATION ID</span>
                            <strong className="text-slate-300">{ev.correlationId}</strong>
                          </div>
                          <div>
                            <span className="block text-[8px] text-slate-600 mb-0.5">OBJECT REFS</span>
                            <strong className="text-slate-200 text-[9px]">{ev.objectRefs.join(', ') || 'None'}</strong>
                          </div>
                        </div>

                        {/* Cryptographic Attestations */}
                        <div className="p-2.5 bg-slate-900/50 border border-slate-800/40 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] text-slate-400">
                          <div className="flex items-start gap-1.5">
                            <span className="text-slate-600">Payload Hash:</span>
                            <span className="text-slate-300 break-all">{ev.provenance?.payloadHash || 'N/A'}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <span className="text-slate-600">Crypto Signature:</span>
                            <span className="text-emerald-500 break-all">{ev.provenance?.signature || 'N/A'}</span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* GATE TAB */}
          {activeTab === 'gate' && (
            <motion.div
              key="gate-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Right: Evaluator Controls */}
                <div className="lg:col-span-4 p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4 h-fit">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                        Gate Orchestrator
                      </h3>
                      <p className="text-[10px] text-slate-500">Rigorous 16-point compliance verifier.</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Executes deterministic integration verifications across all 13 core subsystems. Enforces the anti-bypass execution constraints, verification contracts, and dependency trees.
                  </p>

                  <button
                    onClick={runGateSuite}
                    disabled={isRunningGate}
                    className={`w-full py-3 rounded-xl font-mono font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isRunningGate 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/15'
                    }`}
                  >
                    {isRunningGate ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" /> Evaluating Kernel Integrity...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4" /> Run 16-Point Integration Gate
                      </>
                    )}
                  </button>

                  {gateReport && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/60 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-300 font-mono">Verdict</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        gateReport.verdict === 'PASS' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {gateReport.verdict}
                      </span>
                    </div>
                  )}
                </div>

                {/* Left: Gate Suite Report Card */}
                <div className="lg:col-span-8 p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                      Integrity Verifier Report Card
                    </h3>
                    <span className="text-[9px] font-mono text-slate-500">
                      {gateReport ? `Last Verified: ${gateReport.timestamp}` : 'Not evaluated in this turn.'}
                    </span>
                  </div>

                  {!gateReport ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <Shield className="w-12 h-12 text-slate-700 animate-pulse" />
                      <p className="text-xs text-slate-400">Awaiting Hard Acceptance Gate evaluation.</p>
                      <p className="text-[10px] text-slate-600 max-w-sm">
                        Click the &quot;Run 16-Point Integration Gate&quot; button to launch deterministic, non-mocked verification of the SECP Industrial OS v3 Architecture.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      
                      {/* Grid of checks */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(gateReport.checks).map(([checkKey, passed]) => {
                          // Format checkKey nicely
                          const label = checkKey
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase());
                          return (
                            <div key={checkKey} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400 text-[10px]">{label}</span>
                              <div className="flex items-center gap-1 text-[10px]">
                                {passed ? (
                                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> SECURE</span>
                                ) : (
                                  <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> FAILED</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Execution Terminal */}
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 font-mono text-[9px] text-slate-400">
                        <p className="text-slate-500 uppercase tracking-wider font-bold">Execution Steps Log</p>
                        <div className="max-h-[140px] overflow-y-auto space-y-1">
                          {gateReport.executionLogs.map((log, idx) => (
                            <p key={idx} className={log.includes('FAIL') ? 'text-red-400' : log.includes('PASS') ? 'text-emerald-400' : 'text-slate-400'}>
                              {log}
                            </p>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                </div>

              </div>
            </motion.div>
          )}

          {/* ARCHITECTURE TAB */}
          {activeTab === 'architecture' && (
            <motion.div
              key="architecture-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs"
            >
              
              {/* Card 1: Object Model & State Machine */}
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-400">
                  <Layers className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-200">Engineering Object Model</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Binds physical CAD attributes, CSG topologies, and GCS constraints into a single cryptographic record. Tracks revisions using parent hash pointers forming a directed acyclic graph (DAG) of the engineering lineage.
                </p>
                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1 text-[10px] text-slate-400">
                  <p className="text-blue-400 font-semibold">Active State Rules:</p>
                  <p>• DRAFT → ACTIVE</p>
                  <p>• ACTIVE → VALIDATED (requires evidence)</p>
                  <p>• ANY → ARCHIVED</p>
                </div>
              </div>

              {/* Card 2: Forensic Ledger */}
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-200">Forensic Evidence Network</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Acts as the append-only database of signed events. Publishes to the Evidence Bus, allowing real-time monitoring and auditing of design steps, simulation constraints, and G-Code conversions.
                </p>
                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1 text-[10px] text-slate-400">
                  <p className="text-emerald-400 font-semibold">Cryptographic Standards:</p>
                  <p>• SHA-256 Payload Hashing</p>
                  <p>• Sequence-bound Chaining</p>
                  <p>• Digital attestation signatures</p>
                </div>
              </div>

              {/* Card 3: Governance & Policy */}
              <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-200">Enterprise Governance</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Performs real-time role-based access control (RBAC), capability qualification checkups, and separation of duties validation for critical manufacturing releases, verifying compliance prior to any state transition.
                </p>
                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1 text-[10px] text-slate-400">
                  <p className="text-purple-400 font-semibold">Evaluator Engines:</p>
                  <p>• EnterpriseGovernanceEngine</p>
                  <p>• EngineeringPolicyEngine</p>
                  <p>• ApprovalGovernanceService</p>
                </div>
              </div>

            </motion.div>
          )}

          {/* ADVANCED CAD KERNEL TAB */}
          {activeTab === 'cad_expansion' && (
            <motion.div
              key="cad-expansion-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              <AdvancedCadWorkbench />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Area */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 px-8 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
        <span className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500/50" /> NATIVE SECP ARCHITECTURE VERIFIED</span>
        <span className="tabular-nums opacity-50 uppercase tracking-tighter">Production Build v3.1.0-STABLE</span>
      </footer>

    </div>
  );
}
