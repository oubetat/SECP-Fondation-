/**
 * SECP Industrial OS v3 — PATCH-188: Competitive Workflow Dashboard
 * High-fidelity UI for visualizing end-to-end industrial workflows and data lineage.
 */

import React, { useState, useEffect } from 'react';
import { Workflow, Shield, Zap, Activity, CheckCircle2, AlertCircle, Hash, Database, ArrowRight, ChevronRight, Server, Cpu, BarChart3, Box, Layers, FileText, History, Lock, ArrowDown, Clock, Fingerprint, EngineeringWorkflow, WorkflowExecutionResult } from 'lucide-react';
import { CompetitiveWorkflowRegistry } from '../../engine/workflows/WorkflowRegistry';
import { WorkflowEngine } from '../../engine/workflows/WorkflowEngine';
import { 
  EngineeringWorkflow, 
  WorkflowExecutionResult, 
  WorkflowMaturity,
  WorkflowStage,
  DataLineageNode
} from '../../engine/workflows/WorkflowTypes';

export const CompetitiveWorkflowDashboard: React.FC = () => {
  const [workflows, setWorkflows] = useState<EngineeringWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<EngineeringWorkflow | null>(null);
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [viewMode, setViewMode] = useState<'INDUSTRIAL' | 'ENGINEERING' | 'AUDITOR'>('INDUSTRIAL');

  useEffect(() => {
    const registry = CompetitiveWorkflowRegistry.getInstance();
    const all = registry.getAllWorkflows();
    setWorkflows(all);
    setSelectedWorkflow(all[0]);
  }, []);

  const handleRunWorkflow = async () => {
    if (!selectedWorkflow) return;
    setIsExecuting(true);
    const engine = new WorkflowEngine();
    const result = await engine.executeWorkflow(selectedWorkflow);
    setExecutionResult(result);
    setIsExecuting(false);
  };

  const getMaturityColor = (maturity: WorkflowMaturity) => {
    switch (maturity) {
      case WorkflowMaturity.PRODUCTION_PROVEN: return 'text-emerald-400 bg-emerald-950 border-emerald-500/40';
      case WorkflowMaturity.VALIDATED: return 'text-sky-400 bg-sky-950 border-sky-500/40';
      case WorkflowMaturity.VERIFIED: return 'text-indigo-400 bg-indigo-950 border-indigo-500/40';
      case WorkflowMaturity.PARTIAL: return 'text-amber-400 bg-amber-950 border-amber-500/40';
      case WorkflowMaturity.BLOCKED: return 'text-rose-400 bg-rose-950 border-rose-500/40';
      default: return 'text-slate-500 bg-slate-900 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-2.5 bg-indigo-950 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-lg shadow-indigo-900/10">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-100">Competitive Engineering Workflows</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-400 rounded-md border border-slate-700 uppercase">
                PATCH-188 QUALIFICATION
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">End-to-End Industrial Execution · Cross-Domain Integrity · Data Lineage · Qualification Scores</p>
          </div>
        </div>

        <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 p-1">
          {(['INDUSTRIAL', 'ENGINEERING', 'AUDITOR'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                viewMode === mode
                  ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Workflow Selector */}
        <div className="w-80 bg-slate-900/40 border-r border-slate-800 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Industrial Scenarios</div>
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => {
                  setSelectedWorkflow(wf);
                  setExecutionResult(null);
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedWorkflow?.id === wf.id
                    ? 'bg-indigo-950/20 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    wf.industry === 'AEROSPACE' ? 'text-sky-400 border-sky-500/40 bg-sky-950/30' : 'text-amber-400 border-amber-500/40 bg-amber-950/30'
                  }`}>
                    {wf.industry}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{wf.qualificationScore}%</span>
                </div>
                <div className="text-xs font-bold text-slate-200 mb-1 leading-tight">{wf.name}</div>
                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${wf.qualificationScore}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
          {!selectedWorkflow ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <Box className="w-12 h-12 text-slate-700" />
              <p>Select an industrial workflow to begin qualification</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-100">{selectedWorkflow.name}</h2>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded border ${getMaturityColor(selectedWorkflow.maturity)}`}>
                      {selectedWorkflow.maturity.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 max-w-2xl italic leading-relaxed">
                    "{selectedWorkflow.objective}"
                  </p>
                </div>
                <button 
                  onClick={handleRunWorkflow}
                  disabled={isExecuting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition shadow-lg shadow-indigo-900/20 flex items-center space-x-2 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {isExecuting ? <Zap className="w-4 h-4 animate-pulse" /> : <Activity className="w-4 h-4" />}
                  <span>{isExecuting ? 'Executing Workflow...' : 'Execute Full Workflow'}</span>
                </button>
              </div>

              {/* Grid: Stats & Limitations */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    <span>Qualification Metrics</span>
                    <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Cross-Domain Score</span>
                      <div className="text-2xl font-bold text-slate-100 font-mono">{selectedWorkflow.qualificationScore}%</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Critical Stages</span>
                      <div className="text-2xl font-bold text-emerald-400 font-mono">
                        {selectedWorkflow.stages.filter(s => s.isCritical).length}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Data Lineage Nodes</span>
                      <div className="text-2xl font-bold text-indigo-400 font-mono">
                        {executionResult?.lineage.length || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Known Limitations</span>
                  </h3>
                  <ul className="space-y-2 text-[11px] text-slate-400 italic">
                    {selectedWorkflow.limitations.map((l, i) => <li key={i} className="flex items-start space-x-2">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{l}</span>
                    </li>)}
                  </ul>
                </div>
              </div>

              {/* Workflow Graph / Pipeline */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Workflow className="w-32 h-32" />
                </div>
                
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Engineering Truth Pipeline (Live Trace)</span>
                </h3>

                <div className="flex flex-col space-y-4 relative">
                  {selectedWorkflow.stages.map((stage, idx) => {
                    const result = executionResult?.stages[stage.id];
                    const status = result?.status || stage.status;
                    
                    return (
                      <div key={stage.id} className="relative">
                        {idx < selectedWorkflow.stages.length - 1 && (
                          <div className="absolute left-[18px] top-10 w-0.5 h-4 bg-slate-800" />
                        )}
                        
                        <div className={`flex items-center justify-between p-4 bg-slate-950 border rounded-xl transition-all ${
                          status === WorkflowMaturity.VERIFIED ? 'border-emerald-500/30' : 
                          status === WorkflowMaturity.VALIDATED ? 'border-sky-500/30' :
                          status === WorkflowMaturity.PARTIAL ? 'border-amber-500/30' :
                          'border-slate-800'
                        }`}>
                          <div className="flex items-center space-x-4">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-inner ${
                              status === WorkflowMaturity.VERIFIED ? 'bg-emerald-950 text-emerald-400 border-emerald-500/20' : 
                              status === WorkflowMaturity.PARTIAL ? 'bg-amber-950 text-amber-400 border-amber-500/20' :
                              'bg-slate-900 text-slate-600 border-slate-800'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-200">{stage.name}</div>
                              <div className="flex items-center space-x-3 mt-1 text-[10px] font-mono text-slate-500 uppercase">
                                <span className="text-sky-400">{stage.domain}</span>
                                {stage.isCritical && <span className="text-rose-500 font-bold italic">CRITICAL</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6">
                            {result?.executionTimeMs && (
                              <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>{result.executionTimeMs}ms</span>
                              </div>
                            )}
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getMaturityColor(status)}`}>
                              {status.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lineage & Evidence Drilldown (Engineering/Auditor Mode) */}
              {(viewMode === 'ENGINEERING' || viewMode === 'AUDITOR') && executionResult && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                      <span>Cross-Domain Data Lineage</span>
                      <History className="w-3.5 h-3.5 text-sky-400" />
                    </h3>
                    
                    <div className="space-y-3">
                      {executionResult.lineage.map((node, i) => (
                        <div key={node.id} className="flex items-center space-x-4 p-4 bg-slate-950 border border-slate-800 rounded-xl group transition-all hover:border-indigo-500/30">
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-600 group-hover:text-indigo-400 transition">
                            <Fingerprint className="w-4 h-4" />
                          </div>
                          <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                            <div className="col-span-1">
                              <div className="text-[10px] font-bold text-slate-200 truncate">{node.label}</div>
                              <div className="text-[9px] text-slate-500 uppercase">{node.domain}</div>
                            </div>
                            <div className="col-span-1 text-[10px] font-mono text-indigo-400 truncate">
                              {node.hash}
                            </div>
                            <div className="col-span-1 text-[10px] font-mono text-slate-500 truncate italic">
                              {node.transform}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <span className="text-[9px] px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 font-mono group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition">
                                {node.evidenceId}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {viewMode === 'AUDITOR' && (
                      <div className="mt-8 p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Workflow Forensic Certificate</span>
                          </div>
                          <button className="text-[10px] text-sky-400 font-bold hover:text-sky-300 transition uppercase underline decoration-sky-500/30 underline-offset-4">
                            Download Evidence Package (EVP)
                          </button>
                        </div>
                        <div className="p-4 bg-slate-900/50 border border-slate-800/50 rounded-lg text-[10px] font-mono text-slate-500 break-all leading-relaxed">
                          ROOT_CHAIN: 7f8e91c7a2b3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Data State */}
              {!executionResult && !isExecuting && (
                <div className="p-12 text-center bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
                  <Activity className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-slate-300 uppercase tracking-wide">Ready for Industrial Qualification</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                    Executing this workflow will run all engineering stages in a continuous chain, verifying data handoffs and generating immutable evidence.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
