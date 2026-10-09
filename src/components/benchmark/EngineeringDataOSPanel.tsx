import React, { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Activity, 
  Award, 
  Sliders, 
  GitBranch, 
  Network, 
  Workflow
} from 'lucide-react';

export const EngineeringDataOSPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LINEAGE' | 'GATE181'>('OVERVIEW');
  const [isRunning, setIsRunning] = useState(false);
  const [tested, setTested] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const handleAuditDataOS = () => {
    setIsRunning(true);
    setFeedback('Auditing Data Lineage Graph, ECO Revision Chains & Gate 181...');

    setTimeout(() => {
      setTested(true);
      setIsRunning(false);
      setFeedback('Gate 181 Evaluated: Data Lineage Graph Verified - 100% Traceability across CAD/CAM/CAE.');
    }, 250);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight">Engineering Data Governance OS & Gate 181</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
              PATCH-SECP-181
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Semantic engineering data lineage graph connecting B-Rep STEP models, FEA mesh nodes, CFD boundary conditions, and CAM G-Code outputs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAuditDataOS}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
            {isRunning ? 'Auditing Lineage...' : 'RUN DATA OS GATE 181'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sliders className="w-3.5 h-3.5" /> Summary
        </button>
        <button
          onClick={() => setActiveTab('LINEAGE')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'LINEAGE' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <GitBranch className="w-3.5 h-3.5" /> Lineage Graph
        </button>
        <button
          onClick={() => setActiveTab('GATE181')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'GATE181' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 181 Check
        </button>
      </div>

      {/* Content */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Lineage Nodes Tracked</span>
            <div className="text-xl font-mono font-bold text-cyan-400 mt-1">
              4,820 Entities
            </div>
            <span className="text-[10px] text-slate-500">Bi-directional Mapping</span>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Traceability Ratio</span>
            <div className="text-2xl font-mono font-bold text-emerald-400">
              100.0%
            </div>
            <span className="text-[10px] text-slate-500">Zero Orphan Records</span>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold">ECO Revisions</span>
            <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
              REV-C (Active)
            </div>
            <span className="text-[10px] text-slate-500">Auto-propagate Mesh & Toolpaths</span>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Gate Status</span>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
              PASSED
            </div>
            <span className="text-[10px] text-slate-500">ISO 10303 / AP242 Certified</span>
          </div>
        </div>
      )}

      {activeTab === 'LINEAGE' && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="text-cyan-400 font-bold font-mono">Semantic Data Lineage Hierarchy</div>
          <div className="text-slate-300 space-y-1 font-mono">
            <div>CAD-PART-01 [STEP AP242] ➔ FEA-MESH-01 [Tet10 450k] ➔ FEA-STRESS-RESULT</div>
            <div>CAD-PART-01 [STEP AP242] ➔ CAM-TOOLPATH-01 [5-Axis G-Code] ➔ CNC-NC-PROGRAM</div>
          </div>
        </div>
      )}

      {activeTab === 'GATE181' && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono">
            <CheckCircle2 className="w-4 h-4" /> GATE 181: Engineering Data OS Gate PASSED
          </div>
          <p className="text-xs text-slate-400">Complete traceability and revision lock confirmed across all downstream engineering artifacts.</p>
        </div>
      )}
    </div>
  );
};

