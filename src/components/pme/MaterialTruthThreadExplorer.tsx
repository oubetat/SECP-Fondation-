import React from 'react';
import { GitBranch, Box, Database, Activity, ShieldCheck, FileCheck2, AlertCircle, ArrowRight } from 'lucide-react';

interface ThreadNode {
  id: string;
  type: string;
  label: string;
  revision: string;
  status: 'VALID' | 'INVALIDATED' | 'STALE';
  icon: React.ElementType;
}

const MOCK_THREAD: ThreadNode[] = [
  { id: 'GEOM-001', type: 'GEOMETRY', label: 'Aerospace Bracket', revision: 'REV-B', status: 'VALID', icon: Box },
  { id: 'MAT-001', type: 'MATERIAL', label: 'Ti-6Al-4V', revision: 'REV-2026', status: 'VALID', icon: Database },
  { id: 'FLD-001', type: 'SPATIAL_FIELD', label: 'Stiffness Gradient', revision: 'REV-2', status: 'VALID', icon: Activity },
  { id: 'SIM-001', type: 'SIMULATION', label: 'Structural FEA', revision: 'V1.0', status: 'VALID', icon: ShieldCheck },
  { id: 'ASBUILT-001', type: 'AS_BUILT', label: 'Specimen #42', revision: 'LOT-A', status: 'STALE', icon: FileCheck2 },
  { id: 'QUAL-001', type: 'QUALIFICATION', label: 'Industrial Release', revision: 'PENDING', status: 'INVALIDATED', icon: AlertCircle },
];

export const MaterialTruthThreadExplorer: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="p-6 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/20 rounded-lg">
            <GitBranch className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Material Truth Thread</h1>
            <p className="text-slate-400 text-xs tracking-tight">Revision-bound provenance and engineering lineage</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-[10px] font-mono text-emerald-400">
          MERKLE_ROOT: 7f8b...3e2a
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          {MOCK_THREAD.map((node, index) => (
            <React.Fragment key={node.id}>
              {/* Node Card */}
              <div className={`w-full max-w-md bg-slate-900 border-2 rounded-2xl p-5 shadow-xl transition-all relative ${
                node.status === 'VALID' ? 'border-emerald-500/30 hover:border-emerald-500/60' :
                node.status === 'STALE' ? 'border-amber-500/30 hover:border-amber-500/60' :
                'border-rose-500/30 hover:border-rose-500/60'
              }`}>
                {/* Status Indicator */}
                <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full text-[10px] font-bold border shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-transform hover:scale-110 cursor-default"
                  style={{ 
                    backgroundColor: node.status === 'VALID' ? 'rgba(16, 185, 129, 0.1)' : node.status === 'STALE' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderColor: node.status === 'VALID' ? 'rgba(16, 185, 129, 0.5)' : node.status === 'STALE' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                    color: node.status === 'VALID' ? '#10b981' : node.status === 'STALE' ? '#f59e0b' : '#ef4444'
                  }}
                >
                   {node.status === 'VALID' ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                   {node.status}
                </div>

                <div className="flex gap-4">
                   <div className={`p-3 rounded-xl ${
                     node.status === 'VALID' ? 'bg-emerald-500/10 text-emerald-400' :
                     node.status === 'STALE' ? 'bg-amber-500/10 text-amber-400' :
                     'bg-rose-500/10 text-rose-400'
                   }`}>
                     <node.icon className="w-6 h-6" />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{node.type}</span>
                        <span className="text-[10px] font-bold text-slate-400">{node.revision}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{node.label}</h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">{node.id}</p>
                   </div>
                </div>

                {/* Evidence Link */}
                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                   <button className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase">View Evidence</button>
                   <button className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase">Audit Logs</button>
                </div>
              </div>

              {/* Connector Arrow */}
              {index < MOCK_THREAD.length - 1 && (
                <div className="h-12 w-0.5 bg-slate-800 my-2 relative flex items-center justify-center">
                   <ArrowRight className="w-4 h-4 text-slate-700 rotate-90" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      {/* Invalidation Console */}
      <div className="h-24 bg-slate-900/80 border-t border-slate-800 p-4 flex gap-4 overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 border-r border-slate-800 shrink-0">
          <Activity className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold text-amber-200 uppercase">Invalidation Monitor</span>
        </div>
        <div className="flex-1 flex items-center gap-4 overflow-x-auto text-[11px] font-mono text-slate-400">
           <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">[CRITICAL]</span>
           <span>CASCADE DETECTED: ASBUILT-001 is STALE due to change in GEOM-001 (REV-C detected). QUALIFICATION-001 is now INVALIDATED.</span>
        </div>
      </div>
    </div>
  );
};
