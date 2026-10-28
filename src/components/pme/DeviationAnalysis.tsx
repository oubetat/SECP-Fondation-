import React from 'react';
import { BarChart3, Scan, ShieldCheck, AlertCircle, FileSpreadsheet, Layers, Info } from 'lucide-react';

interface DeviationMetric {
  name: string;
  value: string;
  unit: string;
  status: 'PASS' | 'FAIL';
}

const MOCK_METRICS: DeviationMetric[] = [
  { name: 'Max Absolute Deviation', value: '2.5', unit: 'GPa', status: 'FAIL' },
  { name: 'Mean Bias Error', value: '0.12', unit: 'GPa', status: 'PASS' },
  { name: 'Correlation Coefficient', value: '0.96', unit: '', status: 'PASS' },
];

export const DeviationAnalysis: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-rose-600/20 rounded-lg">
          <BarChart3 className="w-8 h-8 text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight italic">Material Deviation Analysis</h1>
          <p className="text-slate-400 text-sm">V8 Comparative study: Intended vs. As-Built material fields</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Summary & Metrics */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Scan className="w-4 h-4 text-rose-500" /> Global Metrics
                 </h2>
                 <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase font-black">Violation Detected</span>
              </div>

              <div className="space-y-4">
                 {MOCK_METRICS.map(m => (
                    <div key={m.name} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 group hover:border-slate-700 transition-colors">
                       <span className="text-xs text-slate-400">{m.name}</span>
                       <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-black ${m.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>{m.value}</span>
                          <span className="text-[10px] text-slate-600 font-bold">{m.unit}</span>
                       </div>
                    </div>
                 ))}
              </div>

              <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl border border-slate-700 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                 <FileSpreadsheet className="w-4 h-4" /> Export Raw Deviation Data
              </button>
           </div>

           <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <ShieldCheck className="w-4 h-4 text-emerald-400" /> Acceptance Criteria
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                 Rule <span className="font-mono text-slate-300">AC-ME-01</span>: Spatial deviation must not exceed 2.0 GPa for critical zones.
                 Current max is <span className="text-rose-400 font-bold">2.5 GPa</span> at <span className="font-mono text-slate-300">[12, 45, 0]</span>.
              </p>
              <div className="pt-2">
                 <div className="flex justify-between items-center text-[10px] mb-2 font-bold uppercase tracking-tighter">
                    <span className="text-slate-500">Compliance Progress</span>
                    <span className="text-rose-400">FAILED (92% IN-RANGE)</span>
                 </div>
                 <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 w-[92%]" />
                    <div className="h-full bg-rose-500 w-[8%]" />
                 </div>
              </div>
           </div>
        </div>

        {/* Right Col: Deviation Heatmap Visualization */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 backdrop-blur-md">
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]" />
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Actual Map</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-700" />
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-50">Intended Reference</span>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button className="px-2 py-1 bg-slate-800 text-[9px] font-bold rounded border border-slate-700 text-slate-300 uppercase">Toggle Diff</button>
                    <button className="px-2 py-1 bg-slate-800 text-[9px] font-bold rounded border border-slate-700 text-slate-300 uppercase">Slice View</button>
                 </div>
              </div>
              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden group">
                 {/* Visual Representation of Deviation Map */}
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(244,63,94,0.1),_transparent)] opacity-40 group-hover:opacity-60 transition-opacity" />
                 
                 {/* Pseudo 3D Part with Heatmap */}
                 <div className="relative w-80 h-40 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl rotate-12 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-amber-500/20 to-rose-600/40 rounded-xl blur-md" />
                    <Layers className="w-12 h-12 text-slate-600 opacity-20" />
                    
                    {/* Crosshair on high deviation point */}
                    <div className="absolute top-4 right-8 flex items-center justify-center">
                       <div className="w-6 h-6 border-2 border-rose-500 rounded-full flex items-center justify-center animate-ping opacity-75" />
                       <div className="absolute w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]" />
                       <div className="absolute top-8 right-0 bg-rose-950 border border-rose-500 p-2 rounded text-[9px] font-mono text-white shadow-2xl z-20 whitespace-nowrap">
                          MAX_DEV: 2.5 GPa (FAIL)
                       </div>
                    </div>
                 </div>

                 {/* Legend */}
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase vertical-text tracking-widest mb-2">Delta P</div>
                    <div className="flex flex-col items-center">
                       <span className="text-[8px] font-bold text-rose-500 mb-1">+5G</span>
                       <div className="w-1.5 h-32 rounded-full bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 border border-slate-800" />
                       <span className="text-[8px] font-bold text-emerald-500 mt-1">-5G</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex gap-4 items-center">
              <Info className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-200/80 leading-relaxed italic">
                 Analysis confirms non-conformance in high-load regions. It is recommended to re-run 
                 Optimization V10 using the as-built stiffness to verify if structural safety targets are still met 
                 despite the property deviation.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
