import React from 'react';
import { Search, Map as MapIcon, Database, Activity, ShieldCheck, AlertCircle, FileDigit } from 'lucide-react';

interface MeasurementPoint {
  id: string;
  location: [number, number, number];
  intended: number;
  actual: number;
  uncertainty: number;
}

const MOCK_POINTS: MeasurementPoint[] = [
  { id: 'P1', location: [10, 20, 0], intended: 110.0, actual: 112.5, uncertainty: 0.5 },
  { id: 'P2', location: [50, 40, 0], intended: 115.0, actual: 114.8, uncertainty: 0.4 },
  { id: 'P3', location: [90, 60, 0], intended: 120.0, actual: 118.2, uncertainty: 0.8 },
];

export const AsBuiltReconstruction: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="p-6 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Search className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">As-Built Reconstruction</h1>
            <p className="text-slate-400 text-xs tracking-tight">V7 Reconstruction of the actual manufactured material state</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border border-slate-700 uppercase tracking-widest">
            <FileDigit className="w-4 h-4" /> Import CT Data
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Dataset Sidebar */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <Database className="w-4 h-4" /> Measurement Sets
          </div>
          <div className="p-4 space-y-4">
             <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                   <span className="text-[10px] font-bold text-blue-400 uppercase">Primary Set</span>
                   <span className="text-[10px] text-slate-500 font-mono">ID: DS-442</span>
                </div>
                <h3 className="text-sm font-bold text-white">Ultrasonic Scan #1</h3>
                <p className="text-[10px] text-slate-400">Date: 2026-10-26</p>
                <div className="pt-2 flex flex-col gap-1">
                   <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Points</span>
                      <span className="text-slate-200">12,450</span>
                   </div>
                   <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Coverage</span>
                      <span className="text-slate-200">82%</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Reconstruction Workspace */}
        <div className="flex-1 bg-black p-8 flex flex-col overflow-auto">
           <div className="max-w-4xl mx-auto w-full space-y-8">
              {/* Reconstruction Map Placeholder */}
              <div className="aspect-video bg-slate-900 rounded-3xl border border-slate-800 relative overflow-hidden flex items-center justify-center group shadow-2xl">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.05),_transparent)]" />
                 <div className="z-10 text-center space-y-4">
                    <MapIcon className="w-12 h-12 text-indigo-500 mx-auto" />
                    <div className="space-y-1">
                       <p className="text-lg font-bold text-white uppercase tracking-widest">As-Built Spatial Field</p>
                       <p className="text-xs text-slate-500 font-mono italic">INTERPOLATED FROM 12.4K SENSOR NODES</p>
                    </div>
                 </div>
                 
                 {/* Mock Measurement Points */}
                 <div className="absolute inset-0">
                    {MOCK_POINTS.map((p, i) => (
                      <div 
                        key={p.id}
                        className="absolute w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse cursor-pointer group/point"
                        style={{ left: `${p.location[0]}%`, top: `${p.location[1]}%` }}
                      >
                         <div className="hidden group-hover/point:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 p-2 rounded shadow-2xl z-20 whitespace-nowrap">
                            <p className="text-[10px] font-bold text-white">POINT: {p.id}</p>
                            <p className="text-[9px] text-slate-400">Actual: {p.actual} GPa</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Quality Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                       <Activity className="w-4 h-4 text-emerald-400" /> Reconstruction Quality
                    </div>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 text-xs uppercase">RMSE Error</span>
                          <span className="font-mono text-emerald-400">0.024 GPa</span>
                       </div>
                       <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[95%]" />
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                       <ShieldCheck className="w-4 h-4 text-indigo-400" /> Provenance Validity
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                          <ShieldCheck className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">Verified Lineage</p>
                          <p className="text-[10px] text-slate-500">Cryptographically linked to Machine EOS-02 and Rev-B.</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Warning for Missing Coverage */}
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl flex gap-4 items-start">
                 <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                 <p className="text-[11px] text-indigo-200/70 leading-relaxed italic">
                    Note: Reconstruction is limited to areas with sensor coverage {'>'} 20%. 
                    Internal lattice cores are currently being estimated via model extrapolation (Gate 7-ARCH-04).
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
