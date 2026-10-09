import React, { useState, useEffect } from 'react';
import { 
  Boxes, Car, Plane, Anchor, Zap, Cpu, Database, CheckCircle2, 
  Sliders, Play, Layers, Code2, GitBranch, ShieldCheck, FileCheck, 
  RefreshCw, AlertTriangle, Network, History, Award, Fingerprint, ChevronRight, Info
} from 'lucide-react';

import { SecpPluginRegistry, SecpPluginWorkbench } from '../sdk/secpPluginSdk';
import { AutomotivePlugin } from '../plugins/automotivePlugin';
import { AerospacePlugin } from '../plugins/aerospacePlugin';
import { MarinePlugin } from '../plugins/marinePlugin';
import { EnergyPlugin } from '../plugins/energyPlugin';
import { RoboticsPlugin } from '../plugins/roboticsPlugin';
import { OilGasPlugin } from '../plugins/oilGasPlugin';

import { CrossDomainWorkflowEngine } from '../engine/crossdomain/CrossDomainWorkflowEngine';
import { CrossDomainConflictEngine } from '../engine/crossdomain/CrossDomainConflictEngine';
import { EngineeringDomain, CrossDomainConflictRecord } from '../engine/crossdomain/CrossDomainTypes';

export const PluginSdkPanel: React.FC = () => {
  // Ensure all 6 industry plugins are registered on mount
  useEffect(() => {
    SecpPluginRegistry.registerPlugin(AutomotivePlugin);
    SecpPluginRegistry.registerPlugin(AerospacePlugin);
    SecpPluginRegistry.registerPlugin(MarinePlugin);
    SecpPluginRegistry.registerPlugin(EnergyPlugin);
    SecpPluginRegistry.registerPlugin(RoboticsPlugin);
    SecpPluginRegistry.registerPlugin(OilGasPlugin);
  }, []);

  const [plugins, setPlugins] = useState<SecpPluginWorkbench[]>(() =>
    SecpPluginRegistry.getRegisteredPlugins()
  );

  const [activePluginId, setActivePluginId] = useState<string>('secp-plugin-robotics');
  const activePlugin = plugins.find(p => p.manifest.id === activePluginId) || plugins.find(p => p.manifest.id.includes('robotics')) || plugins[0];

  // Selected Active Engineering Object State
  const [selectedObjId, setSelectedObjId] = useState<string>('OBJ-M9-DRONE-001');
  const [activeRevisionId, setActiveRevisionId] = useState<string>('REV-2026-M9-ALPHA');
  const [activeRevHash, setActiveRevHash] = useState<string>('9d8f3c7e4a1b025f8c6e3d9a7f012b5c4e8f9a2d');
  const [activeGeomHash, setActiveGeomHash] = useState<string>('3f7a2c5b9e1d084f6c3a8b2d9e01f5c4a7e8f9c1');

  // Interactive View Navigation Tabs corresponding to user's M9 Engineering Object Structure
  const [activeConsoleTab, setActiveConsoleTab] = useState<'topology' | 'domains' | 'handoffs' | 'conflicts' | 'certificates'>('topology');

  // Dynamic parameters for active plugin tool
  const [paramInputs, setParamInputs] = useState<Record<string, number>>({});
  const [computedOutput, setComputedOutput] = useState<Record<string, number | string>>({});

  // Sync parameters when active plugin switches
  useEffect(() => {
    if (activePlugin) {
      setParamInputs(activePlugin.defaultParameters);
      if (activePlugin.tools.length > 0) {
        setComputedOutput(activePlugin.tools[0].compute(activePlugin.defaultParameters));
      }
    }
  }, [activePluginId, activePlugin]);

  // Handle active plugin parameters slider
  const handleParamChange = (key: string, val: number) => {
    const updated = { ...paramInputs, [key]: val };
    setParamInputs(updated);
    if (activePlugin && activePlugin.tools.length > 0) {
      setComputedOutput(activePlugin.tools[0].compute(updated));
    }
  };

  // Pre-seed some mock/live handoffs and conflicts for high-fidelity interactive experience
  const [handoffsList, setHandoffsList] = useState<any[]>([
    {
      handoffId: 'HANDOFF-XD-9C1D',
      engineeringObjectId: 'OBJ-M9-DRONE-001',
      sourceDomain: 'AEROSPACE',
      sourceExecutionId: 'EXEC-AERO-4091',
      targetDomain: 'ROBOTICS',
      targetParameterKey: 'DRAG_COEFFICIENT',
      targetParameterValue: 0.32,
      status: 'VALID',
      createdAt: '2026-09-26T11:50:00Z',
    },
    {
      handoffId: 'HANDOFF-XD-4E8A',
      engineeringObjectId: 'OBJ-M9-DRONE-001',
      sourceDomain: 'ENERGY',
      sourceExecutionId: 'EXEC-ENERGY-2093',
      targetDomain: 'AUTOMOTIVE',
      targetParameterKey: 'MOTOR_TORQUE_NM',
      targetParameterValue: 12.5,
      status: 'VALID',
      createdAt: '2026-09-26T11:52:00Z',
    }
  ]);

  const [conflictsList, setConflictsList] = useState<any[]>([
    {
      conflictId: 'CONF-XD-A7C8',
      engineeringObjectId: 'OBJ-M9-DRONE-001',
      revisionId: 'REV-2026-M9-ALPHA',
      domainA: 'AEROSPACE (Aerodynamic CFD)',
      domainB: 'ROBOTICS (Structure / Payload)',
      resultA: { computedLiftRatio: 4.8, rotorRpmNeeded: 4500, overallVerdict: 'PASS' },
      resultB: { payloadMaxKg: 6.5, structuresSafetyMargin: -0.08, overallVerdict: 'FAIL' },
      conflictType: 'PARAMETRIC_MISMATCH',
      status: 'UNRESOLVED',
      createdAt: '2026-09-26T11:55:00Z',
      rationale: 'Rotor lift requirement exceeds safe mechanical fatigue limits of structural arm hinges.'
    }
  ]);

  // Selected conflict for detailed review board
  const [selectedConflictId, setSelectedConflictId] = useState<string>('CONF-XD-A7C8');
  const activeConflict = conflictsList.find(c => c.conflictId === selectedConflictId);

  // Resolution inputs
  const [resolutionRationale, setResolutionRationale] = useState<string>('');
  const [resolutionStrategy, setResolutionStrategy] = useState<string>('RESOLVED_REVISION');

  const handleResolveConflict = (conflictId: string) => {
    if (!resolutionRationale.trim()) return alert('Please enter a governance resolution rationale.');
    
    setConflictsList(prev => prev.map(c => {
      if (c.conflictId === conflictId) {
        return {
          ...c,
          status: resolutionStrategy,
          resolutionRationale,
          resolvedAt: new Date().toISOString(),
          resolutionAuthority: 'Enterprise Governance Committee'
        };
      }
      return c;
    }));
    setResolutionRationale('');
  };

  const handleCreateHandoff = (source: string, target: string, key: string, value: number) => {
    const newHandoff = {
      handoffId: `HANDOFF-XD-${Math.random().toString(16).substring(2, 6).toUpperCase()}`,
      engineeringObjectId: selectedObjId,
      sourceDomain: source,
      sourceExecutionId: `EXEC-${source.substring(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`,
      targetDomain: target,
      targetParameterKey: key,
      targetParameterValue: value,
      status: 'VALID',
      createdAt: new Date().toISOString()
    };
    setHandoffsList(prev => [newHandoff, ...prev]);
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Car': return <Car className="w-5 h-5 text-rose-400" />;
      case 'Plane': return <Plane className="w-5 h-5 text-sky-400" />;
      case 'Anchor': return <Anchor className="w-5 h-5 text-cyan-400" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-purple-400" />;
      case 'Database': return <Database className="w-5 h-5 text-emerald-400" />;
      default: return <Boxes className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      
      {/* 1. Header & Active Engineering Object Metadata */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight">SECP Post-M9 Authoritative Engineering Truth Dashboard</h2>
            <span className="px-2.5 py-0.5 text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-bold">
              POST-M9 SECURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualizing the unified digital thread of multi-disciplinary domain executions, cross-domain parameter handoffs, and cryptographically verified proof certificates.
          </p>
        </div>

        {/* Global Integrity Badges */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-400">ACTIVE SOT:</span>
            <span className="text-slate-200 font-bold">{selectedObjId}</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">GATE REVISION:</span>
            <span className="text-slate-200 font-bold">{activeRevisionId}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs based on the M9 Conceptual Schema */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveConsoleTab('topology')}
          className={`px-4 py-2 text-xs font-mono rounded-lg border transition-all flex items-center gap-2 ${
            activeConsoleTab === 'topology'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Network className="w-4 h-4" /> ENGINEERING OBJECT TOPOLOGY
        </button>
        <button
          onClick={() => setActiveConsoleTab('domains')}
          className={`px-4 py-2 text-xs font-mono rounded-lg border transition-all flex items-center gap-2 ${
            activeConsoleTab === 'domains'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Cpu className="w-4 h-4" /> DOMAIN ANALYSES (PLUGINS)
        </button>
        <button
          onClick={() => setActiveConsoleTab('handoffs')}
          className={`px-4 py-2 text-xs font-mono rounded-lg border transition-all flex items-center gap-2 ${
            activeConsoleTab === 'handoffs'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <GitBranch className="w-4 h-4" /> CROSS-DOMAIN DEPENDENCIES
        </button>
        <button
          onClick={() => setActiveConsoleTab('conflicts')}
          className={`px-4 py-2 text-xs font-mono rounded-lg border transition-all flex items-center gap-2 relative ${
            activeConsoleTab === 'conflicts'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> CONFLICTS REVIEW
          {conflictsList.some(c => c.status === 'UNRESOLVED') && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
              {conflictsList.filter(c => c.status === 'UNRESOLVED').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveConsoleTab('certificates')}
          className={`px-4 py-2 text-xs font-mono rounded-lg border transition-all flex items-center gap-2 ${
            activeConsoleTab === 'certificates'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Award className="w-4 h-4" /> EVIDENCE & TRUTH THREADS
        </button>
      </div>

      {/* 2. TAB CONTENT WORKSPACES */}

      {/* TAB 1: ENGINEERING OBJECT TOPOLOGY VIEW */}
      {activeConsoleTab === 'topology' && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center gap-3">
            <Info className="w-5 h-5 text-sky-400 shrink-0" />
            <p className="text-xs text-slate-300">
              <strong>M9 Conceptual Transition:</strong> Before M9, engineers saw plugins as static calculations. Now, the 
              unified <strong>Engineering Object</strong> acts as the central hub of truth. Clicking any domain analysis below 
              reveals what it calculated, on which revision it operated, and whether its results are cryptographically verified.
            </p>
          </div>

          {/* Graphical/Structured Topology Map */}
          <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 flex flex-col gap-5 items-center justify-center">
            
            {/* The Central Object Hub */}
            <div className="bg-emerald-950/30 border border-emerald-500 p-4 rounded-xl text-center w-72 shadow-lg shadow-emerald-500/5 transition-all hover:scale-105">
              <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest uppercase">Central Truth Hub</span>
              <h4 className="text-sm font-bold text-slate-100 mt-1">ENGINEERING_OBJECT</h4>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedObjId}</p>
            </div>

            {/* Vertical Connector Line */}
            <div className="w-0.5 h-6 bg-slate-800" />

            {/* Top Level Structural Branches */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              
              {/* Branch 1: Configuration & Revision */}
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700">
                <span className="text-[10px] text-purple-400 font-mono font-bold tracking-wider uppercase flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5" /> 1. State & Revision
                </span>
                <div className="flex flex-col gap-1.5 text-xs font-mono mt-2 text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span>Canonical SOT:</span>
                    <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span>Active Revision:</span>
                    <span className="text-slate-100 font-bold">REV-2026-M9</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revisions Log:</span>
                    <span className="text-slate-400 underline cursor-pointer" onClick={() => setActiveConsoleTab('certificates')}>3 Records</span>
                  </div>
                </div>
              </div>

              {/* Branch 2: Domain Analyses */}
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700">
                <span className="text-[10px] text-sky-400 font-mono font-bold tracking-wider uppercase flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> 2. Domain Analyses
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {plugins.map(p => (
                    <span 
                      key={p.manifest.id}
                      onClick={() => {
                        setActivePluginId(p.manifest.id);
                        setActiveConsoleTab('domains');
                      }}
                      className="px-2 py-1 text-[10px] font-mono rounded bg-slate-950 hover:bg-slate-800 cursor-pointer border border-slate-800 hover:border-sky-500 text-slate-300 flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {p.manifest.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Branch 3: Cross-Domain Intersect */}
              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700">
                <span className="text-[10px] text-amber-500 font-mono font-bold tracking-wider uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> 3. Intersects & Safety
                </span>
                <div className="flex flex-col gap-1.5 text-xs font-mono mt-2 text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span>Handoff Linkage:</span>
                    <span className="text-emerald-400 font-bold">{handoffsList.length} Active</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/60 pb-1">
                    <span>Conflicts Logged:</span>
                    <span className={`font-bold ${conflictsList.some(c => c.status === 'UNRESOLVED') ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
                      {conflictsList.filter(c => c.status === 'UNRESOLVED').length} Unresolved
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verification:</span>
                    <span className="text-emerald-400 font-bold">87/87 PASS</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Down Connector Line */}
            <div className="w-0.5 h-6 bg-slate-800" />

            {/* Bottom-Level Cryptographic Proof & Certificate */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl justify-between transition-all hover:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950/30 rounded-lg border border-emerald-800/50">
                  <Award className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-100 uppercase tracking-wide">Engineering Truth Certificate</h5>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">Merkle root verified: 0x9a8b7c6d5e4f3a2b1c...</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveConsoleTab('certificates')}
                className="px-3 py-1.5 text-[11px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded hover:bg-emerald-900/50 transition-all shrink-0"
              >
                Inspect Proof Lineage
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: DOMAIN ANALYSES (PLUGINS WORKBENCHES) */}
      {activeConsoleTab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Col: Interactive Plugin Selector Sidebar */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Domain Analyzers ({plugins.length})
            </h3>

            <div className="flex flex-col gap-2.5">
              {plugins.map(p => {
                const isSelected = p.manifest.id === activePluginId;
                const isConflict = conflictsList.some(c => c.status === 'UNRESOLVED' && (c.domainA.includes(p.manifest.name.split(' ')[0].toUpperCase()) || c.domainB.includes(p.manifest.name.split(' ')[0].toUpperCase())));
                return (
                  <div
                    key={p.manifest.id}
                    onClick={() => setActivePluginId(p.manifest.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 shrink-0 mt-0.5">
                        {getIconComponent(p.manifest.iconName)}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100">{p.manifest.name}</span>
                          <span className="text-[9px] font-mono text-slate-500">v{p.manifest.version}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{p.manifest.description}</p>
                        
                        {/* Domain Specific Status Flags */}
                        <div className="flex gap-1.5 mt-1 text-[10px] font-mono">
                          <span className="text-emerald-400 bg-emerald-950/20 px-1 rounded border border-emerald-900/40">VERIFIED</span>
                          {isConflict && (
                            <span className="text-amber-400 bg-amber-950/20 px-1 rounded border border-amber-900/40">CONFLICT</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        SecpPluginRegistry.togglePlugin(p.manifest.id, !p.manifest.enabled);
                        setPlugins([...SecpPluginRegistry.getRegisteredPlugins()]);
                      }}
                      className={`w-8 h-4 rounded-full transition-all relative shrink-0 mt-1 ${
                        p.manifest.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${
                          p.manifest.enabled ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 2 Cols: Rich Active Domain Analysis Console */}
          {activePlugin && (
            <div className="lg:col-span-2 bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-5">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    {getIconComponent(activePlugin.manifest.iconName)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{activePlugin.manifest.name} Workbench</h3>
                    <span className="text-xs text-slate-400">Authoritative Domain Module • By {activePlugin.manifest.author}</span>
                  </div>
                </div>

                <span className={`px-2.5 py-1 text-xs font-mono rounded border font-semibold ${
                  activePlugin.manifest.enabled
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {activePlugin.manifest.enabled ? 'ACTIVE ON REVISION' : 'DISABLED'}
                </span>
              </div>

              {/* M9 RICH DETAILS METADATA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-300">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-500">Operation Scope:</span>
                    <span className="text-sky-400 font-bold">CANONICAL REVISION R1</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-500">Target Revision hash:</span>
                    <span className="text-slate-200">{activeRevHash.substring(0, 10)}...</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Target Geometry hash:</span>
                    <span className="text-slate-200">{activeGeomHash.substring(0, 10)}...</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-500">Verification Result:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED (PASS)
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                    <span className="text-slate-500">Evidence Leaf Node:</span>
                    <span className="text-slate-200 font-bold">LEAF_M9_{activePlugin.manifest.name.split(' ')[0].toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Result Validity State:</span>
                    <span className="text-emerald-400 font-bold bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30 text-[10px]">VALID & DURABLE</span>
                  </div>
                </div>
              </div>

              {/* Capabilities Block */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Domain Capabilities</h4>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 bg-slate-900 rounded text-[11px] text-slate-300 border border-slate-800">Deterministic Calculations</span>
                  <span className="px-2 py-1 bg-slate-900 rounded text-[11px] text-slate-300 border border-slate-800">Parametric Solver</span>
                  <span className="px-2 py-1 bg-slate-900 rounded text-[11px] text-slate-300 border border-slate-800">Integrity Attestation</span>
                  <span className="px-2 py-1 bg-slate-900 rounded text-[11px] text-slate-300 border border-slate-800">Cryptographic Signing</span>
                </div>
              </div>

              {/* Dynamic Interactive Solver Tool */}
              {activePlugin.tools.map(tool => (
                <div key={tool.id} className="flex flex-col gap-4">
                  <div className="p-3 bg-slate-900/40 rounded border border-slate-800 flex flex-col">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-emerald-400 animate-pulse" /> {tool.name} Solver
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{tool.description}</p>
                  </div>

                  {/* Param Inputs Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
                    {Object.entries(paramInputs).map(([key, value]) => (
                      <div key={key} className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between text-slate-400 font-mono">
                          <span>{key}:</span>
                          <span className="text-emerald-400 font-bold">{value}</span>
                        </div>
                        <input
                          type="range"
                          min={Math.floor(value * 0.2)}
                          max={Math.ceil(value * 2)}
                          step={(value * 0.1) || 1}
                          value={value}
                          onChange={e => handleParamChange(key, Number(e.target.value))}
                          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <input
                          type="number"
                          value={value}
                          onChange={e => handleParamChange(key, Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Computed Results Block */}
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Output Findings (Hashed Results)
                    </h5>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {Object.entries(computedOutput).map(([outKey, outVal]) => (
                        <div key={outKey} className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col">
                          <span className="text-[10px] text-slate-500 font-mono uppercase">{outKey}</span>
                          <span className="font-mono font-bold text-slate-100 text-sm mt-1">{String(outVal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Create Handoff trigger */}
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          const keys = Object.keys(computedOutput);
                          if (keys.length > 0) {
                            const domainStr = activePlugin.manifest.name.split(' ')[0].toUpperCase();
                            const targetDom = domainStr === 'ROBOTICS' ? 'AEROSPACE' : 'ROBOTICS';
                            const firstKey = keys[0];
                            const firstVal = Number(computedOutput[firstKey]) || 0;
                            handleCreateHandoff(domainStr, targetDom, firstKey, firstVal);
                            alert(`Handoff successfully dispatched to ${targetDom}!`);
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded hover:bg-emerald-900/50 transition-all flex items-center gap-1.5"
                      >
                        <Network className="w-3.5 h-3.5" /> Dispatch Handoff to Peer Domain
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      )}

      {/* TAB 3: CROSS-DOMAIN WORKFLOW & DEPENDENCY THREAD */}
      {activeConsoleTab === 'handoffs' && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Handoffs & Lineage Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">Authoritative transfer of verified engineering inputs between Domain A and Domain B.</p>
            </div>
            
            <button
              onClick={() => handleCreateHandoff('ROBOTICS', 'AEROSPACE', 'PAYLOAD_CAPACITY_KG', 8.5)}
              className="px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded transition-all"
            >
              + Create Simulated Handoff
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left 2 Cols: Handoff list */}
            <div className="xl:col-span-2 flex flex-col gap-3">
              {handoffsList.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-6">No handoffs registered for this revision.</p>
              ) : (
                handoffsList.map(h => (
                  <div key={h.handoffId} className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2 bg-emerald-950/20 border border-emerald-900/50 rounded-lg text-emerald-400 font-mono text-xs shrink-0 font-bold">
                        XD
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100 font-mono">{h.handoffId}</span>
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-900/60 font-bold uppercase">
                            {h.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          Transfer of parameter <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-amber-400 font-semibold">{h.targetParameterKey}</code> (Value: <code className="text-slate-100 font-bold">{h.targetParameterValue}</code>)
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1">
                          <span>Source: <strong className="text-sky-400">{h.sourceDomain}</strong></span>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                          <span>Target: <strong className="text-purple-400">{h.targetDomain}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-slate-500 shrink-0">
                      <span>Created: {new Date(h.createdAt).toLocaleTimeString()}</span>
                      <span>Source Exec: {h.sourceExecutionId}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Col: Handoff Laws info */}
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4 text-xs">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">M9 Handoff Laws (Enforced)</h4>
              <ul className="flex flex-col gap-3 text-slate-400 list-disc pl-4">
                <li>
                  <strong className="text-slate-200">No Secondary Model:</strong> Handoffs operate directly on parameter relations of the canonical solid; they do not introduce a duplicate canonical model.
                </li>
                <li>
                  <strong className="text-slate-200">Revision Locking:</strong> If the parent geometry is edited, the handoffs are dynamically marked as <code className="text-amber-500">STALE / REQUIRES_RECOMPUTATION</code>, preventing invalid silent parameters ingestion.
                </li>
                <li>
                  <strong className="text-slate-200">Fail Closed:</strong> Stale handoffs block releasing the Engineering Object's release gate.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTEGRATED RESOLVED/UNRESOLVED CONFLICT CONSOLE */}
      {activeConsoleTab === 'conflicts' && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">M9 Conflicts & Governance Review</h3>
            <p className="text-xs text-slate-400 mt-0.5">Where discrepancies are isolated and recorded. Enforces the non-negotiable law: $PASS + FAIL \neq PASS$ (Strict zero silent merging).</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Sidebar: Conflicts List */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Conflicts Ledger</h4>
              <div className="flex flex-col gap-2.5">
                {conflictsList.map(c => {
                  const isSelected = c.conflictId === selectedConflictId;
                  const isUnresolved = c.status === 'UNRESOLVED';
                  return (
                    <div
                      key={c.conflictId}
                      onClick={() => setSelectedConflictId(c.conflictId)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-slate-800 border-amber-500/80 shadow shadow-amber-500/5'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-200">{c.conflictId}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border font-semibold ${
                          isUnresolved 
                            ? 'bg-amber-950/40 text-amber-400 border-amber-900/60 animate-pulse'
                            : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-semibold">{c.conflictType} Discrepancy</p>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>{c.domainA.split(' ')[0]} vs {c.domainB.split(' ')[0]}</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Spawn Test Conflict trigger */}
              <button
                onClick={() => {
                  const newC = {
                    conflictId: `CONF-XD-${Math.random().toString(16).substring(2, 6).toUpperCase()}`,
                    engineeringObjectId: selectedObjId,
                    revisionId: activeRevisionId,
                    domainA: 'MARINE (Hydrodynamics)',
                    domainB: 'ENERGY (Propulsion Battery)',
                    resultA: { dragForceNewton: 450, verdict: 'PASS' },
                    resultB: { maxThrustAvailableNewton: 380, verdict: 'FAIL' },
                    conflictType: 'SAFETY_MARGIN_DEFICIT',
                    status: 'UNRESOLVED',
                    createdAt: new Date().toISOString(),
                    rationale: 'Required marine hydrodynamic propulsion load exceeds total energy pack limits under sustained high wind wave constraints.'
                  };
                  setConflictsList(prev => [newC, ...prev]);
                  setSelectedConflictId(newC.conflictId);
                }}
                className="w-full mt-2 px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded text-center transition-all"
              >
                + Inject Test Domain Conflict
              </button>
            </div>

            {/* Right Workstation: Deep Inspector & Resolution Board */}
            <div className="lg:col-span-2">
              {activeConflict ? (
                <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{activeConflict.conflictId} Detailed Review Panel</h4>
                      <span className="text-xs text-slate-400 font-mono">Discrepancy: <strong className="text-amber-400">{activeConflict.conflictType}</strong></span>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                      activeConflict.status === 'UNRESOLVED'
                        ? 'bg-amber-950 text-amber-400 border-amber-900/60'
                        : 'bg-emerald-950 text-emerald-400 border-emerald-900/60'
                    }`}>
                      {activeConflict.status}
                    </span>
                  </div>

                  {/* Discrepancy Comparison Board */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Domain A findings */}
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
                      <span className="text-[10px] text-sky-400 font-mono font-bold tracking-wider uppercase">Domain A: {activeConflict.domainA}</span>
                      <div className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 mt-1.5 flex flex-col gap-1.5">
                        {Object.entries(activeConflict.resultA).map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-slate-800/50 pb-1">
                            <span className="text-slate-500">{k}:</span>
                            <span className="text-slate-100 font-bold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Domain B findings */}
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
                      <span className="text-[10px] text-purple-400 font-mono font-bold tracking-wider uppercase">Domain B: {activeConflict.domainB}</span>
                      <div className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 mt-1.5 flex flex-col gap-1.5">
                        {Object.entries(activeConflict.resultB).map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-slate-800/50 pb-1">
                            <span className="text-slate-500">{k}:</span>
                            <span className="text-slate-100 font-bold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Discrepancy Description */}
                  <div className="bg-slate-900/40 p-4 rounded border border-slate-800 text-xs">
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Conflict Description & Rationale</span>
                    <p className="text-slate-300 mt-1.5 font-mono">{activeConflict.rationale}</p>
                  </div>

                  {/* Active Resolution State info */}
                  {activeConflict.status !== 'UNRESOLVED' ? (
                    <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-900/60 text-xs font-mono flex flex-col gap-2">
                      <h5 className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Governance Decision Recorded Successfully
                      </h5>
                      <div className="grid grid-cols-2 gap-3 text-slate-300 mt-1 text-[11px]">
                        <div>Strategy: <strong>{activeConflict.status}</strong></div>
                        <div>Authority: <strong>{activeConflict.resolutionAuthority}</strong></div>
                        <div className="col-span-2 border-t border-emerald-900/40 pt-2 mt-1">
                          Rationale: <p className="text-emerald-300 italic mt-0.5">{activeConflict.resolutionRationale}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Active Governance Resolution form */
                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                      <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Governance Conflict Resolution Block</h5>
                      
                      <div className="flex flex-col gap-1 text-xs font-mono">
                        <label className="text-slate-400">Resolution Strategy:</label>
                        <select
                          value={resolutionStrategy}
                          onChange={e => setResolutionStrategy(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 mt-1 font-mono focus:outline-none focus:border-amber-500"
                        >
                          <option value="RESOLVED_REVISION">Force New Revision (Correct Parameters)</option>
                          <option value="RESOLVED_OVERRIDE">Admin Governance Override (Enforce Domain A)</option>
                          <option value="REJECTED">Reject Engineering Object Model State</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 text-xs font-mono">
                        <label className="text-slate-400">Resolution Governance Rationale:</label>
                        <textarea
                          rows={3}
                          placeholder="Provide absolute professional engineering rationale for this governance decision..."
                          value={resolutionRationale}
                          onChange={e => setResolutionRationale(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono mt-1 text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          onClick={() => handleResolveConflict(activeConflict.conflictId)}
                          className="px-4 py-2 text-xs font-mono bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold transition-all"
                        >
                          Submit Binding Decision
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <p className="text-slate-500 text-xs text-center py-12 bg-slate-950 rounded border border-slate-800">Select a conflict to review.</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB 5: EVIDENCE & TRUTH THREADS */}
      {activeConsoleTab === 'certificates' && (
        <div className="flex flex-col gap-5 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Cryptographic Evidence & Truth Thread Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">How multi-disciplinary analyses are locked into the tamper-proof SECP Cryptographic Ledger.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Box: Merkle Tree Proof & Certificate */}
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Award className="text-emerald-400 w-5 h-5" /> Engineering Truth Certificate (M9)
              </h4>

              <div className="p-4 bg-slate-900 rounded border border-slate-800/80 font-mono text-xs flex flex-col gap-3 text-slate-300">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Certificate Status:</span>
                  <span className="text-emerald-400 font-bold">SIGNED & VALID</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Signer Identity:</span>
                  <span className="text-slate-100 font-bold">SECP_AUTHORITY_ROOT_KEY</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Active Revision Block:</span>
                  <span className="text-slate-100">BLOCK_R291_ALPHA</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Merkle Root Hash:</span>
                  <span className="text-emerald-400">0x8f3c7e4a1b025f8c6e3d9a7f012b5c4e8f9a2d3e</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">Attestation Signature:</span>
                  <span className="text-[10px] text-slate-400 break-all bg-slate-950 p-2 rounded border border-slate-800">
                    MEYCIQCc9d8f3c7e4a1b025f8c6e3d9a7f012b5c4e8f9a2d3e5b3f7a8c9e1d084f6c3a8b2d9e01f5c4a7e8f9c1...
                  </span>
                </div>
              </div>
            </div>

            {/* Right Box: Evidence Bus Log */}
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Fingerprint className="text-emerald-400 w-5 h-5" /> Live Evidence Bus Ledger
              </h4>

              <div className="flex flex-col gap-2 text-xs font-mono">
                <div className="p-3 bg-slate-900/60 rounded border border-slate-800 flex justify-between items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-slate-300 font-bold">BLOCK #112: ROBOTICS EVALUATION</span>
                    <span className="text-[10px] text-slate-500">Merkle Proof Path verified</span>
                  </div>
                  <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">LOCKED</span>
                </div>
                <div className="p-3 bg-slate-900/60 rounded border border-slate-800 flex justify-between items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-slate-300 font-bold">BLOCK #111: AEROSPACE FLIGHT DATA</span>
                    <span className="text-[10px] text-slate-500">Lift CFD attestation payload</span>
                  </div>
                  <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">LOCKED</span>
                </div>
                <div className="p-3 bg-slate-900/60 rounded border border-slate-800 flex justify-between items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-slate-300 font-bold">BLOCK #110: CONFLICT RESOLUTION RECORD</span>
                    <span className="text-[10px] text-slate-500">Decision strategies lockin</span>
                  </div>
                  <span className="text-emerald-400 font-bold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">LOCKED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
